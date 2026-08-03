create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.job_update_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  requested_at timestamptz not null default now(),
  claimed_at timestamptz,
  claim_token uuid,
  processed_at timestamptz,
  provider_message_id text,
  attempt_count integer not null default 0,
  last_error text,
  constraint job_update_events_attempt_count_check check (attempt_count between 0 and 100)
);

alter table public.job_update_events enable row level security;
revoke all on public.job_update_events from anon, authenticated;
grant select, insert, update, delete on public.job_update_events to service_role;

create index if not exists job_update_events_pending_idx
on public.job_update_events(requested_at, job_id)
where processed_at is null;

create or replace function public.claim_due_job_update_digests(
  input_claim_token uuid,
  input_max_jobs integer default 100
)
returns table (
  job_id uuid,
  company_id uuid,
  customer_id uuid,
  event_count bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with due_jobs as materialized (
    select
      events.job_id,
      events.company_id,
      min(events.customer_id::text)::uuid as customer_id,
      min(events.requested_at) as first_requested_at
    from public.job_update_events as events
    join public.companies as companies on companies.id = events.company_id
    where events.processed_at is null
      and (events.claimed_at is null or events.claimed_at < now() - interval '15 minutes')
      and extract(
        hour from timezone(
          coalesce(
            (select name from pg_timezone_names where name = companies.scheduling_timezone limit 1),
            'America/Chicago'
          ),
          now()
        )
      )::integer in (10, 16, 21)
    group by events.job_id, events.company_id
    order by min(events.requested_at)
    limit greatest(1, least(coalesce(input_max_jobs, 100), 500))
  ),
  claimed as (
    update public.job_update_events as events
    set
      claimed_at = now(),
      claim_token = input_claim_token,
      attempt_count = attempt_count + 1,
      last_error = null
    from due_jobs
    where events.job_id = due_jobs.job_id
      and events.company_id = due_jobs.company_id
      and events.processed_at is null
      and (events.claimed_at is null or events.claimed_at < now() - interval '15 minutes')
    returning events.job_id, events.company_id
  )
  select
    due_jobs.job_id,
    due_jobs.company_id,
    due_jobs.customer_id,
    count(claimed.job_id)::bigint as event_count
  from due_jobs
  join claimed
    on claimed.job_id = due_jobs.job_id
   and claimed.company_id = due_jobs.company_id
  group by due_jobs.job_id, due_jobs.company_id, due_jobs.customer_id, due_jobs.first_requested_at
  order by due_jobs.first_requested_at;
$$;

revoke all on function public.claim_due_job_update_digests(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_due_job_update_digests(uuid, integer) to service_role;

create or replace function public.validate_job_digest_cron_secret(input_secret text)
returns boolean
language sql
security definer
set search_path = public, vault, pg_temp
as $$
  select length(coalesce(input_secret, '')) >= 32
    and exists (
      select 1
      from vault.decrypted_secrets
      where name = 'job_digest_cron_secret'
        and decrypted_secret = input_secret
    );
$$;

revoke all on function public.validate_job_digest_cron_secret(text) from public, anon, authenticated;
grant execute on function public.validate_job_digest_cron_secret(text) to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'job_digest_cron_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'job_digest_cron_secret',
      'Authenticates the scheduled customer job-update digest worker'
    );
  end if;

  if not exists (select 1 from vault.secrets where name = 'job_digest_project_url') then
    perform vault.create_secret(
      'https://nzwygirmuolgwwvtjexw.supabase.co',
      'job_digest_project_url',
      'Supabase project URL used by the job-update digest cron task'
    );
  end if;
end;
$$;

select cron.schedule(
  'send-job-update-digests',
  '7 * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'job_digest_project_url')
        || '/functions/v1/send-job-digests',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-digest-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'job_digest_cron_secret')
      ),
      body := jsonb_build_object('triggered_at', now()),
      timeout_milliseconds := 10000
    ) as request_id;
  $cron$
);
