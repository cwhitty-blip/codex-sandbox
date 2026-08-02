alter table public.companies
alter column trial_ends_at set default now() + interval '14 days';

update public.companies
set trial_ends_at = trial_started_at + interval '14 days'
where trial_ends_at <= trial_started_at + interval '8 days';

alter table public.company_subscriptions
add column if not exists base_plan_price_cents integer not null default 1299,
add column if not exists promo_code text,
add column if not exists promo_percent_off integer not null default 0,
add column if not exists current_period_starts_at timestamptz,
add column if not exists cancel_at_period_end boolean not null default false,
add column if not exists cancelled_at timestamptz,
add column if not exists manual_access_until timestamptz,
add column if not exists last_reconciled_at timestamptz;

update public.company_subscriptions
set trial_ends_at = trial_started_at + interval '14 days'
where trial_started_at is not null
  and trial_ends_at <= trial_started_at + interval '8 days';

create table if not exists public.billing_promo_codes (
  code text primary key,
  percent_off integer not null,
  active boolean not null default false,
  checkout_url text,
  external_checkout_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_promo_codes_code_check check (code = lower(trim(code)) and code <> ''),
  constraint billing_promo_codes_percent_check check (percent_off between 1 and 90)
);

alter table public.billing_promo_codes enable row level security;
revoke all on public.billing_promo_codes from anon, authenticated;

insert into public.billing_promo_codes (code, percent_off, active)
values
  ('20off', 20, false),
  ('30off', 30, false)
on conflict (code) do update set percent_off = excluded.percent_off;

create or replace function public.company_has_write_access(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when subscription.billing_mode = 'off' then true
      when subscription.manual_access_until is not null and subscription.manual_access_until > now() then true
      when subscription.status = 'trialing' and subscription.trial_ends_at > now() then true
      when subscription.status = 'active'
        and (subscription.current_period_ends_at is null or subscription.current_period_ends_at > now()) then true
      when subscription.status = 'past_due' and subscription.grace_ends_at > now() then true
      when subscription.status = 'cancelled' and subscription.current_period_ends_at > now() then true
      else false
    end
    from public.company_subscriptions subscription
    where subscription.company_id = target_company_id
  ), false);
$$;

