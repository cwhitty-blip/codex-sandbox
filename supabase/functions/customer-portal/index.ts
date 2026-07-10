import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type PortalRequest = {
  token: string;
  action?: "payload" | "decision" | "upload";
  documentId?: string;
  decision?: "accept" | "changes" | "reject";
  notes?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  contentBase64?: string;
  documentType?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const documentBucket = "job-documents";

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

function serviceRoleKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      const key = Object.values(parsed).find((value) => typeof value === "string") as string | undefined;
      if (key) return key;
    } catch {
      // Fall back to the legacy secret name below.
    }
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

function safeStorageName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function signedDocuments(supabase: ReturnType<typeof createClient>, documents: Array<Record<string, unknown>>) {
  return Promise.all(documents.map(async (doc) => {
    let previewUrl = "";
    if (doc.storage_file_id) {
      const { data } = await supabase.storage.from(documentBucket).createSignedUrl(String(doc.storage_file_id), 60 * 60);
      previewUrl = data?.signedUrl || "";
    } else {
      previewUrl = String(doc.storage_url || "");
    }
    return { ...doc, preview_url: previewUrl };
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = serviceRoleKey();
  if (!supabaseUrl || !serviceKey) return jsonResponse({ error: "Server is not configured" }, 500);

  const payload = (await req.json()) as PortalRequest;
  if (!payload.token) return jsonResponse({ error: "Portal link is missing" }, 400);

  const supabase = createClient(supabaseUrl, serviceKey);
  const tokenHash = await sha256(payload.token);
  const { data: link, error: linkError } = await supabase
    .from("magic_links")
    .select("*, jobs(*, customers(*), documents(*), estimate_acceptances(*))")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (linkError || !link?.jobs) return jsonResponse({ error: "Portal link is invalid or expired" }, 404);

  const action = payload.action || "payload";
  const job = link.jobs;
  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;

  if (!link.used_at) {
    await supabase.from("magic_links").update({ used_at: new Date().toISOString() }).eq("id", link.id);
  }

  if (action === "decision") {
    if (!payload.documentId || !payload.decision) return jsonResponse({ error: "Decision is incomplete" }, 400);
    const visibleEstimate = (job.documents || []).find((doc: Record<string, unknown>) =>
      doc.id === payload.documentId
      && doc.document_type === "Estimate"
      && doc.visibility === "Customer Visible"
    );
    if (!visibleEstimate) return jsonResponse({ error: "Estimate not found" }, 404);
    const decidedAt = new Date().toISOString();
    const { error } = await supabase.from("estimate_acceptances").insert({
      company_id: link.company_id,
      job_id: link.job_id,
      customer_id: link.customer_id,
      document_id: payload.documentId,
      decision_status: payload.decision,
      notes: payload.notes?.trim() || null,
      decided_at: decidedAt,
      accepted_at: decidedAt,
      user_agent: req.headers.get("user-agent") || null,
    });
    if (error) return jsonResponse({ error: "Could not save response" }, 500);
  }

  if (action === "upload") {
    if (!payload.fileName || !payload.contentBase64) return jsonResponse({ error: "Upload is incomplete" }, 400);
    const storagePath = `${link.company_id}/${link.job_id}/${crypto.randomUUID()}-${safeStorageName(payload.fileName)}`;
    const bytes = decodeBase64(payload.contentBase64);
    const { error: uploadError } = await supabase.storage.from(documentBucket).upload(storagePath, bytes, {
      contentType: payload.mimeType || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) return jsonResponse({ error: "Could not upload file" }, 500);
    const { error: insertError } = await supabase.from("documents").insert({
      company_id: link.company_id,
      job_id: link.job_id,
      name: payload.fileName,
      document_type: payload.documentType || "Insurance Claim",
      uploaded_by: "Customer",
      visibility: "Staff Only",
      status: "New",
      storage_provider: "supabase",
      storage_file_id: storagePath,
      storage_url: null,
      size_bytes: payload.size || bytes.length,
    });
    if (insertError) return jsonResponse({ error: "Could not save upload" }, 500);
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("jobs")
    .select("*, customers(*), documents(*), estimate_acceptances(*)")
    .eq("id", link.job_id)
    .single();

  if (refreshError || !refreshed) return jsonResponse({ error: "Could not load portal" }, 500);
  const documents = await signedDocuments(supabase, refreshed.documents || []);

  return jsonResponse({
    job: {
      ...refreshed,
      customers: refreshed.customers || customer,
      documents,
    },
  });
});
