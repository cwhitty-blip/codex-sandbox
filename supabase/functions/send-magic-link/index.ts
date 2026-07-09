import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type MagicLinkRequest = {
  jobId: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appBaseUrl = Deno.env.get("APP_BASE_URL");
  const fromEmail = Deno.env.get("FROM_EMAIL") || "Service Portal <onboarding@resend.dev>";

  if (!resendApiKey || !supabaseUrl || !serviceRoleKey || !appBaseUrl) {
    return jsonResponse({ error: "Server is missing required environment variables" }, 500);
  }

  const payload = (await req.json()) as MagicLinkRequest;
  if (!payload.jobId) {
    return jsonResponse({ error: "jobId is required" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, company_id, customer_id, name, customers(name, email)")
    .eq("id", payload.jobId)
    .single();

  if (jobError || !job) {
    return jsonResponse({ error: "Job not found" }, 404);
  }

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  if (!customer?.email) {
    return jsonResponse({ error: "Customer email not found for this job" }, 400);
  }

  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  const portalLink = `${appBaseUrl.replace(/\/$/, "")}/?portal=${encodeURIComponent(token)}`;

  const { error: insertError } = await supabase.from("magic_links").insert({
    job_id: job.id,
    customer_id: job.customer_id,
    company_id: job.company_id,
    token_hash: tokenHash,
    sent_to: customer.email,
    channel: "email",
    expires_at: expiresAt,
  });

  if (insertError) {
    return jsonResponse({ error: insertError.message }, 500);
  }

  const subject = `${job.name || "Your project"} portal link`;
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
        <p>Hi ${customer.name || "there"},</p>
        <p>Your secure project portal is ready.</p>
        <p><a href="${portalLink}">Open your project portal</a></p>
        <p>This link expires in 7 days.</p>
      `,
    }),
  });

  if (!emailResult.ok) {
    const detail = await emailResult.text();
    return jsonResponse({ error: "Email could not be sent", detail }, 502);
  }

  return jsonResponse({ ok: true, expiresAt });
});
