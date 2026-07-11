create table if not exists public.company_subscriptions (
  company_id uuid primary key references public.companies(id) on delete cascade,
  provider text not null default 'none',
  billing_mode text not null default 'off',
  billing_email text,
  status text not null default 'beta',
  plan_price_cents integer not null default 1299,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  checkout_url text,
  external_business_id text,
  external_customer_id text,
  external_checkout_id text,
  external_contract_id text,
  last_invoice_id text,
  last_paid_at timestamptz,
  current_period_ends_at timestamptz,
  grace_ends_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_subscriptions_provider_check check (provider in ('none', 'wave')),
  constraint company_subscriptions_billing_mode_check check (billing_mode in ('off', 'manual', 'wave')),
  constraint company_subscriptions_status_check check (status in ('beta', 'trialing', 'active', 'past_due', 'cancelled'))
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  company_id uuid references public.companies(id) on delete set null,
  status text not null default 'received',
  event_summary jsonb not null default '{}'::jsonb,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, provider_event_id),
  constraint billing_events_status_check check (status in ('received', 'processed', 'ignored', 'unmatched', 'error'))
);

alter table public.company_subscriptions enable row level security;
alter table public.billing_events enable row level security;

revoke all on public.company_subscriptions from anon, authenticated;
revoke all on public.billing_events from anon, authenticated;

create unique index if not exists company_subscriptions_billing_email_idx
on public.company_subscriptions(lower(billing_email))
where billing_email is not null;

create index if not exists company_subscriptions_external_customer_idx
on public.company_subscriptions(provider, external_customer_id)
where external_customer_id is not null;

create index if not exists billing_events_company_received_idx
on public.billing_events(company_id, received_at desc);

insert into public.company_subscriptions (
  company_id,
  provider,
  billing_mode,
  status,
  plan_price_cents,
  trial_started_at,
  trial_ends_at
)
select
  id,
  'none',
  'off',
  'beta',
  plan_price_cents,
  trial_started_at,
  trial_ends_at
from public.companies
on conflict (company_id) do nothing;
