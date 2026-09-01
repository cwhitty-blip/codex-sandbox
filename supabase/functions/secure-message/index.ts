import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MAX_ENVELOPE = 1024 * 1024;
const MAX_HEADER = 16 * 1024;
const MAX_ENVELOPES_PER_MINUTE = 60;
const encoder = new TextEncoder();

function serviceRoleKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) try { const keys = Object.values(JSON.parse(raw)).filter((v): v is string => typeof v === "string"); return keys.find(k => k.startsWith("sb_secret_")) || keys[0]; } catch { /* fall through */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}
function cors(req: Request) { const origin = req.headers.get("origin") || ""; return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info", "Access-Control-Allow-Methods": "POST,OPTIONS", "Cache-Control": "no-store", Vary: "Origin" }; }
function json(req: Request, body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "content-type": "application/json" } }); }
function bytes(value: string) {
  if (!/^[A-Za-z0-9_-]*={0,2}$/.test(value)) throw new Error("Invalid base64url value");
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").replace(/=+$/, "");
  if (normalized.length % 4 === 1) throw new Error("Invalid base64url value");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  try { return Uint8Array.from(atob(padded), c => c.charCodeAt(0)); } catch { throw new Error("Invalid base64url value"); }
}
function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
function hex(bytes: Uint8Array) { return Array.from(bytes).map(x => x.toString(16).padStart(2, "0")).join(""); }
async function hash(value: string) { return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(value))); }
async function currentUser(req: Request, url: string, service: string) { const token = req.headers.get("Authorization"); if (!token) return null; const auth = createClient(url, service, { global: { headers: { Authorization: token } } }); const { data } = await auth.auth.getUser(); return data.user || null; }
function asKey(value: unknown) { if (typeof value !== "string") throw new Error("Invalid public key"); const result = bytes(value); if (result.length < 32 || result.length > 4096) throw new Error("Invalid public key"); return result; }
function asUuid(value: unknown, name: string) { const result = String(value || ""); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) throw new Error(`Invalid ${name}`); return result; }
function asInt(value: unknown, name: string, maximum = 2147483647) { const result = Number(value); if (!Number.isInteger(result) || result < 0 || result > maximum) throw new Error(`Invalid ${name}`); return result; }
function asHeader(value: unknown) { if (typeof value !== "object" || !value || Array.isArray(value)) throw new Error("Invalid envelope header"); const encoded = encoder.encode(JSON.stringify(value)); if (encoded.length > MAX_HEADER) throw new Error("Envelope header is too large"); return value; }
function firstRow<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] || null : value; }

