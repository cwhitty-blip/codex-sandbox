import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

function corsHeaders(req: Request) {
  const configuredBase = Deno.env.get("APP_BASE_URL") || "";
  const configuredOrigin = configuredBase ? new URL(configuredBase).origin : "";
  const requestOrigin = req.headers.get("origin") || "";
  const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin);
  return {
    "Access-Control-Allow-Origin": requestOrigin && (requestOrigin === configuredOrigin || localOrigin)
      ? requestOrigin
      : configuredOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "content-type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = serviceRoleKey();
  const authHeader = req.headers.get("Authorization");
  if (!supabaseUrl || !serviceKey) return jsonResponse(req, { error: "Server is not configured" }, 500);
  if (!authHeader) return jsonResponse(req, { error: "Unauthorized" }, 401);

  let name = "";
  let logoPath: string | null | undefined;
  try {
    const payload = await req.json();
    name = String(payload?.name || "").trim();
    logoPath = payload?.logoPath === null
      ? null
      : payload?.logoPath === undefined
        ? undefined
        : String(payload.logoPath).trim();
  } catch {
    return jsonResponse(req, { error: "Request is invalid" }, 400);
  }
  if (!name || name.length > 120) return jsonResponse(req, { error: "Company name is invalid" }, 400);

  const serviceClient = createClient(supabaseUrl, serviceKey);
  const authClient = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return jsonResponse(req, { error: "Unauthorized" }, 401);

  const { data: membership, error: membershipError } = await serviceClient
    .from("company_members")
    .select("company_id")
    .eq("user_id", authData.user.id)
    .order("created_at")
    .limit(1)
    .single();
  if (membershipError || !membership) return jsonResponse(req, { error: "Workspace not found" }, 404);

  if (logoPath !== undefined && logoPath !== null && !logoPath.startsWith(`${membership.company_id}/`)) {
    return jsonResponse(req, { error: "Company logo path is invalid" }, 400);
  }

  const updates: { name: string; logo_path?: string | null } = { name };
  if (logoPath !== undefined) updates.logo_path = logoPath || null;

  const { data: company, error: updateError } = await serviceClient
    .from("companies")
    .update(updates)
    .eq("id", membership.company_id)
    .select("id,name,logo_path")
    .single();
  if (updateError || !company) return jsonResponse(req, { error: "Could not save company profile" }, 500);

  return jsonResponse(req, { company });
});