create or replace function public.company_member_can_write(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_company_member(target_company_id)
    and public.company_has_write_access(target_company_id);
$$;

revoke all on function public.company_has_write_access(uuid) from public;
revoke all on function public.company_member_can_write(uuid) from public;
grant execute on function public.company_has_write_access(uuid) to service_role;
grant execute on function public.company_member_can_write(uuid) to authenticated, service_role;

create or replace function public.get_my_company_entitlement()
returns table (
  company_id uuid,
  provider text,
  billing_mode text,
  billing_email text,
  status text,
  base_plan_price_cents integer,
  plan_price_cents integer,
  promo_code text,
  promo_percent_off integer,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  checkout_url text,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  grace_ends_at timestamptz,
  cancel_at_period_end boolean,
  manual_access_until timestamptz,
  can_write boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    subscription.company_id,
    subscription.provider,
    subscription.billing_mode,
    subscription.billing_email,
    subscription.status,
    subscription.base_plan_price_cents,
    subscription.plan_price_cents,
    subscription.promo_code,
    subscription.promo_percent_off,
    subscription.trial_started_at,
    subscription.trial_ends_at,
    subscription.checkout_url,
    subscription.current_period_starts_at,
    subscription.current_period_ends_at,
    subscription.grace_ends_at,
    subscription.cancel_at_period_end,
    subscription.manual_access_until,
    public.company_has_write_access(subscription.company_id)
  from public.company_subscriptions subscription
  join public.company_members membership on membership.company_id = subscription.company_id
  where membership.user_id = auth.uid()
  order by membership.created_at
  limit 1;
$$;

revoke all on function public.get_my_company_entitlement() from public;
grant execute on function public.get_my_company_entitlement() to authenticated;

create or replace function public.apply_billing_promo_code(input_code text)
returns public.company_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_code text := lower(nullif(trim(input_code), ''));
  membership_company_id uuid;
  promotion public.billing_promo_codes;
  saved_subscription public.company_subscriptions;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select company_id
  into membership_company_id
  from public.company_members
  where user_id = auth.uid()
  order by created_at
  limit 1;

  if membership_company_id is null then
    raise exception 'Workspace not found';
  end if;

  select *
  into promotion
  from public.billing_promo_codes
  where code = clean_code
    and active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now());

  if promotion.code is null then
    raise exception 'Promo code is not active';
  end if;

  update public.company_subscriptions
  set
    promo_code = promotion.code,
    promo_percent_off = promotion.percent_off,
    plan_price_cents = round(base_plan_price_cents * (100 - promotion.percent_off) / 100.0),
    checkout_url = promotion.checkout_url,
    external_checkout_id = promotion.external_checkout_id,
    updated_at = now()
  where company_id = membership_company_id
    and status in ('beta', 'trialing', 'past_due')
  returning * into saved_subscription;

  if saved_subscription.company_id is null then
    raise exception 'Promo code cannot be changed for this subscription';
  end if;

  return saved_subscription;
end;
$$;

revoke all on function public.apply_billing_promo_code(text) from public;
grant execute on function public.apply_billing_promo_code(text) to authenticated;

create or replace function public.bootstrap_company(company_name text, promo_code text default null)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  company public.companies;
  clean_promo text := lower(nullif(trim(promo_code), ''));
  promotion public.billing_promo_codes;
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
    insert into public.companies (name, trial_started_at, trial_ends_at, subscription_status)
    values (
      coalesce(nullif(trim(company_name), ''), 'Service Company'),
      now(),
      now() + interval '14 days',
      'trialing'
    )
    returning * into company;

    insert into public.company_members (company_id, user_id, role)
    values (company.id, auth.uid(), 'owner');
  end if;

  insert into public.company_subscriptions (
    company_id,
    provider,
    billing_mode,
    billing_email,
    status,
    base_plan_price_cents,
    plan_price_cents,
    trial_started_at,
    trial_ends_at
  )
  values (
    company.id,
    'none',
    'off',
    lower(nullif(auth.jwt() ->> 'email', '')),
    'trialing',
    1299,
    1299,
    company.trial_started_at,
    company.trial_ends_at
  )
  on conflict (company_id) do nothing;

  if clean_promo is not null then
    select *
    into promotion
    from public.billing_promo_codes
    where code = clean_promo
      and active = true
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now());

    if promotion.code is not null then
      update public.company_subscriptions
      set
        promo_code = promotion.code,
        promo_percent_off = promotion.percent_off,
        plan_price_cents = round(base_plan_price_cents * (100 - promotion.percent_off) / 100.0),
        checkout_url = promotion.checkout_url,
        external_checkout_id = promotion.external_checkout_id,
        updated_at = now()
      where company_id = company.id
        and promo_code is null;
    end if;
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

  if not public.company_member_can_write(target_company_id) then
    raise exception 'Workspace is read-only';
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
      company_id, customer_id, industry, name, service_address, job_status,
      material_status, projected_date, invoice_url, next_action, internal_notes, custom_values
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

drop policy if exists "Members can update companies" on public.companies;
create policy "Members can update companies"
on public.companies for update
to authenticated
using (public.company_member_can_write(id))
with check (public.company_member_can_write(id));

drop policy if exists "Members can create customers" on public.customers;
create policy "Members can create customers"
on public.customers for insert
to authenticated
with check (public.company_member_can_write(company_id));

drop policy if exists "Members can update customers" on public.customers;
create policy "Members can update customers"
on public.customers for update
to authenticated
using (public.company_member_can_write(company_id))
with check (public.company_member_can_write(company_id));

drop policy if exists "Members can create jobs" on public.jobs;
create policy "Members can create jobs"
on public.jobs for insert
to authenticated
with check (
  public.company_member_can_write(company_id)
  and public.customer_belongs_to_company(customer_id, company_id)
);

drop policy if exists "Members can update jobs" on public.jobs;
create policy "Members can update jobs"
on public.jobs for update
to authenticated
using (public.company_member_can_write(company_id))
with check (
  public.company_member_can_write(company_id)
  and public.customer_belongs_to_company(customer_id, company_id)
);

drop policy if exists "Members can delete jobs" on public.jobs;
create policy "Members can delete jobs"
on public.jobs for delete
to authenticated
using (public.company_member_can_write(company_id));

drop policy if exists "Members can manage custom fields" on public.custom_fields;
drop policy if exists "Members can read custom fields" on public.custom_fields;
drop policy if exists "Members can create custom fields" on public.custom_fields;
drop policy if exists "Members can update custom fields" on public.custom_fields;
drop policy if exists "Members can delete custom fields" on public.custom_fields;

create policy "Members can read custom fields"
on public.custom_fields for select
to authenticated
using (public.is_company_member(company_id));

create policy "Members can create custom fields"
on public.custom_fields for insert
to authenticated
with check (public.company_member_can_write(company_id));

create policy "Members can update custom fields"
on public.custom_fields for update
to authenticated
using (public.company_member_can_write(company_id))
with check (public.company_member_can_write(company_id));

