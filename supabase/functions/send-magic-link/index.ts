import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type CustomerAccessRequest = { jobId: string };

function corsHeaders(req: Request) {
  const configuredBase = Deno.env.get("APP_BASE_URL") || "";
  const configuredOrigin = configuredBase ? new URL(configuredBase).origin : "";
  const requestOrigin = req.headers.get("origin") || "";
  const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin);
  const allowedOrigin = requestOrigin && (requestOrigin === configuredOrigin || localOrigin)
    ? requestOrigin
    : configuredOrigin;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "content-type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function serviceRoleKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      const values = Object.values(parsed).filter((value): value is string => typeof value === "string");
      const key = values.find((value) => value.startsWith("sb_secret_")) || values[0];
      if (key) return key;
    } catch {
      // Fall back to the legacy secret name below.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

function classifyResendFailure(status: number, body: string) {
  if (status === 429) {
    return {
      code: "resend_rate_limited",
      message: "Email service is temporarily busy. Please wait a minute and try again.",
    };
  }
  if (/testing emails|verify(?: a| your)? domain|domain is not verified/i.test(body)) {
    return {
      code: "resend_sender_not_verified",
      message: "Resend rejected the sender address. Verify a sending domain in Resend, then try again.",
    };
  }
  if (/api key|invalid_api_key|unauthorized/i.test(body)) {
    return {
      code: "resend_api_key_invalid",
      message: "Email service authentication failed. Update the Resend API key, then try again.",
    };
  }
  return {
    code: "resend_rejected",
    message: "The email provider rejected the message. Check the Resend activity log and try again.",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = serviceRoleKey();
  const appBaseUrl = Deno.env.get("APP_BASE_URL");
  const fromEmail = Deno.env.get("FROM_EMAIL") || "Service Portal <onboarding@resend.dev>";
  if (!resendApiKey || !supabaseUrl || !serviceKey || !appBaseUrl) {
    return jsonResponse(req, { error: "Server is missing required environment variables" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse(req, { error: "Unauthorized" }, 401);

  let payload: CustomerAccessRequest;
  try {
    payload = (await req.json()) as CustomerAccessRequest;
  } catch {
    return jsonResponse(req, { error: "Request is invalid" }, 400);
  }
  if (!payload.jobId) return jsonResponse(req, { error: "jobId is required" }, 400);

  const supabase = createClient(supabaseUrl, serviceKey);
  const supabaseForAuth = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await supabaseForAuth.auth.getUser();
  if (authError || !authData.user) return jsonResponse(req, { error: "Unauthorized" }, 401);

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, company_id, customer_id, name, customers(name, email)")
    .eq("id", payload.jobId)
    .single();
  if (jobError || !job) return jsonResponse(req, { error: "Job not found" }, 404);

  const { data: member, error: memberError } = await supabase
    .from("company_members")
    .select("id")
    .eq("company_id", job.company_id)
    .eq("user_id", authData.user.id)
    .single();
  if (memberError || !member) return jsonResponse(req, { error: "You do not have access to this job" }, 403);

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  if (!customer?.email) return jsonResponse(req, { error: "Customer email not found for this job" }, 400);

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: recentLink } = await supabase
    .from("magic_links")
    .select("id")
    .eq("job_id", job.id)
    .gte("created_at", oneMinuteAgo)
    .limit(1)
    .maybeSingle();
  if (recentLink) return jsonResponse(req, { error: "Please wait one minute before sending another customer email" }, 429);

  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  const portalLink = `${appBaseUrl.replace(/\/$/, "")}/?portal=${encodeURIComponent(token)}`;

  const { data: newLink, error: insertError } = await supabase.from("magic_links").insert({
    job_id: job.id,
    customer_id: job.customer_id,
    company_id: job.company_id,
    token_hash: tokenHash,
    sent_to: customer.email,
    channel: "email",
    expires_at: expiresAt,
  }).select("id").single();
  if (insertError || !newLink) return jsonResponse(req, { error: "Could not create customer link" }, 500);

  const subject = `${job.name || "Your project"} portal link`;
  const customerName = escapeHtml(customer.name || "there");
  const safePortalLink = escapeHtml(portalLink);
  const emailResult = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: customer.email,
      subject,
      html: `
        <p>Hi ${customerName},</p>
        <p>Your secure project portal is ready.</p>
        <p><a href="${safePortalLink}">Open your project portal</a></p>
        <p>This link expires in 7 days. A newer email will replace this link.</p>
      `,
    }),
  });

  if (!emailResult.ok) {
    const resendBody = await emailResult.text();
    const failure = classifyResendFailure(emailResult.status, resendBody);
    console.error("Resend email rejected", {
      status: emailResult.status,
      reason: failure.code,
      recipientDomain: customer.email.split("@")[1] || "unknown",
    });
    await supabase.from("magic_links").delete().eq("id", newLink.id);
    return jsonResponse(req, { error: failure.message, code: failure.code }, 502);
  }

  await supabase
    .from("magic_links")
    .update({ expires_at: now })
    .eq("job_id", job.id)
    .neq("id", newLink.id)
    .gt("expires_at", now);

  return jsonResponse(req, { ok: true, expiresAt });
});
