# Wave Billing Foundation

## Current State

Billing is off. Early-access contractors retain access without payment checks. No Wave Pro subscription, checkout URL, webhook secret, or payment credential is required in this state.

The browser configuration declares:

- `billingMode: "off"`
- `subscriptionProvider: "wave"`
- an empty `waveCheckoutUrl`

The server independently defaults `WAVE_BILLING_ENABLED` to false. Changing browser configuration alone cannot activate billing.

## Data Ownership

`company_subscriptions` is the server-only subscription record. It stores billing mode, status, base and discounted plan prices, billing email, 14-day trial dates, checkout URL, provider references, paid dates, cancellation state, manual overrides, notes, and grace periods.

`billing_events` is the append-only provider event log. Wave event IDs are unique so a retried webhook cannot apply the same payment twice. Stored summaries omit checkout addresses, phone numbers, and other unnecessary personal data.

`billing_payments` is the independent payment ledger. It records the company, amount, status, billing period, Wave references, and the administrator who reconciled the payment. It remains available even if Wave access changes.

`billing_change_log` records consequential coupon, plan, account, and payment actions. `platform_billing_admins` is the private allowlist for the owner-only billing dashboard at `/billing.html`.

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

Wave Starter can create recurring invoices and automatic payments once Wave approves the business for online payments. Automatic sending of recurring invoices is available to businesses that accept online payments through Wave; ordinary processing fees apply. Pro is not required simply to charge `$12.99` every month.

Wave currently requires Pro for webhook delivery. That creates two supported operating modes:

- **Starter/manual:** Wave charges customers monthly. The owner reviews successful and failed payments in Wave and records them in the portal billing dashboard on a regular schedule.
- **Pro/automatic:** Wave delivers signed checkout, paid-invoice, and overdue-invoice events. The Edge Function updates access immediately and records every event.

Starter is sensible for the first handful of known beta contractors. Move to Pro before payment volume makes manual review unreliable, or sooner if instant access restoration is important.

## Launch Activation

Do not complete these steps until launch approval:

1. Apply all Supabase migrations and verify both billing tables exist.
2. Create monthly recurring Wave Checkouts for `$12.99`, `$9.74`, `$6.50`, and `$3.25`.
3. Choose Starter/manual or Pro/automatic operation.
4. For Pro, create a Wave application with `checkout:read` and `invoice:read` scopes and configure `checkout.paid`, `invoice.paid`, and `invoice.overdue` webhooks.
5. For Pro, add `WAVE_WEBHOOK_SECRET`, `WAVE_CHECKOUT_ID`, `WAVE_BUSINESS_ID`, and `WAVE_ACCESS_TOKEN` to Supabase Edge Function secrets.
6. Pre-register each company's billing email and set its subscription provider to `wave`; use billing mode `manual` for Starter or `wave` for Pro.
7. Save each shared price-level checkout URL and checkout ID in the billing dashboard. Unique recipient codes map to those four price levels; a 100% code does not use Wave.
8. Test valid, duplicate, expired-signature, wrong-business, wrong-checkout, wrong-amount, paid, and overdue events.
9. Set `WAVE_BILLING_ENABLED=true` only for Pro and only after the golden-path test passes.
10. Change browser billing configuration and existing subscription rows in the same reviewed release.

## Manual Reconciliation

Starter does not deliver webhooks. At least weekly, and whenever a contractor reports a payment problem:

1. Review recurring checkout payments and failed invoices in Wave.
2. Match the Wave customer to the unique `billing_email` in `company_subscriptions`.
3. In `/billing.html`, open the contractor account and record the payment status, amount, date, and Wave reference.
4. A successful payment activates access and extends the paid-through date by one month. A failed payment starts the seven-day grace period.
5. Download the account spreadsheet periodically as an additional operational backup.

Never mark access paid from an email, screenshot, or customer statement alone; verify the transaction inside Wave.

## Cancellation

Wave does not currently publish a recurring-invoice cancellation webhook. End the contractor's recurring invoice in Wave first, then set `cancel_at_period_end=true`, `cancelled_at`, and the paid-through `current_period_ends_at` in Supabase. The contractor remains active through that date and becomes read-only afterward. Refunds do not automatically end a Wave recurring invoice.

## Unique Discount Codes

Promo definitions live in the server-only `billing_promo_codes` table. The owner dashboard generates a random one-use code assigned to a specific contractor email or company. New codes may be 25%, 50%, 75%, or 100% off. The contractor enters the code in the portal; `apply_billing_promo_code` validates the recipient, active dates, redemption limit, and price on the server.

The `$12.99` plan has four paid Wave price levels:

- Standard: `$12.99`
- 25% off: `$9.74`
- 50% off: `$6.50`
- 75% off: `$3.25`
- 100% off: `$0.00`, with no Wave checkout

Discounts continue until an administrator changes the account. A code expiration controls when the code may be redeemed; it does not silently remove a redeemed discount.

## Owner Dashboard

`/billing.html` is intentionally separate from contractor-to-customer billing preferences. It provides:

- account, trial, active, past-due, and complimentary summaries;
- one-use recipient coupon creation;
- account status and Wave-reference management;
- manual payment reconciliation into the independent ledger;
- shared Wave checkout configuration by price level; and
- a CSV spreadsheet export of the current account ledger.

Only users in `platform_billing_admins` can load or mutate this data. The first owner must be granted through the service-role-only `grant_platform_billing_admin` function after deployment.

## Wave References

- Recurring invoices and automatic payments: <https://support.waveapps.com/hc/en-us/articles/115002487743-Set-up-a-recurring-invoice>
- Invoice discounts: <https://support.waveapps.com/hc/en-us/articles/360044792291-Add-a-discount-to-an-invoice>
- Webhooks and Pro requirement: <https://developer.waveapps.com/hc/en-us/articles/51070420388628-Webhooks-Setup-Guide>

Billing remains off until the owner deliberately completes the launch activation checklist.
