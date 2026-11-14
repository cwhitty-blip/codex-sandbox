# Team and plan foundation — 2026-11-14

## Pricing model

- `free`: 5 active jobs, 1 active member, 250 MB uploaded files.
- `pocket_planner`: $12.99 per month, 50 active jobs, 5 GB uploaded files.
- `crew`: team-oriented plan; public price is intentionally deferred until team access is production-ready.
- Completed or paid jobs do not consume an active-job slot. Archived records remain available, but their files still consume storage.
- Capacity enforcement must fail closed on new jobs/uploads while preserving read access to existing data. Do not add automatic usage charges.

The migration adds nullable capacity fields so existing beta accounts remain unchanged until plan assignment and server-side enforcement are deployed together.

## Team model

Company roles are:

- `owner`: billing, company configuration, teams, assignments, and all jobs.
- `admin`: company configuration, teams, assignments, and all jobs.
- `office_manager`: teams, scheduling, assignments, and all jobs; no billing ownership.
- `crew_lead`: assigned jobs and crew workflow.
- `crew`: assigned jobs and field uploads.

The first migration adds `teams`, `team_members`, and `job_assignments`. It intentionally does **not** invite field users or narrow existing job RLS yet. Activating crew accounts before assigned-job RLS covers jobs, customers, documents, mileage, schedule exceptions, storage objects, and related RPCs would expose company-wide data.

## Required next increment

1. Add a server-side invitation function with expiration, one-time redemption, member-limit enforcement, and an audit record.
2. Add `member_can_access_job(job_id)` and apply it to every job-owned table and storage path.
3. Split field permissions: crew can update allowed job fields and upload files, but cannot delete jobs, change billing, edit company settings, or read private office notes.
4. Add owner/admin/office-manager UI for members, crews, and job assignment.
5. Add a field-worker view containing only assigned jobs, schedule, customer contact, allowed notes, and upload actions.
6. Add golden-path tests for cross-company isolation, unassigned-job denial, team reassignment, disabled members, and member/storage/job limits.
