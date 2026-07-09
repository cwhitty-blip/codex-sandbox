create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  billing_provider text,
  billing_account text,
  billing_sync text default 'Invoice links only',
  created_at timestamptz not null default now()
);

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

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  name text not null,
  document_type text not null default 'Other',
  uploaded_by text not null,
  visibility text not null default 'Staff Only',
  status text not null default 'New',
  storage_provider text not null default 'google_drive',
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
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.estimate_acceptances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  accepted_from_ip text,
  user_agent text
);

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

create or replace function public.bootstrap_company(company_name text)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  company public.companies;
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
    insert into public.companies (name)
    values (coalesce(nullif(trim(company_name), ''), 'Service Company'))
    returning * into company;

    insert into public.company_members (company_id, user_id, role)
    values (company.id, auth.uid(), 'owner');
  end if;

  return company;
end;
$$;

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.customers enable row level security;
alter table public.jobs enable row level security;
alter table public.custom_fields enable row level security;
alter table public.documents enable row level security;
alter table public.magic_links enable row level security;
alter table public.estimate_acceptances enable row level security;

drop policy if exists "Members can read companies" on public.companies;
create policy "Members can read companies"
on public.companies for select
to authenticated
using (public.is_company_member(id));

drop policy if exists "Authenticated users can create companies" on public.companies;
create policy "Authenticated users can create companies"
on public.companies for insert
to authenticated
with check (true);

drop policy if exists "Members can update companies" on public.companies;
create policy "Members can update companies"
on public.companies for update
to authenticated
using (public.is_company_member(id))
with check (public.is_company_member(id));

drop policy if exists "Users can read their memberships" on public.company_members;
create policy "Users can read their memberships"
on public.company_members for select
to authenticated
using (user_id = auth.uid() or public.is_company_member(company_id));

drop policy if exists "Users can create their own memberships" on public.company_members;
create policy "Users can create their own memberships"
on public.company_members for insert
to authenticated
with check (user_id = auth.uid());

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
with check (public.is_company_member(company_id));

drop policy if exists "Members can update jobs" on public.jobs;
create policy "Members can update jobs"
on public.jobs for update
to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

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

drop policy if exists "Members can manage documents" on public.documents;
create policy "Members can manage documents"
on public.documents for all
to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

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

drop trigger if exists touch_jobs_updated_at on public.jobs;
create trigger touch_jobs_updated_at
before update on public.jobs
for each row execute function public.touch_updated_at();