async function bundleFor(db: ReturnType<typeof createClient>, deviceId: string) {
  const { data: device, error: deviceError } = await db.from("messaging_devices").select("id,registration_id,identity_key,signed_prekey_id,signed_prekey,signed_prekey_signature,kyber_prekey_id,kyber_prekey,kyber_prekey_signature").eq("id", deviceId).is("revoked_at", null).maybeSingle();
  if (deviceError) throw deviceError;
  if (!device || device.registration_id === null || device.signed_prekey_id === null || device.kyber_prekey_id === null || !device.kyber_prekey) throw new Error("Peer has no complete pre-key bundle");
  const { data: claimed, error: claimError } = await db.rpc("claim_messaging_prekey", { target_device: deviceId });
  if (claimError) throw claimError;
  const prekey = firstRow(claimed);
  if (!prekey) throw new Error("Peer has no unused one-time pre-key");
  return { ...device, one_time_prekey_id: prekey.key_id, one_time_prekey: prekey.public_key };
}

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
      const { data, error } = await db.rpc("register_messaging_device", {
        owner_id: user.id,
        device_name_input: name,
        registration_id_input: asInt(body.registrationId, "registration id", 16380),
        identity_key_input: "\\x" + hex(asKey(body.identityKey)),
        signed_prekey_id_input: asInt(body.signedPrekeyId, "signed pre-key id"),
        signed_prekey_input: "\\x" + hex(asKey(body.signedPrekey)),
        signed_prekey_signature_input: "\\x" + hex(asKey(body.signedPrekeySignature)),
        kyber_prekey_id_input: asInt(body.kyberPrekeyId, "Kyber pre-key id"),
        kyber_prekey_input: "\\x" + hex(asKey(body.kyberPrekey)),
        kyber_prekey_signature_input: "\\x" + hex(asKey(body.kyberPrekeySignature)),
        one_time_prekey_id_input: asInt(body.oneTimePrekeyId, "one-time pre-key id"),
        one_time_prekey_input: "\\x" + hex(asKey(body.oneTimePrekey)),
      });
      if (error) throw error;
      const device = firstRow(data); if (!device) throw new Error("Device was not registered");
      return json(req, { device: { id: device.id, device_name: device.device_name, created_at: device.created_at } });
    }
    const deviceId = asUuid(body.deviceId, "device id"); const { data: device } = await db.from("messaging_devices").select("id").eq("id", deviceId).eq("user_id", user.id).is("revoked_at", null).maybeSingle(); if (!device) return json(req, { error: "Unknown device" }, 403);
    if (action === "create-pairing") {
      const secret = crypto.getRandomValues(new Uint8Array(32)); const secretText = b64(secret); const digest = await hash(secretText); const expires = new Date(Date.now() + 15 * 60_000).toISOString();
      const { data, error } = await db.from("messaging_pairings").insert({ initiator_device_id: deviceId, invitation_hash: "\\x" + hex(digest), expires_at: expires }).select("id,expires_at").single(); if (error) throw error; return json(req, { pairing: data, invitation: secretText });
    }
    if (action === "join-pairing") {
      const invite = String(body.invitation || ""); if (!invite) throw new Error("Invitation required"); const digest = await hash(invite);
      const { data, error } = await db.rpc("claim_messaging_pairing", { invitation_hash_input: "\\x" + hex(digest), joining_device: deviceId }); if (error || !data) throw error || new Error("Could not claim invitation");
      const pairing = firstRow(data); if (!pairing) throw new Error("Could not claim invitation");
      const peer = String(pairing.initiator_device_id); return json(req, { pairingId: pairing.id, peer: await bundleFor(db, peer) });
    }
    if (action === "pairing-status") {
      const pairingId = asUuid(body.pairingId, "pairing id");
      const { data: pairing, error } = await db.from("messaging_pairings").select("id,joined_device_id,expires_at,consumed_at").eq("id", pairingId).eq("initiator_device_id", deviceId).maybeSingle();
      if (error) throw error; if (!pairing) return json(req, { error: "Pairing not found" }, 404);
      if (!pairing.joined_device_id || !pairing.consumed_at) return json(req, { paired: false, expiresAt: pairing.expires_at });
      return json(req, { paired: true, pairingId: pairing.id, peer: await bundleFor(db, String(pairing.joined_device_id)) });
    }
    if (action === "prekey-bundle") {
      const peer = asUuid(body.peerDeviceId, "peer device id");
      const { data: pairing } = await db.from("messaging_pairings").select("id").or(`and(initiator_device_id.eq.${deviceId},joined_device_id.eq.${peer}),and(initiator_device_id.eq.${peer},joined_device_id.eq.${deviceId})`).not("consumed_at", "is", null).maybeSingle();
      if (!pairing) return json(req, { error: "Devices are not paired" }, 403);
      return json(req, { bundle: await bundleFor(db, peer) });
    }
    if (action === "enqueue-envelope") {
      const recipient = asUuid(body.recipientDeviceId, "recipient device id"), ciphertext = bytes(String(body.ciphertext || "")); if (ciphertext.length < 1 || ciphertext.length > MAX_ENVELOPE) throw new Error("Invalid envelope");
      const minuteAgo = new Date(Date.now() - 60_000).toISOString();
      const { data: pairing } = await db.from("messaging_pairings").select("id").or(`and(initiator_device_id.eq.${deviceId},joined_device_id.eq.${recipient}),and(initiator_device_id.eq.${recipient},joined_device_id.eq.${deviceId})`).not("consumed_at", "is", null).maybeSingle(); if (!pairing) return json(req, { error: "Devices are not paired" }, 403);
      const { data: peer } = await db.from("messaging_devices").select("id").eq("id", recipient).is("revoked_at", null).maybeSingle(); if (!peer) return json(req, { error: "Recipient device is unavailable" }, 403);
      const { count, error: countError } = await db.from("messaging_envelopes").select("id", { count: "exact", head: true }).eq("sender_device_id", deviceId).gte("created_at", minuteAgo); if (countError) throw countError; if ((count || 0) >= MAX_ENVELOPES_PER_MINUTE) return json(req, { error: "Rate limit exceeded" }, 429);
      const clientMessageId = asUuid(body.clientMessageId, "client message id");
      const header = asHeader(body.header || {}); const { data, error } = await db.from("messaging_envelopes").insert({ sender_device_id: deviceId, recipient_device_id: recipient, client_message_id: clientMessageId, header, ciphertext: "\\x" + hex(ciphertext) }).select("id,created_at").single();
      if (error?.code === "23505") { const { data: existing } = await db.from("messaging_envelopes").select("id,created_at").eq("sender_device_id", deviceId).eq("client_message_id", clientMessageId).maybeSingle(); if (existing) return json(req, { envelope: existing, duplicate: true }); }
      if (error) throw error; return json(req, { envelope: data });
    }
    if (action === "poll-envelopes") { const { data, error } = await db.from("messaging_envelopes").select("id,sender_device_id,header,ciphertext,created_at").eq("recipient_device_id", deviceId).is("delivered_at", null).gt("expires_at", new Date().toISOString()).order("created_at").limit(100); if (error) throw error; return json(req, { envelopes: data || [] }); }
    if (action === "ack-envelope") { const id = asUuid(body.envelopeId, "envelope id"); const { data, error } = await db.from("messaging_envelopes").update({ delivered_at: new Date().toISOString() }).eq("id", id).eq("recipient_device_id", deviceId).is("delivered_at", null).select("id").maybeSingle(); if (error) throw error; if (!data) return json(req, { error: "Envelope not found" }, 404); return json(req, { ok: true }); }
    if (action === "revoke-device") { const id = body.targetDeviceId ? asUuid(body.targetDeviceId, "target device id") : deviceId; const { data, error } = await db.from("messaging_devices").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).is("revoked_at", null).select("id").maybeSingle(); if (error) throw error; if (!data) return json(req, { error: "Device not found" }, 404); return json(req, { ok: true }); }
    return json(req, { error: "Unknown action" }, 400);
  } catch (error) { console.error("secure-message failed", { action, message: error instanceof Error ? error.message : "unknown" }); return json(req, { error: "Request could not be completed" }, 400); }
});
