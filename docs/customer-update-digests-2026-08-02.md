# Customer Update Digests

## Decision

Contractor job changes are queued instead of emailing the customer immediately. Customer-access links and password-related account emails remain immediate.

## Delivery Windows

The digest worker checks hourly and sends queued job updates when the company's scheduling timezone reaches:

- 10:00 AM
- 4:00 PM
- 9:00 PM

Multiple changes to the same job before a delivery window produce one email. The email keeps the approved wording, "Your job has been updated," and includes a new secure customer-portal link.

## Components

- `job_update_events` stores private pending and processed update events.
- `send-magic-link` authenticates the contractor and queues ordinary job updates.
- `send-job-digests` claims due events, sends one email per job, and records provider outcomes.
- Supabase Cron invokes the worker at the start of each hour.
- The cron request uses a randomly generated Vault secret that is never stored in source control.

Processed event records are retained for 90 days for basic delivery auditing. Failed sends are released for retry at the next delivery window.
