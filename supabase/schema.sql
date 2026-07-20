create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  billing_provider text,
  billing_account text,
  billing_sync text default 'Invoice links only',
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default now() + interval '7 days',
  subscription_status text not null default 'trialing',
  plan_price_cents integer not null default 1299,
  promo_code text,
  promo_percent_off integer not null default 0,
  stripe_customer_id text,
  stripe_subscription_id text,
  mileage_tracking_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.companies add column if not exists trial_started_at timestamptz not null default now();
alter table public.companies add column if not exists trial_ends_at timestamptz not null default now() + interval '7 days';
alter table public.companies add column if not exists subscription_status text not null default 'trialing';
alter table public.companies add column if not exists plan_price_cents integer not null default 1299;
alter table public.companies add column if not exists promo_code text;
alter table public.companies add column if not exists promo_percent_off integer not null default 0;
alter table public.companies add column if not exists stripe_customer_id text;
alter table public.companies add column if not exists stripe_subscription_id text;
alter table public.companies add column if not exists logo_path text;
alter table public.companies add column if not exists mileage_tracking_enabled boolean not null default false;

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique(company_id, user_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  industry text not null default 'general',
  name text not null,
  service_address text,
  job_status text not null default 'Active',
  material_status text not null default 'Not Ordered',
  projected_date date,
  invoice_url text,
  next_action text,
  internal_notes text,
  custom_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  label text not null,
  field_type text not null default 'text',
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mileage_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  mileage_date date not null default current_date,
  miles numeric(8,1) not null,
  created_at timestamptz not null default now(),
  constraint mileage_entries_miles_check check (miles > 0 and miles <= 10000)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  name text not null,
  document_type text not null default 'Other',
  uploaded_by text not null,
  visibility text not null default 'Staff Only',
  status text not null default 'New',
  storage_provider text not null default 'supabase',
  storage_file_id text,
  storage_url text,
  version integer,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.magic_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  token_hash text not null,
  sent_to text not null,
  channel text not null default 'email',
  message_type text not null default 'access',
  provider_message_id text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.magic_links add column if not exists message_type text not null default 'access';
alter table public.magic_links add column if not exists provider_message_id text;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'magic_links_message_type_check'
  ) then
    alter table public.magic_links
      add constraint magic_links_message_type_check
      check (message_type in ('access', 'job_update'));
  end if;
end;
$$;

create table if not exists public.estimate_acceptances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  decision_status text not null default 'accept',
  notes text,
  decided_at timestamptz not null default now(),
  accepted_at timestamptz not null default now(),
  accepted_from_ip text,
  user_agent text,
  constraint estimate_acceptances_decision_status_check
    check (decision_status in ('accept', 'changes', 'reject'))
);

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

alter table public.estimate_acceptances add column if not exists decision_status text not null default 'accept';
alter table public.estimate_acceptances add column if not exists notes text;
alter table public.estimate_acceptances add column if not exists decided_at timestamptz not null default now();
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'estimate_acceptances_decision_status_check'
  ) then
    alter table public.estimate_acceptances
      add constraint estimate_acceptances_decision_status_check
      check (decision_status in ('accept', 'changes', 'reject'));
  end if;
end;
$$;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members
    where company_id = target_company_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.customer_belongs_to_company(target_customer_id uuid, target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customers
    where id = target_customer_id
      and company_id = target_company_id
  );
$$;

create or replace function public.job_belongs_to_company(target_job_id uuid, target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.jobs
    where id = target_job_id
      and company_id = target_company_id
  );
$$;

create or replace function public.document_belongs_to_job_and_company(target_document_id uuid, target_job_id uuid, target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documents
    where id = target_document_id
      and job_id = target_job_id
      and company_id = target_company_id
  );
$$;

