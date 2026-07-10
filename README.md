# Service Job Portal

Standalone early-access build for a SaaS customer portal that can fit roofing, plumbing, HVAC, electrical, tiling, and other service businesses.

## Open

Open `index.html` in a browser. The app stores demo data in local storage.

## Beta Backend Direction

The app can stay on GitHub Pages as the visible front door. Supabase should handle the database, login records, and secure customer access records. Resend should send customer access emails from a Supabase Edge Function so the Resend API key never appears in browser code.

Use `.env.example` as the local checklist, but do not commit real API keys.

### Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Add these Edge Function secrets inside Supabase:
   - `RESEND_API_KEY`
   - `APP_BASE_URL`
   - `FROM_EMAIL`
   Supabase provides `SUPABASE_URL` and `SUPABASE_SECRET_KEYS` by default.
4. Deploy `supabase/functions/send-magic-link`.

The frontend has a local fallback, but once the schema and function are deployed it can create/sign in contractor accounts, create a company workspace, save jobs/custom fields/billing settings to Supabase, and send customer access emails through Resend.

### Subscription Direction

Contractors start with a 7-day trial, then the intended plan is `$12.99/month`. The schema stores subscription status, trial dates, and simple promo codes such as `20off` and `30off`.

This build does not collect cards directly. The next production bridge should use Stripe Checkout or Stripe Billing so Stripe handles cards, receipts, trial conversion, subscription cancellation, and promo enforcement.

## Included MVP Flows

- Contractor dashboard with `Start a job` and `Update a job`
- Generic service-industry job records
- Billing provider selection and simulated connection state
- Contractor account sign-up/sign-in with a 7-day trial model
- Simple promo-code tracking for future Stripe checkout
- Custom job field builder
- Customer access email flow through Resend
- Customer portal for status visibility, estimate responses, and document uploads
- Insurance claim and general document upload tracking
