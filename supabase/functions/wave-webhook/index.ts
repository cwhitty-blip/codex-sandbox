import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type WaveEvent = {
  event_id?: string;
  event_type?: string;
  business_id?: string;
  data?: Record<string, unknown>;
};

const supportedEvents = new Set(["checkout.paid", "invoice.paid", "invoice.overdue"]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
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

function billingEnabled() {
  return Deno.env.get("WAVE_BILLING_ENABLED")?.toLowerCase() === "true";
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(secret: string, message: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifyWaveSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => part.trim().split("=", 2)),
  );
  const timestamp = parts.t;
  const receivedSignature = parts.v1;
  if (!timestamp || !receivedSignature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expectedSignature = await hmacSha256(secret, `${timestamp}.${rawBody}`);
  return constantTimeEqual(expectedSignature, receivedSignature);
}

function eventSummary(event: WaveEvent) {
  const data = event.data || {};
  return {
    business_id: event.business_id || null,
    checkout_id: data.checkout_id || null,
    invoice_id: data.invoice_id || null,
    customer_id: data.customer_id || null,
    amount: data.amount || data.amount_paid || null,
    currency_code: data.currency_code || null,
    paid_at: data.paid_at || data.paid_date || null,
    due_date: data.due_date || null,
  };
}

function waveGlobalId(value: string) {
  return btoa(value);
}

function rawWaveCustomerId(value: string) {
  try {
    const decoded = atob(value);
    const match = decoded.match(/(?:^|;)Customer:([^;]+)$/);
    return match?.[1] || "";
  } catch {
    return value;
  }
}

async function waveGraphql(accessToken: string, query: string, variables: Record<string, unknown>) {
  const response = await fetch("https://gql.waveapps.com/graphql/public", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) return null;
  const body = await response.json();
  if (body?.errors?.length) return null;
  return body?.data || null;
}

async function waveCustomerByEmail(accessToken: string, businessId: string, email: string) {
  const data = await waveGraphql(
    accessToken,
    `query CustomerByEmail($businessId: ID!, $email: String!) {
      business(id: $businessId) {
        customers(page: 1, pageSize: 2, email: $email) {
          edges { node { id email } }
        }
      }
    }`,
    { businessId: waveGlobalId(`Business:${businessId}`), email },
  );
  const customers = data?.business?.customers?.edges || [];
  if (customers.length !== 1) return null;
  return {
    id: rawWaveCustomerId(String(customers[0]?.node?.id || "")),
    email: String(customers[0]?.node?.email || "").trim().toLowerCase(),
  };
}

async function waveCustomerById(accessToken: string, businessId: string, customerId: string) {
  const data = await waveGraphql(
    accessToken,
    `query CustomerById($businessId: ID!, $customerId: ID!) {
      business(id: $businessId) {
        customer(id: $customerId) { id email }
      }
    }`,
    {
      businessId: waveGlobalId(`Business:${businessId}`),
      customerId: waveGlobalId(`Business:${businessId};Customer:${customerId}`),
    },
  );
  const customer = data?.business?.customer;
  if (!customer) return null;
  return {
    id: rawWaveCustomerId(String(customer.id || customerId)),
    email: String(customer.email || "").trim().toLowerCase(),
  };
}

function validDate(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function nextMonthlyPeriod(value: unknown) {
  const date = validDate(value);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString();
}

serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  // The endpoint is intentionally inert until launch secrets explicitly enable it.
  if (!billingEnabled()) return jsonResponse({ ok: true, billing: "disabled" });

  const webhookSecret = Deno.env.get("WAVE_WEBHOOK_SECRET");
  const expectedCheckoutId = Deno.env.get("WAVE_CHECKOUT_ID");
  const expectedBusinessId = Deno.env.get("WAVE_BUSINESS_ID") || "";
  const waveAccessToken = Deno.env.get("WAVE_ACCESS_TOKEN") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = serviceRoleKey();
  if (
    !webhookSecret
    || !expectedCheckoutId
    || !expectedBusinessId
    || !waveAccessToken
    || !supabaseUrl
    || !serviceKey
  ) {
    return jsonResponse({ error: "Billing server is not configured" }, 503);
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-wave-signature") || "";
  if (!await verifyWaveSignature(rawBody, signature, webhookSecret)) {
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  let event: WaveEvent;
  try {
    event = JSON.parse(rawBody) as WaveEvent;
  } catch {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }
  if (!event.event_id || !event.event_type) return jsonResponse({ error: "Incomplete event" }, 400);

  const supabase = createClient(supabaseUrl, serviceKey);
  const summary = eventSummary(event);
  let { data: billingEvent, error: eventError } = await supabase
    .from("billing_events")
    .insert({
      provider: "wave",
      provider_event_id: event.event_id,
      event_type: event.event_type,
      status: "received",
      event_summary: summary,
    })
    .select("id")
    .single();

  if (eventError?.code === "23505") {
    const { data: existingEvent, error: existingError } = await supabase
      .from("billing_events")
      .select("id,status,received_at")
      .eq("provider", "wave")
      .eq("provider_event_id", event.event_id)
      .single();
    if (existingError || !existingEvent) return jsonResponse({ error: "Could not inspect prior event" }, 500);
    if (["processed", "ignored", "unmatched"].includes(existingEvent.status)) {
      return jsonResponse({ ok: true, duplicate: true });
    }
    const eventAgeMs = Date.now() - new Date(existingEvent.received_at).getTime();
    if (existingEvent.status === "received" && eventAgeMs < 30_000) {
      return jsonResponse({ error: "Event is already processing" }, 503);
    }
    billingEvent = existingEvent;
    eventError = null;
    await supabase.from("billing_events").update({
      status: "received",
      error_message: null,
      processed_at: null,
    }).eq("id", existingEvent.id);
  }
  if (eventError || !billingEvent) return jsonResponse({ error: "Could not record event" }, 500);

  if (!supportedEvents.has(event.event_type)) {
    await supabase.from("billing_events").update({
      status: "ignored",
      processed_at: new Date().toISOString(),
    }).eq("id", billingEvent.id);
    return jsonResponse({ ok: true, ignored: true });
  }

  const data = event.data || {};
  if (expectedBusinessId && String(event.business_id || "") !== expectedBusinessId) {
    await supabase.from("billing_events").update({
      status: "ignored",
      error_message: "Event does not match the configured Wave business",
      processed_at: new Date().toISOString(),
    }).eq("id", billingEvent.id);
    return jsonResponse({ ok: true, ignored: true });
  }

  if (event.event_type === "checkout.paid" && String(data.recurrence_unit || "") !== "monthly") {
    await supabase.from("billing_events").update({
      status: "ignored",
      error_message: "Checkout is not a monthly recurring payment",
      processed_at: new Date().toISOString(),
    }).eq("id", billingEvent.id);
    return jsonResponse({ ok: true, ignored: true });
  }

  let subscriptionQuery = supabase
    .from("company_subscriptions")
    .select("company_id,billing_mode,billing_email,plan_price_cents,external_checkout_id,external_customer_id")
    .eq("provider", "wave")
    .eq("billing_mode", "wave");

  let resolvedCustomerId = "";

  if (event.event_type === "checkout.paid") {
    const email = String(data.email || "").trim();
    if (!email) {
      await supabase.from("billing_events").update({
        status: "unmatched",
        error_message: "Checkout event has no billing email",
        processed_at: new Date().toISOString(),
      }).eq("id", billingEvent.id);
      return jsonResponse({ ok: true, unmatched: true });
    }
    subscriptionQuery = subscriptionQuery.ilike("billing_email", email);
  } else {
    const customerId = String(data.customer_id || "");
    if (!customerId) {
      await supabase.from("billing_events").update({
        status: "unmatched",
        error_message: "Invoice event has no customer identifier",
        processed_at: new Date().toISOString(),
      }).eq("id", billingEvent.id);
      return jsonResponse({ ok: true, unmatched: true });
    }
    resolvedCustomerId = customerId;
    subscriptionQuery = subscriptionQuery.eq("external_customer_id", customerId);
  }

  let { data: subscriptions, error: subscriptionError } = await subscriptionQuery.limit(2);
  if (
    !subscriptionError
    && (!subscriptions || subscriptions.length === 0)
    && event.event_type.startsWith("invoice.")
    && waveAccessToken
    && event.business_id
  ) {
    const waveCustomer = await waveCustomerById(
      waveAccessToken,
      String(event.business_id),
      String(data.customer_id || ""),
    );
    if (waveCustomer?.email) {
      const fallback = await supabase
        .from("company_subscriptions")
        .select("company_id,billing_mode,billing_email,plan_price_cents,external_checkout_id,external_customer_id")
        .eq("provider", "wave")
        .eq("billing_mode", "wave")
        .ilike("billing_email", waveCustomer.email)
        .limit(2);
      subscriptions = fallback.data;
      subscriptionError = fallback.error;
      resolvedCustomerId = waveCustomer.id || String(data.customer_id || "");
    }
  }
  if (subscriptionError) {
    await supabase.from("billing_events").update({
      status: "error",
      error_message: "Could not match subscription",
    }).eq("id", billingEvent.id);
    return jsonResponse({ error: "Could not match subscription" }, 500);
  }
  if (!subscriptions || subscriptions.length !== 1) {
    await supabase.from("billing_events").update({
      status: "unmatched",
      error_message: subscriptions?.length ? "Multiple subscription matches" : "No subscription match",
      processed_at: new Date().toISOString(),
    }).eq("id", billingEvent.id);
    return jsonResponse({ ok: true, unmatched: true });
  }

  const subscription = subscriptions[0];
  const now = new Date().toISOString();
  const paid = event.event_type === "checkout.paid" || event.event_type === "invoice.paid";

  if (event.event_type === "checkout.paid") {
    const permittedCheckoutId = String(subscription.external_checkout_id || expectedCheckoutId);
    if (String(data.checkout_id || "") !== permittedCheckoutId) {
      await supabase.from("billing_events").update({
        company_id: subscription.company_id,
        status: "ignored",
        error_message: "Checkout does not match this subscription",
        processed_at: now,
      }).eq("id", billingEvent.id);
      return jsonResponse({ ok: true, ignored: true });
    }
    if (waveAccessToken && event.business_id && subscription.billing_email) {
      const waveCustomer = await waveCustomerByEmail(
        waveAccessToken,
        String(event.business_id),
        String(subscription.billing_email),
      );
      resolvedCustomerId = waveCustomer?.id || "";
    }
  }

  if (paid) {
    const rawAmount = data.amount || data.amount_paid;
    const amountCents = Math.round(Number(rawAmount) * 100);
    const currency = String(data.currency_code || "").toUpperCase();
    if (!Number.isFinite(amountCents) || amountCents < Number(subscription.plan_price_cents) || currency !== "USD") {
      await supabase.from("billing_events").update({
        company_id: subscription.company_id,
        status: "ignored",
        error_message: "Payment does not match the configured USD plan amount",
        processed_at: now,
      }).eq("id", billingEvent.id);
      return jsonResponse({ ok: true, ignored: true });
    }
  }
  const paidAt = data.paid_at || data.paid_date || now;
  const subscriptionUpdate: Record<string, unknown> = {
    status: paid ? "active" : "past_due",
    external_business_id: event.business_id || null,
    external_customer_id: resolvedCustomerId || subscription.external_customer_id || undefined,
    external_checkout_id: event.event_type === "checkout.paid" ? data.checkout_id || null : undefined,
    last_invoice_id: event.event_type.startsWith("invoice.") ? data.invoice_id || null : undefined,
    last_paid_at: paid ? paidAt : undefined,
    current_period_starts_at: paid ? validDate(paidAt).toISOString() : undefined,
    current_period_ends_at: paid ? nextMonthlyPeriod(paidAt) : undefined,
    grace_ends_at: paid ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    cancel_at_period_end: paid ? false : undefined,
    cancelled_at: paid ? null : undefined,
    last_event_at: now,
    last_reconciled_at: now,
    updated_at: now,
  };

  const { error: updateError } = await supabase
    .from("company_subscriptions")
    .update(subscriptionUpdate)
    .eq("company_id", subscription.company_id);
  if (updateError) {
    await supabase.from("billing_events").update({
      company_id: subscription.company_id,
      status: "error",
      error_message: "Could not update subscription",
    }).eq("id", billingEvent.id);
    return jsonResponse({ error: "Could not update subscription" }, 500);
  }

  await supabase.from("billing_events").update({
    company_id: subscription.company_id,
    status: "processed",
    processed_at: now,
  }).eq("id", billingEvent.id);
  return jsonResponse({ ok: true });
});
