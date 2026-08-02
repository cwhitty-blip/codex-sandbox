alter table public.companies
  add column if not exists scheduling_timezone text not null default 'America/Chicago',
  add column if not exists scheduling_workdays smallint[] not null default array[1, 2, 3, 4, 5]::smallint[],
  add column if not exists scheduling_workday_start time not null default '08:00',
  add column if not exists scheduling_workday_end time not null default '17:00',
  add column if not exists scheduling_buffer_minutes integer not null default 30;

alter table public.jobs
  add column if not exists scheduled_start timestamptz,
  add column if not exists scheduled_end timestamptz,
  add column if not exists estimated_duration_minutes integer not null default 60,
  add column if not exists recurrence_frequency text not null default 'none',
  add column if not exists recurrence_interval integer not null default 1,
  add column if not exists recurrence_until date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_scheduling_hours_check') then
    alter table public.companies
      add constraint companies_scheduling_hours_check
      check (scheduling_workday_end > scheduling_workday_start);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'companies_scheduling_buffer_check') then
    alter table public.companies
      add constraint companies_scheduling_buffer_check
      check (scheduling_buffer_minutes between 0 and 240);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'companies_scheduling_workdays_check') then
    alter table public.companies
      add constraint companies_scheduling_workdays_check
      check (
        cardinality(scheduling_workdays) between 1 and 7
        and scheduling_workdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_schedule_range_check') then
    alter table public.jobs
      add constraint jobs_schedule_range_check
      check (
        (scheduled_start is null and scheduled_end is null)
        or (scheduled_start is not null and scheduled_end > scheduled_start)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_duration_check') then
    alter table public.jobs
      add constraint jobs_duration_check
      check (estimated_duration_minutes between 30 and 1440);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_recurrence_frequency_check') then
    alter table public.jobs
      add constraint jobs_recurrence_frequency_check
      check (recurrence_frequency in ('none', 'weekly', 'monthly'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_recurrence_interval_check') then
    alter table public.jobs
      add constraint jobs_recurrence_interval_check
      check (recurrence_interval between 1 and 52);
  end if;
end;
$$;

create table if not exists public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  occurrence_start timestamptz not null,
  replacement_start timestamptz,
  replacement_end timestamptz,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id, occurrence_start),
  constraint schedule_exceptions_status_check check (status in ('rescheduled', 'skipped')),
  constraint schedule_exceptions_replacement_check check (
    (status = 'skipped' and replacement_start is null and replacement_end is null)
    or (status = 'rescheduled' and replacement_start is not null and replacement_end > replacement_start)
  )
);

alter table public.schedule_exceptions enable row level security;

grant select, insert, update, delete on public.schedule_exceptions to authenticated;
grant update (
  scheduling_timezone,
  scheduling_workdays,
  scheduling_workday_start,
  scheduling_workday_end,
  scheduling_buffer_minutes
) on public.companies to authenticated;

drop policy if exists "Members can manage schedule exceptions" on public.schedule_exceptions;
drop policy if exists "Members can read schedule exceptions" on public.schedule_exceptions;
drop policy if exists "Members can create schedule exceptions" on public.schedule_exceptions;
drop policy if exists "Members can update schedule exceptions" on public.schedule_exceptions;
drop policy if exists "Members can delete schedule exceptions" on public.schedule_exceptions;

create policy "Members can read schedule exceptions"
on public.schedule_exceptions for select
to authenticated
using (
  public.is_company_member(company_id)
  and public.job_belongs_to_company(job_id, company_id)
);

create policy "Members can create schedule exceptions"
on public.schedule_exceptions for insert
to authenticated
with check (
  public.company_member_can_write(company_id)
  and public.job_belongs_to_company(job_id, company_id)
);

create policy "Members can update schedule exceptions"
on public.schedule_exceptions for update
to authenticated
using (
  public.company_member_can_write(company_id)
  and public.job_belongs_to_company(job_id, company_id)
)
with check (
  public.company_member_can_write(company_id)
  and public.job_belongs_to_company(job_id, company_id)
);

create policy "Members can delete schedule exceptions"
on public.schedule_exceptions for delete
to authenticated
using (
  public.company_member_can_write(company_id)
  and public.job_belongs_to_company(job_id, company_id)
);

create index if not exists jobs_scheduled_start_idx
on public.jobs(company_id, scheduled_start)
where scheduled_start is not null;

create index if not exists schedule_exceptions_job_occurrence_idx
on public.schedule_exceptions(job_id, occurrence_start);

drop trigger if exists touch_schedule_exceptions_updated_at on public.schedule_exceptions;
create trigger touch_schedule_exceptions_updated_at
before update on public.schedule_exceptions
for each row execute function public.touch_updated_at();

create or replace function public.save_scheduled_job_record(
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
  input_job_scheduled_start timestamptz,
  input_job_scheduled_end timestamptz,
  input_job_estimated_duration_minutes integer,
  input_job_recurrence_frequency text,
  input_job_recurrence_interval integer,
  input_job_recurrence_until date,
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
  old_scheduled_start timestamptz;
  old_recurrence_frequency text;
  old_recurrence_interval integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.company_member_can_write(target_company_id) then
    raise exception 'Workspace is read-only until billing is restored';
  end if;

  if nullif(trim(input_customer_name), '') is null
    or nullif(trim(input_customer_email), '') is null
    or nullif(trim(input_job_name), '') is null
    or nullif(trim(input_job_service_address), '') is null then
    raise exception 'Required job information is missing';
  end if;

  if input_job_estimated_duration_minutes not between 30 and 1440 then
    raise exception 'Estimated duration is invalid';
  end if;

  if coalesce(input_job_recurrence_frequency, 'none') not in ('none', 'weekly', 'monthly')
    or coalesce(input_job_recurrence_interval, 1) not between 1 and 52 then
    raise exception 'Recurrence setting is invalid';
  end if;

  if (input_job_scheduled_start is null) <> (input_job_scheduled_end is null)
    or (input_job_scheduled_start is not null and input_job_scheduled_end <= input_job_scheduled_start) then
    raise exception 'Appointment time is invalid';
  end if;

  if coalesce(input_job_recurrence_frequency, 'none') <> 'none'
    and input_job_scheduled_start is null then
    raise exception 'Recurring work requires an appointment time';
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
      scheduled_start,
      scheduled_end,
      estimated_duration_minutes,
      recurrence_frequency,
      recurrence_interval,
      recurrence_until,
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
      input_job_scheduled_start,
      input_job_scheduled_end,
      input_job_estimated_duration_minutes,
      coalesce(input_job_recurrence_frequency, 'none'),
      coalesce(input_job_recurrence_interval, 1),
      case when coalesce(input_job_recurrence_frequency, 'none') = 'none' then null else input_job_recurrence_until end,
      nullif(trim(input_job_invoice_url), ''),
      nullif(trim(input_job_next_action), ''),
      nullif(trim(input_job_internal_notes), ''),
      coalesce(input_job_custom_values, '{}'::jsonb)
    )
    returning * into saved_job;
  else
    select customer_id, scheduled_start, recurrence_frequency, recurrence_interval
    into saved_customer_id, old_scheduled_start, old_recurrence_frequency, old_recurrence_interval
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
      scheduled_start = input_job_scheduled_start,
      scheduled_end = input_job_scheduled_end,
      estimated_duration_minutes = input_job_estimated_duration_minutes,
      recurrence_frequency = coalesce(input_job_recurrence_frequency, 'none'),
      recurrence_interval = coalesce(input_job_recurrence_interval, 1),
      recurrence_until = case when coalesce(input_job_recurrence_frequency, 'none') = 'none' then null else input_job_recurrence_until end,
      invoice_url = nullif(trim(input_job_invoice_url), ''),
      next_action = nullif(trim(input_job_next_action), ''),
      internal_notes = nullif(trim(input_job_internal_notes), ''),
      custom_values = coalesce(input_job_custom_values, '{}'::jsonb),
      updated_at = now()
    where id = target_job_id
      and company_id = target_company_id
    returning * into saved_job;

    if old_scheduled_start is distinct from input_job_scheduled_start
      or old_recurrence_frequency is distinct from coalesce(input_job_recurrence_frequency, 'none')
      or old_recurrence_interval is distinct from coalesce(input_job_recurrence_interval, 1) then
      delete from public.schedule_exceptions
      where job_id = target_job_id
        and company_id = target_company_id;
    end if;
  end if;

  return saved_job;
end;
$$;

revoke all on function public.save_scheduled_job_record(
  uuid, uuid, text, text, text, text, text, text, text, text, date,
  timestamptz, timestamptz, integer, text, integer, date, text, text, text, jsonb
) from public;

grant execute on function public.save_scheduled_job_record(
  uuid, uuid, text, text, text, text, text, text, text, text, date,
  timestamptz, timestamptz, integer, text, integer, date, text, text, text, jsonb
) to authenticated;
