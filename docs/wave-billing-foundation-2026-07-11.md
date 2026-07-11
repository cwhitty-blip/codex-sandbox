# Wave Billing Foundation

## Current State

Billing is off. Early-access contractors retain access without payment checks. No Wave Pro subscription, checkout URL, webhook secret, or payment credential is required in this state.

The browser configuration declares:

- `billingMode: "off"`
- `subscriptionProvider: "wave"`
- an empty `waveCheckoutUrl`

The server independently defaults `WAVE_BILLING_ENABLED` to false. Changing browser configuration alone cannot activate billing.

## Data Ownership

`company_subscriptions` is the server-only subscription record. It stores billing mode, status, plan price, billing email, trial dates, checkout URL, provider references, paid dates, and grace periods.

`billing_events` is the append-only provider event log. Wave event IDs are unique so a retried webhook cannot apply the same payment twice. Stored summaries omit checkout addresses, phone numbers, and other unnecessary personal data.

Both tables have row-level security enabled and grant no browser access to anonymous or authenticated users. Edge Functions use the Supabase server credential.

## Webhook Boundary

The public endpoint is:

`https://nzwygirmuolgwwvtjexw.supabase.co/functions/v1/wave-webhook`

While disabled, it returns a successful inert response and writes nothing. When enabled, it:

1. Verifies Wave's HMAC-SHA256 signature against the raw request body.
2. Rejects timestamps more than five minutes old.
3. Records each Wave event once.
4. Accepts only the configured checkout ID.
5. Requires a matching USD payment at or above the company's configured plan price.
6. Matches checkout payments by a pre-registered billing email.
7. Matches later invoice events by the Wave customer ID.
8. Marks paid subscriptions active and overdue subscriptions past due with a seven-day grace period.

The Wave business used for subscriptions should be dedicated to this SaaS product so unrelated invoices cannot affect application access.

## Launch Activation

Do not complete these steps until launch approval:

1. Apply all Supabase migrations and verify both billing tables exist.
2. Create the `$12.99` monthly recurring Wave Checkout.
3. Upgrade the Wave business to Pro.
4. Create a Wave application and configure `checkout.paid`, `invoice.paid`, and `invoice.overdue` webhooks.
5. Add `WAVE_WEBHOOK_SECRET` and `WAVE_CHECKOUT_ID` to Supabase Edge Function secrets.
6. Pre-register each company's billing email and set its subscription provider and billing mode to `wave`.
7. Test valid, duplicate, expired-signature, wrong-checkout, paid, and overdue events.
8. Set `WAVE_BILLING_ENABLED=true` only after the golden-path test passes.
9. Enable the checkout and access-enforcement UI in a separate reviewed release.

Promo codes and cancellation self-service are not activated by this foundation. They require a separate product decision and launch implementation.
