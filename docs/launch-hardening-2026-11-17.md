# Pocket Planner launch hardening - 2026-11-17

## Scope

This release closes the pre-launch authorization, customer-link, plan-limit,
account-link, deletion, legal, and browser-integrity findings from the November
17 adversarial review.

## Access model

- Disabled memberships no longer satisfy company membership checks.
- Owners, administrators, and office managers can see and manage all jobs.
- Crew leads and crew members can see and update only jobs assigned directly to
  them or to one of their teams.
- Only owners and administrators can permanently delete a job.
- Company settings, branding, custom fields, customer creation, and customer
  contact edits are manager-only.
- Job documents, mileage, schedule exceptions, and estimate responses inherit
  the job assignment boundary.

## Retention

The normal removal action archives a job. Archive keeps the job and its child
records intact and removes it from current-work counts. Permanent deletion is a
separate owner/admin action with an explicit irreversible warning.

## Plan enforcement

- Free: 5 active jobs, 250 MB stored documents, 1 member.
- Pocket Planner and trial: 50 active jobs, 5 GB stored documents, 1 member.
- Crew foundation: 250 active jobs, 25 GB stored documents, 25 members.
- Completed, paid, and archived jobs do not consume active-job slots.
- Expired trials automatically transition to the free plan rather than becoming
  an unusable workspace.
- Existing records remain readable when a limit is reached. Limits block only
  new active work, stored bytes, or active memberships.

## Customer links and uploads

- The browser stores the portal credential in session storage and immediately
  removes it from the visible URL and browser history entry.
- Invalid or expired credentials are removed from session storage.
- Uploads remain limited to 10 MB and approved formats.
- File signatures are checked instead of trusting the browser MIME declaration.
- A customer job link is limited to 20 uploads per hour in addition to the
  company storage-plan limit.

## Public launch surface

- Authentication redirects use `https://pocketplanner.org`.
- The pricing page identifies paid enrollment as unavailable during beta.
- Expired beta trials fall back to the published free tier.
- Privacy, beta terms, and support pages are linked from public footers.
- Public pages define a content security policy.
- Third-party Supabase and Lucide scripts use Subresource Integrity hashes.

## Required deployment checks

1. Push `20261117090000_launch_hardening.sql` to the linked Supabase project.
2. Deploy the static site and edge function changes.
3. Verify account confirmation and password recovery return to
   `https://pocketplanner.org`.
4. Verify an owner sees all current test jobs.
5. Create a disabled test membership and confirm it cannot open the workspace.
6. Assign one test job to a crew membership and confirm only that job is visible.
7. Confirm archive, restore, and owner-only permanent deletion with test data.
8. Confirm the 6th free-plan active job and over-limit upload are rejected with
   readable messages.
9. Confirm customer PDF/image upload, estimate review, and customer decision.
10. Confirm privacy, terms, support, and pricing pages on desktop and mobile.
