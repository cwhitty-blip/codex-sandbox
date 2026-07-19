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

const documentBucket = "job-documents";
const brandingBucket = "company-branding";
const maxFileBytes = 10 * 1024 * 1024;
const maxRequestBytes = Math.ceil((maxFileBytes * 4) / 3) + 200_000;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

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
    "Referrer-Policy": "no-referrer",
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

function safeStorageName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
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

async function customerSafeJob(supabase: ReturnType<typeof createClient>, job: Record<string, unknown>) {
  const documents = ((job.documents || []) as Array<Record<string, unknown>>).filter((doc) =>
    doc.status !== "Archived"
    && (doc.visibility === "Customer Visible" || doc.uploaded_by === "Customer")
  );
  const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
  const decisions = ((job.estimate_acceptances || []) as Array<Record<string, unknown>>).map((decision) => ({
    document_id: decision.document_id,
    decision_status: decision.decision_status,
    notes: decision.notes,
    decided_at: decision.decided_at,
    accepted_at: decision.accepted_at,
  }));
  return {
    id: job.id,
    name: job.name,
    service_address: job.service_address,
    job_status: job.job_status,
    material_status: job.material_status,
    projected_date: job.projected_date,
    invoice_url: job.invoice_url,
    customers: customer ? { name: (customer as Record<string, unknown>).name } : null,
    documents: await signedDocuments(supabase, documents),
    estimate_acceptances: decisions,
  };
}