create or replace function public.company_id_from_storage_path(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  raw_company_id text := (storage.foldername(object_name))[1];
begin
  return raw_company_id::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.bootstrap_company(company_name text, promo_code text default null)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  company public.companies;
  clean_promo text := lower(nullif(trim(promo_code), ''));
  promo_percent integer := case lower(nullif(trim(promo_code), ''))
    when '20off' then 20
    when '30off' then 30
    else 0
  end;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select c.*
  into company
  from public.companies c
  join public.company_members cm on cm.company_id = c.id
  where cm.user_id = auth.uid()
  order by c.created_at
  limit 1;

  if company.id is null then
    insert into public.companies (name, promo_code, promo_percent_off)
    values (
      coalesce(nullif(trim(company_name), ''), 'Service Company'),
      clean_promo,
      promo_percent
    )
    returning * into company;

    insert into public.company_members (company_id, user_id, role)
    values (company.id, auth.uid(), 'owner');
  end if;

  return company;
end;
$$;

create or replace function public.save_job_record(
  target_company_id uuid,
  target_job_id uuid,
  input_customer_name text,
  input_customer_email text,
  input_customer_phone text,
  input_job_industry text,
  input_job_name text,
  input_job_service_address text,
  input_job_status text,
  input_job_material_status text,
  input_job_projected_date date,
  input_job_invoice_url text,
  input_job_next_action text,
  input_job_internal_notes text,
  input_job_custom_values jsonb
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_job public.jobs;
  saved_customer_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.company_members
    where company_id = target_company_id
      and user_id = auth.uid()
  ) then
    raise exception 'Company access denied';
  end if;

  if nullif(trim(input_customer_name), '') is null
    or nullif(trim(input_customer_email), '') is null
    or nullif(trim(input_job_name), '') is null
    or nullif(trim(input_job_service_address), '') is null then
    raise exception 'Required job information is missing';
  end if;

  if target_job_id is null then
    insert into public.customers (company_id, name, email, phone)
    values (
      target_company_id,
      trim(input_customer_name),
      lower(trim(input_customer_email)),
      nullif(trim(input_customer_phone), '')
    )
    returning id into saved_customer_id;

    insert into public.jobs (
      company_id,
      customer_id,
      industry,
      name,
      service_address,
      job_status,
      material_status,
      projected_date,
      invoice_url,
      next_action,
      internal_notes,
      custom_values
    )
    values (
      target_company_id,
      saved_customer_id,
      coalesce(nullif(trim(input_job_industry), ''), 'general'),
      trim(input_job_name),
      trim(input_job_service_address),
      coalesce(nullif(trim(input_job_status), ''), 'Active'),
      coalesce(nullif(trim(input_job_material_status), ''), 'Not Ordered'),
      input_job_projected_date,
      nullif(trim(input_job_invoice_url), ''),
      nullif(trim(input_job_next_action), ''),
      nullif(trim(input_job_internal_notes), ''),
      coalesce(input_job_custom_values, '{}'::jsonb)
    )
    returning * into saved_job;
  else
    select customer_id
    into saved_customer_id
    from public.jobs
    where id = target_job_id
      and company_id = target_company_id;

    if saved_customer_id is null then
      raise exception 'Job not found';
    end if;

    update public.customers
    set
      name = trim(input_customer_name),
      email = lower(trim(input_customer_email)),
      phone = nullif(trim(input_customer_phone), '')
    where id = saved_customer_id
      and company_id = target_company_id;

    update public.jobs
    set
      industry = coalesce(nullif(trim(input_job_industry), ''), industry),
      name = trim(input_job_name),
      service_address = trim(input_job_service_address),
      job_status = coalesce(nullif(trim(input_job_status), ''), job_status),
      material_status = coalesce(nullif(trim(input_job_material_status), ''), material_status),
      projected_date = input_job_projected_date,
      invoice_url = nullif(trim(input_job_invoice_url), ''),
      next_action = nullif(trim(input_job_next_action), ''),
      internal_notes = nullif(trim(input_job_internal_notes), ''),
      custom_values = coalesce(input_job_custom_values, '{}'::jsonb),
      updated_at = now()
    where id = target_job_id
      and company_id = target_company_id
    returning * into saved_job;
  end if;

  return saved_job;
end;
$$;

revoke all on function public.save_job_record(uuid, uuid, text, text, text, text, text, text, text, text, date, text, text, text, jsonb) from public;
grant execute on function public.save_job_record(uuid, uuid, text, text, text, text, text, text, text, text, date, text, text, text, jsonb) to authenticated;

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.customers enable row level security;
alter table public.jobs enable row level security;
alter table public.custom_fields enable row level security;
alter table public.mileage_entries enable row level security;
alter table public.documents enable row level security;
alter table public.magic_links enable row level security;
alter table public.estimate_acceptances enable row level security;
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

insert into storage.buckets (id, name, public)
values ('job-documents', 'job-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-branding',
  'company-branding',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members can read companies" on public.companies;
create policy "Members can read companies"
on public.companies for select
to authenticated
using (public.is_company_member(id));

drop policy if exists "Authenticated users can create companies" on public.companies;

drop policy if exists "Members can update companies" on public.companies;
create policy "Members can update companies"
on public.companies for update
to authenticated
using (public.is_company_member(id))
with check (public.is_company_member(id));

revoke update on public.companies from authenticated;
grant update (name, billing_provider, billing_account, billing_sync) on public.companies to authenticated;
grant update (mileage_tracking_enabled) on public.companies to authenticated;

grant select, insert, update, delete on public.mileage_entries to authenticated;

create index if not exists mileage_entries_job_date_idx
on public.mileage_entries(job_id, mileage_date desc, created_at desc);

create unique index if not exists magic_links_token_hash_idx on public.magic_links(token_hash);
create index if not exists magic_links_job_created_idx on public.magic_links(job_id, created_at desc);
create index if not exists magic_links_job_message_created_idx on public.magic_links(job_id, message_type, created_at desc);
create index if not exists documents_job_created_idx on public.documents(job_id, created_at desc);

drop policy if exists "Users can read their memberships" on public.company_members;
create policy "Users can read their memberships"
on public.company_members for select
to authenticated
using (user_id = auth.uid() or public.is_company_member(company_id));

drop policy if exists "Users can create their own memberships" on public.company_members;
drop policy if exists "Service function creates memberships" on public.company_members;

drop policy if exists "Members can read customers" on public.customers;
create policy "Members can read customers"
on public.customers for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "Members can create customers" on public.customers;
create policy "Members can create customers"
on public.customers for insert
to authenticated
with check (public.is_company_member(company_id));

drop policy if exists "Members can update customers" on public.customers;
create policy "Members can update customers"
on public.customers for update
to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

drop policy if exists "Members can read jobs" on public.jobs;
create policy "Members can read jobs"
on public.jobs for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "Members can create jobs" on public.jobs;
create policy "Members can create jobs"
on public.jobs for insert
to authenticated
with check (
  public.is_company_member(company_id)
  and public.customer_belongs_to_company(customer_id, company_id)
);

drop policy if exists "Members can update jobs" on public.jobs;
create policy "Members can update jobs"
on public.jobs for update
to authenticated
using (public.is_company_member(company_id))
with check (
  public.is_company_member(company_id)
  and public.customer_belongs_to_company(customer_id, company_id)
);

drop policy if exists "Members can delete jobs" on public.jobs;
create policy "Members can delete jobs"
on public.jobs for delete
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "Members can manage custom fields" on public.custom_fields;
create policy "Members can manage custom fields"
on public.custom_fields for all
to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

drop policy if exists "Members can manage mileage entries" on public.mileage_entries;
create policy "Members can manage mileage entries"
on public.mileage_entries for all
to authenticated
using (
  public.is_company_member(company_id)
  and public.job_belongs_to_company(job_id, company_id)
)
with check (
  public.is_company_member(company_id)
  and public.job_belongs_to_company(job_id, company_id)
);

drop policy if exists "Members can manage documents" on public.documents;
create policy "Members can manage documents"
on public.documents for all
to authenticated
using (public.is_company_member(company_id))
with check (
  public.is_company_member(company_id)
  and public.job_belongs_to_company(job_id, company_id)
);

drop policy if exists "Members can read job document files" on storage.objects;
create policy "Members can read job document files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'job-documents'
  and public.is_company_member(public.company_id_from_storage_path(name))
);

drop policy if exists "Members can upload job document files" on storage.objects;
create policy "Members can upload job document files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'job-documents'
  and public.is_company_member(public.company_id_from_storage_path(name))
);

