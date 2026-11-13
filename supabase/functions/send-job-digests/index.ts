import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type DigestClaim = {
  job_id: string;
  company_id: string;
  customer_id: string;
  event_count: number | string;
};

type JobUpdateEvent = {
  change_summaries: unknown;
};

const brandingBucket = "company-branding";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
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

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
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

function resendFailure(status: number, body: string) {
  if (status === 429) return "Resend rate limited the digest worker";
  if (/testing emails|verify(?: a| your)? domain|domain is not verified/i.test(body)) {
    return "Resend rejected the unverified sender domain";
  }
  if (/api key|invalid_api_key|unauthorized/i.test(body)) return "Resend rejected the API key";
  return `Resend rejected the digest with status ${status}`;
}

function digestChangeSummaries(events: JobUpdateEvent[]) {
  const summaries = events.flatMap((event) => Array.isArray(event.change_summaries)
    ? event.change_summaries.filter((summary): summary is string => typeof summary === "string")
    : []);
  const uniqueSummaries = [...new Set(
    summaries.map((summary) => summary.replace(/\s+/g, " ").trim()).filter(Boolean),
  )];
  if (!uniqueSummaries.length) return ["Job details were updated"];
  if (uniqueSummaries.length <= 12) return uniqueSummaries;
  return [...uniqueSummaries.slice(0, 12), `${uniqueSummaries.length - 12} more updates`];
}

async function sendDigestForJob(
  supabase: ReturnType<typeof createClient>,
  claim: DigestClaim,
  claimToken: string,
  resendApiKey: string,
  appBaseUrl: string,
  fromEmail: string,
) {
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id,company_id,customer_id,name,customers(name,email)")
    .eq("id", claim.job_id)
    .eq("company_id", claim.company_id)
    .single();
  if (jobError || !job) throw new Error("Queued job no longer exists");

  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  if (!customer?.email) throw new Error("Customer email is missing");

  const { data: company } = await supabase
    .from("companies")
    .select("name,logo_path")
    .eq("id", claim.company_id)
    .single();

  const { data: updateEvents, error: updateEventsError } = await supabase
    .from("job_update_events")
    .select("change_summaries")
    .eq("claim_token", claimToken)
    .eq("job_id", claim.job_id)
    .eq("company_id", claim.company_id);
  if (updateEventsError) throw new Error("Could not load the queued job changes");
  const changeSummaries = digestChangeSummaries((updateEvents || []) as JobUpdateEvent[]);

  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  const portalLink = `${appBaseUrl.replace(/\/$/, "")}/?portal=${encodeURIComponent(token)}`;

  const { data: newLink, error: linkError } = await supabase.from("magic_links").insert({
    job_id: job.id,
    customer_id: job.customer_id,
    company_id: job.company_id,
    token_hash: tokenHash,
    sent_to: customer.email,
    channel: "email",
    message_type: "job_update",
    expires_at: expiresAt,
  }).select("id").single();
  if (linkError || !newLink) throw new Error("Could not create the customer portal link");

  const companyName = company?.name || "Service Portal";
  const logoUrl = company?.logo_path
    ? supabase.storage.from(brandingBucket).getPublicUrl(company.logo_path).data.publicUrl
    : "";
  const logoMarkup = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}" width="180" style="display:block;width:auto;max-width:180px;height:auto;max-height:72px;margin:0 0 10px;border:0;object-fit:contain;" />`
    : "";
  const brandMarkup = `${logoMarkup}<p style="margin:0;font-size:17px;font-weight:700;line-height:1.3;color:#172326;">${escapeHtml(companyName)}</p>`;
  const message = "Your job has been updated.";
  const safePortalLink = escapeHtml(portalLink);
  const plainTextChanges = changeSummaries.map((summary) => `- ${summary}`).join("\n");
  const htmlChanges = changeSummaries
    .map((summary) => `<li style="margin:0 0 10px;padding-left:4px;">${escapeHtml(summary)}</li>`)
    .join("");
  const emailResult = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: customer.email,
      subject: `${companyName}: ${job.name || "Your job"} was updated`,
      text: `${companyName}\n\n${message}\n\n${job.name || "Your job"}\n\nWhat changed:\n${plainTextChanges}\n\nView your job: ${portalLink}\n\nThis secure link expires in 7 days.`,
      html: `
        <div style="margin:0;padding:28px 14px;background:#eef2f6;font-family:Arial,Helvetica,sans-serif;color:#172326;">
          <div style="max-width:560px;margin:0 auto;overflow:hidden;background:#ffffff;border:1px solid #d7dee6;border-radius:8px;">
            <div style="padding:24px 28px;border-bottom:1px solid #e5e9ee;">
              ${brandMarkup}
            </div>
            <div style="padding:30px 28px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1px;color:#2f6fed;text-transform:uppercase;">Job update</p>
              <h1 style="margin:0 0 10px;font-size:26px;line-height:1.25;color:#172326;">${escapeHtml(job.name || "Your job")}</h1>
              <p style="margin:0 0 24px;font-size:17px;line-height:1.55;color:#44515d;">${message}</p>
              <div style="margin:0 0 26px;padding:18px 20px;background:#f6f8fb;border-left:4px solid #2f6fed;border-radius:4px;">
                <p style="margin:0 0 13px;font-size:14px;font-weight:700;color:#172326;">What changed</p>
                <ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.5;color:#34414c;">${htmlChanges}</ul>
              </div>
              <a href="${safePortalLink}" style="display:inline-block;padding:13px 20px;background:#2f6fed;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:700;">View job details</a>
              <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#6b7785;">This secure link expires in 7 days. A newer customer email will replace it.</p>
            </div>
          </div>
        </div>
      `,
    }),
  });

  const resendBody = await emailResult.text();
  if (!emailResult.ok) {
    await supabase.from("magic_links").delete().eq("id", newLink.id);
    throw new Error(resendFailure(emailResult.status, resendBody));
  }

  let providerMessageId: string | null = null;
  try {
    providerMessageId = String(JSON.parse(resendBody)?.id || "") || null;
  } catch {
    providerMessageId = null;
  }
  if (providerMessageId) {
    await supabase.from("magic_links").update({ provider_message_id: providerMessageId }).eq("id", newLink.id);
  }

  await supabase
    .from("magic_links")
    .update({ expires_at: now })
    .eq("job_id", job.id)
    .neq("id", newLink.id)
    .lte("created_at", now)
    .gt("expires_at", now);

  return providerMessageId;
}

serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = serviceRoleKey();
  const appBaseUrl = Deno.env.get("APP_BASE_URL");
  const fromEmail = Deno.env.get("FROM_EMAIL") || "Service Portal <onboarding@resend.dev>";
  if (!resendApiKey || !supabaseUrl || !serviceKey || !appBaseUrl) {
    return jsonResponse({ error: "Server is missing required environment variables" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const presentedSecret = req.headers.get("x-digest-secret") || "";
  const { data: validSecret, error: secretError } = await supabase.rpc("validate_job_digest_cron_secret", {
    input_secret: presentedSecret,
  });
  if (secretError || validSecret !== true) return jsonResponse({ error: "Unauthorized" }, 401);

  const claimToken = crypto.randomUUID();
  const { data: claimData, error: claimError } = await supabase.rpc("claim_due_job_update_digests", {
    input_claim_token: claimToken,
    input_max_jobs: 25,
  });
  if (claimError) {
    console.error("Could not claim due customer digests", { code: claimError.code });
    return jsonResponse({ error: "Could not claim due digests" }, 500);
  }

  const claims = (claimData || []) as DigestClaim[];
  let sent = 0;
  let failed = 0;
  for (const claim of claims) {
    try {
      const providerMessageId = await sendDigestForJob(
        supabase,
        claim,
        claimToken,
        resendApiKey,
        appBaseUrl,
        fromEmail,
      );
      const { error: completeError } = await supabase
        .from("job_update_events")
        .update({
          processed_at: new Date().toISOString(),
          provider_message_id: providerMessageId,
          claimed_at: null,
          claim_token: null,
          last_error: null,
        })
        .eq("claim_token", claimToken)
        .eq("job_id", claim.job_id);
      if (completeError) throw new Error("Email sent, but the digest queue could not be completed");
      sent += 1;
    } catch (error) {
      failed += 1;
      const message = (error instanceof Error ? error.message : String(error || "Digest delivery failed")).slice(0, 500);
      console.error("Customer job digest failed", { jobId: claim.job_id, message });
      await supabase
        .from("job_update_events")
        .update({ claimed_at: null, claim_token: null, last_error: message })
        .eq("claim_token", claimToken)
        .eq("job_id", claim.job_id);
    }
  }

  await supabase
    .from("job_update_events")
    .delete()
    .not("processed_at", "is", null)
    .lt("processed_at", new Date(Date.now() - 90 * 86_400_000).toISOString());

  return jsonResponse({ ok: true, claimed: claims.length, sent, failed });
});
