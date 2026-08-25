import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MAX_ENVELOPE = 1024 * 1024;
const encoder = new TextEncoder();

function serviceRoleKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) try { const keys = Object.values(JSON.parse(raw)).filter((v): v is string => typeof v === "string"); return keys.find(k => k.startsWith("sb_secret_")) || keys[0]; } catch { /* fall through */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}
function cors(req: Request) { const origin = req.headers.get("origin") || ""; return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info", "Access-Control-Allow-Methods": "POST,OPTIONS", "Cache-Control": "no-store", Vary: "Origin" }; }
function json(req: Request, body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "content-type": "application/json" } }); }
function bytes(value: string) { return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0)); }
function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
function hex(bytes: Uint8Array) { return Array.from(bytes).map(x => x.toString(16).padStart(2, "0")).join(""); }
async function hash(value: string) { return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(value))); }
async function currentUser(req: Request, url: string, service: string) { const token = req.headers.get("Authorization"); if (!token) return null; const auth = createClient(url, service, { global: { headers: { Authorization: token } } }); const { data } = await auth.auth.getUser(); return data.user || null; }
function asKey(value: unknown) { if (typeof value !== "string") throw new Error("Invalid public key"); const result = bytes(value); if (result.length < 32 || result.length > 4096) throw new Error("Invalid public key"); return result; }

serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), service = serviceRoleKey();
  if (!url || !service) return json(req, { error: "Service unavailable" }, 503);
  const user = await currentUser(req, url, service); if (!user) return json(req, { error: "Unauthorized" }, 401);
  let body: Record<string, unknown>; try { body = await req.json(); } catch { return json(req, { error: "Invalid request" }, 400); }
  const db = createClient(url, service); const action = String(body.action || "");
  try {
    if (action === "register-device") {
      const name = String(body.name || "Android device").trim(); if (!name || name.length > 80) throw new Error("Invalid device name");
      const { data, error } = await db.from("messaging_devices").insert({ user_id: user.id, device_name: name, identity_key: "\\x" + hex(asKey(body.identityKey)), signed_prekey: "\\x" + hex(asKey(body.signedPrekey)), signed_prekey_signature: "\\x" + hex(asKey(body.signedPrekeySignature)) }).select("id,device_name,created_at").single(); if (error) throw error; return json(req, { device: data });
    }
    const deviceId = String(body.deviceId || ""); const { data: device } = await db.from("messaging_devices").select("id").eq("id", deviceId).eq("user_id", user.id).is("revoked_at", null).maybeSingle(); if (!device) return json(req, { error: "Unknown device" }, 403);
    if (action === "create-pairing") {
      const secret = crypto.getRandomValues(new Uint8Array(32)); const secretText = b64(secret); const digest = await hash(secretText); const expires = new Date(Date.now() + 15 * 60_000).toISOString();
      const { data, error } = await db.from("messaging_pairings").insert({ initiator_device_id: deviceId, invitation_hash: "\\x" + hex(digest), expires_at: expires }).select("id,expires_at").single(); if (error) throw error; return json(req, { pairing: data, invitation: secretText });
    }
    if (action === "join-pairing") {
      const invite = String(body.invitation || ""); if (!invite) throw new Error("Invitation required"); const digest = await hash(invite);
      const { data, error } = await db.rpc("claim_messaging_pairing", { invitation_hash_input: "\\x" + hex(digest), joining_device: deviceId }); if (error || !data) throw error || new Error("Could not claim invitation");
      const peer = String(data.initiator_device_id); const { data: peerKey, error: keyError } = await db.from("messaging_devices").select("id,identity_key,signed_prekey,signed_prekey_signature").eq("id", peer).single(); if (keyError) throw keyError; return json(req, { pairingId: data.id, peer: peerKey });
    }
    if (action === "enqueue-envelope") {
      const recipient = String(body.recipientDeviceId || ""), ciphertext = bytes(String(body.ciphertext || "")); if (!recipient || ciphertext.length < 1 || ciphertext.length > MAX_ENVELOPE) throw new Error("Invalid envelope");
      const { data: pairing } = await db.from("messaging_pairings").select("id").or(`and(initiator_device_id.eq.${deviceId},joined_device_id.eq.${recipient}),and(initiator_device_id.eq.${recipient},joined_device_id.eq.${deviceId})`).not("consumed_at", "is", null).maybeSingle(); if (!pairing) return json(req, { error: "Devices are not paired" }, 403);
      const header = typeof body.header === "object" && body.header ? body.header : {}; const { data, error } = await db.from("messaging_envelopes").insert({ sender_device_id: deviceId, recipient_device_id: recipient, header, ciphertext: "\\x" + hex(ciphertext) }).select("id,created_at").single(); if (error) throw error; return json(req, { envelope: data });
    }
    if (action === "poll-envelopes") { const { data, error } = await db.from("messaging_envelopes").select("id,sender_device_id,header,ciphertext,created_at").eq("recipient_device_id", deviceId).is("delivered_at", null).gt("expires_at", new Date().toISOString()).order("created_at").limit(100); if (error) throw error; return json(req, { envelopes: data || [] }); }
    if (action === "ack-envelope") { const id = String(body.envelopeId || ""); const { error } = await db.from("messaging_envelopes").update({ delivered_at: new Date().toISOString() }).eq("id", id).eq("recipient_device_id", deviceId).is("delivered_at", null); if (error) throw error; return json(req, { ok: true }); }
    if (action === "revoke-device") { const id = String(body.targetDeviceId || deviceId); const { error } = await db.from("messaging_devices").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id); if (error) throw error; return json(req, { ok: true }); }
    return json(req, { error: "Unknown action" }, 400);
  } catch (error) { console.error("secure-message failed", { action, message: error instanceof Error ? error.message : "unknown" }); return json(req, { error: "Request could not be completed" }, 400); }
});
