# Scheduling Foundation - 2026-08-02

## Shipped

- One shared schedule per company.
- Company time zone, working days, workday start/end, and between-job buffer.
- Estimated job duration and timed appointments.
- Earliest-available suggestions in 15-minute increments over the next 90 days.
- Weekly, biweekly, and monthly recurrence with an optional end date.
- Per-visit reschedule and skip exceptions without changing the remaining series.
- Upcoming visits on the contractor dashboard and next-visit details in the customer portal.
- Customer update email after a contractor reschedules or skips a visit.
- Tenant-scoped row-level security and subscription write enforcement for schedule changes.

## Calendar Integration Order

1. Google Calendar OAuth: read busy times and create/update portal appointments.
2. Private ICS subscription: read-only schedule display in Apple Calendar and other compatible calendars.
3. Microsoft Graph OAuth: Outlook busy-time and event synchronization.

The portal remains the scheduling source of truth. External calendars should store the provider event ID and synchronization state, but must not bypass company membership, subscription access, or schedule conflict checks.

## Follow-up Safeguards

- Add encrypted server-side calendar tokens; never place OAuth refresh tokens in browser storage.
- Add idempotent synchronization jobs and provider webhook logging.
- Add a connection health screen with last successful sync and a reconnect action.
- Keep customer details out of external event titles by default; expose address and notes only through explicit company settings.
- Expand from one shared company schedule to workers and crews only after the shared-calendar beta is stable.
