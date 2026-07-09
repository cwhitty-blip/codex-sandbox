# Service Job Portal

Standalone prototype for a SaaS customer portal that can fit roofing, plumbing, HVAC, electrical, tiling, and other service businesses.

## Open

Open `index.html` in a browser. The app stores demo data in local storage.

## Beta Backend Direction

The app can stay on GitHub Pages as the visible front door. Supabase should handle the database, login records, and magic-link records. Resend should send the magic-link emails from a Supabase Edge Function so the Resend API key never appears in browser code.

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

The frontend has a demo fallback, but once the schema and function are deployed it can sign in contractors, create a company workspace, save jobs/custom fields/billing settings to Supabase, and send customer magic-link emails through Resend.

## Included MVP Flows

- Contractor dashboard with `Start a job` and `Update a job`
- Generic service-industry job records
- Billing provider selection and simulated connection state
- Custom job field builder
- Customer magic-link send simulation by email or SMS
- Customer portal preview limited to status visibility and document uploads
- Insurance claim and general document upload tracking
