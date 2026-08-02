# Wave Billing Foundation

## Current State

Billing is off. Early-access contractors retain access without payment checks. No Wave Pro subscription, checkout URL, webhook secret, or payment credential is required in this state.

The browser configuration declares:

- `billingMode: "off"`
- `subscriptionProvider: "wave"`
- an empty `waveCheckoutUrl`

The server independently defaults `WAVE_BILLING_ENABLED` to false. Changing browser configuration alone cannot activate billing.

## Data Ownership

`company_subscriptions` is the server-only subscription record. It stores billing mode, status, base and discounted plan prices, billing email, 14-day trial dates, checkout URL, provider references, paid dates, cancellation state, manual overrides, and grace periods.

`billing_events` is the append-only provider event log. Wave event IDs are unique so a retried webhook cannot apply the same payment twice. Stored summaries omit checkout addresses, phone numbers, and other unnecessary personal data.

Both tables have row-level security enabled and grant no browser access to anonymous or authenticated users. Edge Functions use the Supabase server credential.

## Webhook Boundary

The public endpoint is:

`https://nzwygirmuolgwwvtjexw.supabase.co/functions/v1/wave-webhook`

While disabled, it returns a successful inert response and writes nothing. When enabled, it:

1. Verifies Wave's HMAC-SHA256 signature against the raw request body.
2. Rejects timestamps more than five minutes old.
3. Records each Wave event once, while allowing previously failed events to retry until completed.
4. Accepts only the configured business and checkout IDs.
5. Requires a matching USD payment at or above the company's configured plan price.
6. Matches checkout payments by a pre-registered billing email.
7. Resolves and repairs Wave customer IDs through the Wave API when necessary.
8. Matches later invoice events by the Wave customer ID.
9. Marks paid subscriptions active and overdue subscriptions past due with a seven-day grace period.

The Wave business used for subscriptions should be dedicated to this SaaS product so unrelated invoices cannot affect application access.

## Starter Or Pro

Wave Starter can run a monthly recurring checkout once Wave approves the business for online payments. Starter has no monthly software fee; normal payment-processing fees apply. Pro is not required simply to charge `$12.99` every month.

Wave currently requires Pro for webhook delivery. That creates two supported operating modes:

- **Starter/manual:** Wave charges customers monthly. The owner reviews successful and failed payments in Wave and reconciles access in Supabase on a regular schedule.
- **Pro/automatic:** Wave delivers signed checkout, paid-invoice, and overdue-invoice events. The Edge Function updates access immediately and records every event.

Starter is sensible for the first handful of known beta contractors. Move to Pro before payment volume makes manual review unreliable, or sooner if instant access restoration is important.

## Launch Activation

Do not complete these steps until launch approval:

1. Apply all Supabase migrations and verify both billing tables exist.
2. Create the `$12.99` monthly recurring Wave Checkout.
3. Choose Starter/manual or Pro/automatic operation.
4. For Pro, create a Wave application with `checkout:read` and `invoice:read` scopes and configure `checkout.paid`, `invoice.paid`, and `invoice.overdue` webhooks.
5. For Pro, add `WAVE_WEBHOOK_SECRET`, `WAVE_CHECKOUT_ID`, `WAVE_BUSINESS_ID`, and `WAVE_ACCESS_TOKEN` to Supabase Edge Function secrets.
6. Pre-register each company's billing email and set its subscription provider to `wave`; use billing mode `manual` for Starter or `wave` for Pro.
7. Activate approved promo rows only after each code has its own correctly priced Wave checkout URL and checkout ID.
8. Test valid, duplicate, expired-signature, wrong-business, wrong-checkout, wrong-amount, paid, and overdue events.
9. Set `WAVE_BILLING_ENABLED=true` only for Pro and only after the golden-path test passes.
10. Change browser billing configuration and existing subscription rows in the same reviewed release.

## Manual Reconciliation

Starter does not deliver webhooks. At least weekly, and whenever a contractor reports a payment problem:

1. Review recurring checkout payments and failed invoices in Wave.
2. Match the Wave customer to the unique `billing_email` in `company_subscriptions`.
3. For a successful payment, set status to `active`, record `last_paid_at`, and extend `current_period_ends_at` by one month.
4. For an overdue payment, set status to `past_due` and set a seven-day `grace_ends_at`.
5. Record `last_reconciled_at` every time the account is checked.

Never mark access paid from an email, screenshot, or customer statement alone; verify the transaction inside Wave.

## Cancellation

Wave does not currently publish a recurring-invoice cancellation webhook. End the contractor's recurring invoice in Wave first, then set `cancel_at_period_end=true`, `cancelled_at`, and the paid-through `current_period_ends_at` in Supabase. The contractor remains active through that date and becomes read-only afterward. Refunds do not automatically end a Wave recurring invoice.

## Promo Codes

Promo definitions live in the server-only `billing_promo_codes` table. The seeded `20off` and `30off` codes are inactive by default. Each fixed Wave price needs its own monthly checkout; only then should its code, checkout URL, and external checkout ID be activated. The browser calls `apply_billing_promo_code`, which validates active dates and calculates the discounted plan price on the server.

Billing remains off until the owner deliberately completes the launch activation checklist.
