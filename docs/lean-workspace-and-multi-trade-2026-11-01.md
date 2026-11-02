# Lean Workspace and Multi-Trade Foundation

Date: 2026-11-01

## Product Direction

The contractor workspace should behave like a daily work surface, not a database editor. The first view now prioritizes one `New job` command, specific jobs that need attention, the next visits, and a compact job list. Job detail keeps the next action, customer, schedule, estimate, and parts state visible while files, billing, custom fields, private notes, mileage, and activity use progressive disclosure.

The visual direction uses the useful hierarchy from the Trump Accounts app reference: strong whitespace, plain labels, one obvious primary action, and secondary controls revealed only when needed. The portal does not copy that product's branding or onboarding behavior.

## Review Findings Addressed

- Removed the ambiguous global `Update a job` action. Editing now occurs only inside the named job.
- Replaced attention category counters with job-specific attention rows.
- Reduced the initial job form to core intake and next action; scheduling and operational fields are expandable.
- Added a dedicated list-to-detail flow on phones with a labeled Back control.
- Moved secondary job information into expandable sections.
- Renamed the explicit customer send action to `Send portal link`.
- Disclosed that saving a job adds an update to the next scheduled customer email.
- Added `Mark reviewed` for new customer uploads so attention can clear without archiving the file.
- Replaced roofing-specific customer upload language with a generic file workflow.

## Multi-Trade Contract

- A company enables one or more trades in Settings.
- A job has exactly one primary trade, stored in the existing `jobs.industry` column.
- When one trade is active, the job form assigns it automatically and hides the selector.
- When multiple trades are active, the job form requires a Trade selection and job lists show the trade label.
- Disabling a trade does not rewrite historical jobs. A historical job can still be edited while its trade remains unchanged.
- Multi-trade mode is derived from the number of enabled trades. There is no separate boolean flag.
- Trade settings are owner/admin-only and use a security-definer RPC with membership and workspace-write checks.
- A database trigger validates job trades for every write path, including future clients and direct table writes.

This release treats trade as classification only. It does not introduce trade-specific status systems, forms, calendars, crews, pricing, or customer workflows.

## Deployment Order

1. Apply `20261101110000_multi_trade_workspaces.sql`.
2. Deploy the updated `customer-portal` Edge Function.
3. Publish the cache-busted frontend.
4. Verify an existing single-trade workspace, then enable a second trade and create one test job.
5. Verify a secure customer portal can upload a generic file and the contractor can mark it reviewed.

The schema migration is additive and keeps `general` enabled for existing companies during backfill. Frontend rollback can occur without removing the new catalog or company column.

## Deferred Risks

- Status currently mixes lifecycle stage and blockers. A future release should separate stage from waiting reason.
- Jobs do not yet have technician or crew assignment, so there is no personal route or workload balancing.
- Workspace loading remains unpaginated and will need bounded queries as account volume grows.
- Customer notification changes are disclosed, but a future outbox should show queued, sent, failed, cancel, and retry states.
- Field use still depends on connectivity and CDN assets; offline capture and queued uploads remain future work.
- Company settings remain one long page. Task-based settings categories are the next major simplification after the daily workspace is validated.

## Verification

- `node --check assets/app.js`
- `node scripts/static-smoke.mjs`
- Desktop browser review at the local demo route
- Phone browser review at 390 by 844
- New-job multi-trade selector review
- Customer upload review transition
- Customer portal terminology review
- Browser console checked with no warnings or errors