create policy "Members can delete custom fields"
on public.custom_fields for delete
to authenticated
using (public.company_member_can_write(company_id));

drop policy if exists "Members can manage mileage entries" on public.mileage_entries;
drop policy if exists "Members can read mileage entries" on public.mileage_entries;
drop policy if exists "Members can create mileage entries" on public.mileage_entries;
drop policy if exists "Members can update mileage entries" on public.mileage_entries;
drop policy if exists "Members can delete mileage entries" on public.mileage_entries;

create policy "Members can read mileage entries"
on public.mileage_entries for select
to authenticated
using (
  public.is_company_member(company_id)
  and public.job_belongs_to_company(job_id, company_id)
);

create policy "Members can create mileage entries"
on public.mileage_entries for insert
to authenticated
with check (
  public.company_member_can_write(company_id)
  and public.job_belongs_to_company(job_id, company_id)
);

create policy "Members can update mileage entries"
on public.mileage_entries for update
to authenticated
using (
  public.company_member_can_write(company_id)
  and public.job_belongs_to_company(job_id, company_id)
)
with check (
  public.company_member_can_write(company_id)
  and public.job_belongs_to_company(job_id, company_id)
);

create policy "Members can delete mileage entries"
on public.mileage_entries for delete
to authenticated
using (
  public.company_member_can_write(company_id)
  and public.job_belongs_to_company(job_id, company_id)
);

drop policy if exists "Members can manage documents" on public.documents;
drop policy if exists "Members can read documents" on public.documents;
drop policy if exists "Members can create documents" on public.documents;
drop policy if exists "Members can update documents" on public.documents;
drop policy if exists "Members can delete documents" on public.documents;

create policy "Members can read documents"
on public.documents for select
to authenticated
using (public.is_company_member(company_id));

create policy "Members can create documents"
on public.documents for insert
to authenticated
with check (
  public.company_member_can_write(company_id)
  and public.job_belongs_to_company(job_id, company_id)
);

create policy "Members can update documents"
on public.documents for update
to authenticated
using (public.company_member_can_write(company_id))
with check (
  public.company_member_can_write(company_id)
  and public.job_belongs_to_company(job_id, company_id)
);

create policy "Members can delete documents"
on public.documents for delete
to authenticated
using (public.company_member_can_write(company_id));

drop policy if exists "Members can upload job document files" on storage.objects;
create policy "Members can upload job document files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'job-documents'
  and public.company_member_can_write(public.company_id_from_storage_path(name))
);

drop policy if exists "Members can update job document files" on storage.objects;
create policy "Members can update job document files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'job-documents'
  and public.company_member_can_write(public.company_id_from_storage_path(name))
)
with check (
  bucket_id = 'job-documents'
  and public.company_member_can_write(public.company_id_from_storage_path(name))
);

drop policy if exists "Members can delete job document files" on storage.objects;
create policy "Members can delete job document files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'job-documents'
  and public.company_member_can_write(public.company_id_from_storage_path(name))
);

drop policy if exists "Members can upload company branding" on storage.objects;
create policy "Members can upload company branding"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'company-branding'
  and public.company_member_can_write(public.company_id_from_storage_path(name))
);

drop policy if exists "Members can update company branding" on storage.objects;
create policy "Members can update company branding"
on storage.objects for update
to authenticated
using (
  bucket_id = 'company-branding'
  and public.company_member_can_write(public.company_id_from_storage_path(name))
)
with check (
  bucket_id = 'company-branding'
  and public.company_member_can_write(public.company_id_from_storage_path(name))
);

drop policy if exists "Members can delete company branding" on storage.objects;
create policy "Members can delete company branding"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'company-branding'
  and public.company_member_can_write(public.company_id_from_storage_path(name))
);

drop policy if exists "Members can create estimate acceptances" on public.estimate_acceptances;
create policy "Members can create estimate acceptances"
on public.estimate_acceptances for insert
to authenticated
with check (
  public.company_member_can_write(company_id)
  and public.customer_belongs_to_company(customer_id, company_id)
  and public.job_belongs_to_company(job_id, company_id)
  and public.document_belongs_to_job_and_company(document_id, job_id, company_id)
);

drop policy if exists "Members can update estimate acceptances" on public.estimate_acceptances;
create policy "Members can update estimate acceptances"
on public.estimate_acceptances for update
to authenticated
using (public.company_member_can_write(company_id))
with check (
  public.company_member_can_write(company_id)
  and public.customer_belongs_to_company(customer_id, company_id)
  and public.job_belongs_to_company(job_id, company_id)
  and public.document_belongs_to_job_and_company(document_id, job_id, company_id)
);