async function customerSafeCompany(supabase: ReturnType<typeof createClient>, companyId: string) {
  const { data: company } = await supabase
    .from("companies")
    .select("id,name,logo_path")
    .eq("id", companyId)
    .single();
  if (!company) return { id: companyId, name: "Service Portal", logo_url: "" };
  const logoUrl = company.logo_path
    ? supabase.storage.from(brandingBucket).getPublicUrl(company.logo_path).data.publicUrl
    : "";
  return { id: company.id, name: company.name, logo_url: logoUrl };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > maxRequestBytes) return jsonResponse(req, { error: "File is too large" }, 413);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = serviceRoleKey();
  if (!supabaseUrl || !serviceKey) return jsonResponse(req, { error: "Server is not configured" }, 500);

  let payload: PortalRequest;
  try {
    payload = (await req.json()) as PortalRequest;
  } catch {
    return jsonResponse(req, { error: "Request is invalid" }, 400);
  }
  if (!payload.token) return jsonResponse(req, { error: "Portal link is missing" }, 400);

  const supabase = createClient(supabaseUrl, serviceKey);
  const tokenHash = await sha256(payload.token);
  const { data: link, error: linkError } = await supabase
    .from("magic_links")
    .select("*, jobs(id,name,service_address,job_status,material_status,projected_date,invoice_url,customers(name),documents(id,name,document_type,uploaded_by,visibility,status,storage_file_id,storage_url,version,size_bytes,created_at),estimate_acceptances(document_id,decision_status,notes,decided_at,accepted_at))")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (linkError || !link?.jobs) return jsonResponse(req, { error: "Portal link is invalid or expired" }, 404);

  const action = payload.action || "payload";
  const job = link.jobs as Record<string, unknown>;
  if (!link.used_at) await supabase.from("magic_links").update({ used_at: new Date().toISOString() }).eq("id", link.id);

  if (action === "decision") {
    if (!payload.documentId || !payload.decision) return jsonResponse(req, { error: "Decision is incomplete" }, 400);
    if (!["accept", "changes", "reject"].includes(payload.decision)) {
      return jsonResponse(req, { error: "Decision is invalid" }, 400);
    }
    const visibleEstimate = ((job.documents || []) as Array<Record<string, unknown>>).find((doc) =>
      doc.id === payload.documentId
      && doc.document_type === "Estimate"
      && doc.visibility === "Customer Visible"
      && doc.status !== "Archived"
    );
    if (!visibleEstimate) return jsonResponse(req, { error: "Estimate not found" }, 404);
    if (payload.notes && payload.notes.length > 2000) return jsonResponse(req, { error: "Response is too long" }, 400);
    const decidedAt = new Date().toISOString();
    const { data: acceptance, error } = await supabase
      .from("estimate_acceptances")
      .insert({
        company_id: link.company_id,
        job_id: link.job_id,
        customer_id: link.customer_id,
        document_id: payload.documentId,
        decision_status: payload.decision,
        notes: payload.notes?.trim() || null,
        decided_at: decidedAt,
        accepted_at: decidedAt,
        user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
      })
      .select("id")
      .single();
    if (error) return jsonResponse(req, { error: "Could not save response" }, 500);
    const nextStatus = payload.decision === "accept"
      ? "Ready to Schedule"
      : payload.decision === "changes"
        ? "Waiting on Customer"
        : "On Hold";
    const { error: jobError } = await supabase.from("jobs").update({ job_status: nextStatus }).eq("id", link.job_id);
    if (jobError) {
      if (acceptance?.id) await supabase.from("estimate_acceptances").delete().eq("id", acceptance.id);
      return jsonResponse(req, { error: "Could not update job" }, 500);
    }
  }

  if (action === "upload") {
    if (!payload.fileName || !payload.contentBase64) return jsonResponse(req, { error: "Upload is incomplete" }, 400);
    if (payload.fileName.length > 180) return jsonResponse(req, { error: "File name is too long" }, 400);
    const mimeType = payload.mimeType || "application/octet-stream";
    if (!allowedMimeTypes.has(mimeType)) return jsonResponse(req, { error: "File type is not supported" }, 415);
    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(payload.contentBase64);
    } catch {
      return jsonResponse(req, { error: "File could not be read" }, 400);
    }
    if (!bytes.length || bytes.length > maxFileBytes) return jsonResponse(req, { error: "File must be 10 MB or smaller" }, 413);

    const documentType = payload.documentType || "Insurance Claim";
    const { data: duplicate } = await supabase
      .from("documents")
      .select("id")
      .eq("job_id", link.job_id)
      .eq("name", payload.fileName)
      .eq("size_bytes", bytes.length)
      .eq("document_type", documentType)
      .eq("uploaded_by", "Customer")
      .neq("status", "Archived")
      .maybeSingle();
    if (duplicate) return jsonResponse(req, { error: "That file is already uploaded" }, 409);

    const storagePath = `${link.company_id}/${link.job_id}/${crypto.randomUUID()}-${safeStorageName(payload.fileName)}`;
    const { error: uploadError } = await supabase.storage.from(documentBucket).upload(storagePath, bytes, {
      contentType: mimeType,
      upsert: false,
    });
    if (uploadError) return jsonResponse(req, { error: "Could not upload file" }, 500);
    const { error: insertError } = await supabase.from("documents").insert({
      company_id: link.company_id,
      job_id: link.job_id,
      name: payload.fileName,
      document_type: documentType,
      uploaded_by: "Customer",
      visibility: "Staff Only",
      status: "New",
      storage_provider: "supabase",
      storage_file_id: storagePath,
      storage_url: null,
      size_bytes: bytes.length,
    });
    if (insertError) {
      await supabase.storage.from(documentBucket).remove([storagePath]);
      return jsonResponse(req, { error: "Could not save upload" }, 500);
    }
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("jobs")
    .select("id,name,service_address,job_status,material_status,projected_date,invoice_url,customers(name),documents(id,name,document_type,uploaded_by,visibility,status,storage_file_id,storage_url,version,size_bytes,created_at),estimate_acceptances(document_id,decision_status,notes,decided_at,accepted_at)")
    .eq("id", link.job_id)
    .single();

  if (refreshError || !refreshed) return jsonResponse(req, { error: "Could not load portal" }, 500);
  return jsonResponse(req, {
    job: await customerSafeJob(supabase, refreshed as Record<string, unknown>),
    company: await customerSafeCompany(supabase, String(link.company_id)),
  });
});
