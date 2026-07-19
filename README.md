# Service Job Portal

Early-access SaaS customer portal for service businesses. Contractors manage jobs and documents; customers use a time-limited email link to review estimates and upload insurance files.

## Open

Open `index.html` for a quick local view, or serve the folder over HTTP for full Supabase authentication. The deployed build is hosted on GitHub Pages.

## Architecture

GitHub Pages serves the frontend. Supabase handles contractor authentication, tenant-separated database records, private document storage, and customer portal functions. Resend sends customer access emails from a Supabase Edge Function so its API key never appears in browser code.

### Supabase Setup

1. Create a Supabase project.
2. Apply the migrations in `supabase/migrations`, or run `supabase/schema.sql` for a new project.
3. Add these Edge Function secrets inside Supabase:
   - `RESEND_API_KEY`
   - `APP_BASE_URL`
   - `FROM_EMAIL`
   Supabase provides `SUPABASE_URL` and `SUPABASE_SECRET_KEYS` by default.
4. Deploy `supabase/functions/send-magic-link`, `supabase/functions/customer-portal`, `supabase/functions/workspace-settings`, and the dormant `supabase/functions/wave-webhook` endpoint.

The publishable Supabase key in `assets/config.js` is intended for browser use. Database row-level security protects company records. Secret Supabase and Resend keys belong only in Edge Function secrets.

### Subscription Direction

The intended plan is seven free days followed by `$12.99/month` through Wave. Billing remains explicitly disabled during early access.

This build does not collect cards directly. Wave will host the recurring checkout and payment collection. Supabase has a provider-neutral subscription record and an idempotent Wave webhook receiver, but the endpoint does nothing until `WAVE_BILLING_ENABLED` is deliberately set to `true` at launch. See `docs/wave-billing-foundation-2026-07-11.md`.

## Included MVP Flows

- Contractor dashboard with `Start a job` and `Update a job`
- Generic service-industry job records
- Billing provider preference for a future integration
- Contractor account sign-up/sign-in with a 7-day trial model
- Company profile and custom job field setup
- Custom job field builder
- Customer access email flow through Resend
- Automatic customer email after successful contractor job changes
- Contractor logo branding in the workspace, customer portal, and customer emails
- Optional company-wide mileage tracking with private per-job date and mileage records
- Customer portal for status visibility, estimate responses, and document uploads
- Insurance claim and general document upload tracking
- Exact-duplicate prevention plus archive and restore

## Release Checks

Before inviting a beta user, verify contractor sign-in, company setup, job creation, estimate upload, customer email delivery, estimate response, customer insurance upload, file opening, duplicate prevention, and archive/restore. Customer links expire after seven days, and sending a newer link invalidates the older one.
