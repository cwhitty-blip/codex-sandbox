alter table public.companies
add column if not exists mileage_tracking_enabled boolean not null default false;

grant update (mileage_tracking_enabled) on public.companies to authenticated;

create table if not exists public.mileage_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  mileage_date date not null default current_date,
  miles numeric(8,1) not null,
  created_at timestamptz not null default now(),
  constraint mileage_entries_miles_check check (miles > 0 and miles <= 10000)
);

alter table public.mileage_entries enable row level security;

grant select, insert, update, delete on public.mileage_entries to authenticated;

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

create index if not exists mileage_entries_job_date_idx
on public.mileage_entries(job_id, mileage_date desc, created_at desc);