drop policy if exists "Members can update job document files" on storage.objects;
create policy "Members can update job document files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'job-documents'
  and public.is_company_member(public.company_id_from_storage_path(name))
)
with check (
  bucket_id = 'job-documents'
  and public.is_company_member(public.company_id_from_storage_path(name))
);

drop policy if exists "Members can delete job document files" on storage.objects;
create policy "Members can delete job document files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'job-documents'
  and public.is_company_member(public.company_id_from_storage_path(name))
);

drop policy if exists "Members can upload company branding" on storage.objects;
create policy "Members can upload company branding"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'company-branding'
  and public.is_company_member(public.company_id_from_storage_path(name))
);

drop policy if exists "Members can update company branding" on storage.objects;
create policy "Members can update company branding"
on storage.objects for update
to authenticated
using (
  bucket_id = 'company-branding'
  and public.is_company_member(public.company_id_from_storage_path(name))
)
with check (
  bucket_id = 'company-branding'
  and public.is_company_member(public.company_id_from_storage_path(name))
);

drop policy if exists "Members can delete company branding" on storage.objects;
create policy "Members can delete company branding"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'company-branding'
  and public.is_company_member(public.company_id_from_storage_path(name))
);

drop policy if exists "Members can read magic links" on public.magic_links;
create policy "Members can read magic links"
on public.magic_links for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "Members can read estimate acceptances" on public.estimate_acceptances;
create policy "Members can read estimate acceptances"
on public.estimate_acceptances for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "Members can create estimate acceptances" on public.estimate_acceptances;
create policy "Members can create estimate acceptances"
on public.estimate_acceptances for insert
to authenticated
with check (
  public.is_company_member(company_id)
  and public.customer_belongs_to_company(customer_id, company_id)
  and public.job_belongs_to_company(job_id, company_id)
  and public.document_belongs_to_job_and_company(document_id, job_id, company_id)
);

drop policy if exists "Members can update estimate acceptances" on public.estimate_acceptances;
create policy "Members can update estimate acceptances"
on public.estimate_acceptances for update
to authenticated
using (public.is_company_member(company_id))
with check (
  public.is_company_member(company_id)
  and public.customer_belongs_to_company(customer_id, company_id)
  and public.job_belongs_to_company(job_id, company_id)
  and public.document_belongs_to_job_and_company(document_id, job_id, company_id)
);

drop trigger if exists touch_jobs_updated_at on public.jobs;
create trigger touch_jobs_updated_at
before update on public.jobs
for each row execute function public.touch_updated_at();
