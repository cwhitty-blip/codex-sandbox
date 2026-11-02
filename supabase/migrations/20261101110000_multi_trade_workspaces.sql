create table if not exists public.trade_catalog (
  code text primary key,
  label text not null,
  sort_order smallint not null default 100,
  active boolean not null default true,
  constraint trade_catalog_code_check check (code ~ '^[a-z][a-z0-9_]*$')
);

insert into public.trade_catalog (code, label, sort_order, active)
values
  ('general', 'General service', 10, true),
  ('roofing', 'Roofing', 20, true),
  ('hvac', 'HVAC', 30, true),
  ('plumbing', 'Plumbing', 40, true),
  ('electrical', 'Electrical', 50, true),
  ('restoration', 'Restoration', 60, true),
  ('landscaping', 'Lawn & landscape', 70, true),
  ('cleaning', 'Cleaning', 80, true),
  ('painting', 'Painting', 90, true),
  ('handyman', 'Handyman', 100, true),
  ('pest_control', 'Pest control', 110, true),
  ('other', 'Other', 120, true)
on conflict (code) do update
set label = excluded.label,
    sort_order = excluded.sort_order;

alter table public.companies
add column if not exists enabled_trade_codes text[] not null default array['general']::text[];

insert into public.trade_catalog (code, label, sort_order, active)
select distinct
  lower(trim(industry)),
  initcap(replace(lower(trim(industry)), '_', ' ')),
  900,
  true
from public.jobs
where nullif(trim(industry), '') is not null
on conflict (code) do nothing;

update public.companies as company
set enabled_trade_codes = coalesce((
  select array_agg(code order by code)
  from (
    select 'general'::text as code
    union
    select distinct lower(trim(job.industry))
    from public.jobs as job
    where job.company_id = company.id
      and nullif(trim(job.industry), '') is not null
  ) as company_trades
), array['general']::text[])
where company.enabled_trade_codes = array['general']::text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_enabled_trade_codes_check') then
    alter table public.companies
      add constraint companies_enabled_trade_codes_check
      check (cardinality(enabled_trade_codes) between 1 and 12);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_industry_fkey') then
    alter table public.jobs
      add constraint jobs_industry_fkey
      foreign key (industry) references public.trade_catalog(code) not valid;
    alter table public.jobs validate constraint jobs_industry_fkey;
  end if;
end
$$;

create index if not exists jobs_company_industry_created_idx
on public.jobs (company_id, industry, created_at desc);

alter table public.trade_catalog enable row level security;
drop policy if exists "Authenticated users can read trade catalog" on public.trade_catalog;
create policy "Authenticated users can read trade catalog"
on public.trade_catalog for select
to authenticated
using (true);
grant select on public.trade_catalog to authenticated;

create or replace function public.set_company_trades(
  target_company_id uuid,
  input_trade_codes text[]
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_count integer;
  normalized_codes text[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.company_member_can_write(target_company_id) then
    raise exception 'Workspace is read-only';
  end if;

  if not exists (
    select 1
    from public.company_members as membership
    where membership.company_id = target_company_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin')
  ) then
    raise exception 'Owner access required';
  end if;

  select count(*)
  into requested_count
  from (
    select distinct lower(trim(code)) as code
    from unnest(coalesce(input_trade_codes, array[]::text[])) as code
    where nullif(trim(code), '') is not null
  ) as requested;

  if requested_count = 0 then
    raise exception 'Choose at least one trade';
  end if;

  select array_agg(catalog.code order by catalog.sort_order, catalog.code)
  into normalized_codes
  from public.trade_catalog as catalog
  join (
    select distinct lower(trim(code)) as code
    from unnest(input_trade_codes) as code
    where nullif(trim(code), '') is not null
  ) as requested on requested.code = catalog.code
  where catalog.active;

  if coalesce(cardinality(normalized_codes), 0) <> requested_count then
    raise exception 'One or more trades are unavailable';
  end if;

  update public.companies
  set enabled_trade_codes = normalized_codes
  where id = target_company_id;

  return normalized_codes;
end;
$$;

revoke all on function public.set_company_trades(uuid, text[]) from public;
grant execute on function public.set_company_trades(uuid, text[]) to authenticated;

create or replace function public.validate_job_trade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  enabled_codes text[];
begin
  if tg_op = 'UPDATE'
    and new.company_id is not distinct from old.company_id
    and new.industry is not distinct from old.industry then
    return new;
  end if;

  select company.enabled_trade_codes
  into enabled_codes
  from public.companies as company
  where company.id = new.company_id;

  if enabled_codes is null or not (new.industry = any(enabled_codes)) then
    raise exception 'Trade is not enabled for this company';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_jobs_trade on public.jobs;
create trigger validate_jobs_trade
before insert or update of company_id, industry on public.jobs
for each row execute function public.validate_job_trade();
