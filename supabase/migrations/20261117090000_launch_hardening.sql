-- Launch hardening: active memberships, assignment-scoped access, plan limits,
-- and owner/admin-only destructive job deletion.

alter table public.jobs
  add column if not exists archived_at timestamptz;

create or replace function public.is_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members membership
    where membership.company_id = target_company_id
      and membership.user_id = auth.uid()
      and coalesce(membership.status, 'active') = 'active'
  );
$$;

create or replace function public.current_company_role(target_company_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select membership.role
  from public.company_members membership
  where membership.company_id = target_company_id
    and membership.user_id = auth.uid()
    and coalesce(membership.status, 'active') = 'active'
  limit 1;
$$;

create or replace function public.company_member_is_manager(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_company_role(target_company_id), '') in ('owner', 'admin', 'office_manager');
$$;

create or replace function public.company_member_can_access_job(target_job_id uuid, target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_company_member(target_company_id)
    and exists (
      select 1 from public.jobs job
      where job.id = target_job_id and job.company_id = target_company_id
    )
    and (
      public.company_member_is_manager(target_company_id)
      or exists (
        select 1
        from public.company_members membership
        join public.job_assignments assignment
          on assignment.company_id = membership.company_id
         and assignment.job_id = target_job_id
        left join public.team_members team_member
          on team_member.membership_id = membership.id
         and team_member.team_id = assignment.team_id
        where membership.company_id = target_company_id
          and membership.user_id = auth.uid()
          and coalesce(membership.status, 'active') = 'active'
          and (assignment.membership_id = membership.id or team_member.membership_id is not null)
      )
    );
$$;

create or replace function public.company_member_can_update_job(target_job_id uuid, target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.company_member_can_access_job(target_job_id, target_company_id)
    and public.company_has_write_access(target_company_id);
$$;

create or replace function public.company_member_can_delete_job(target_job_id uuid, target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.company_member_can_update_job(target_job_id, target_company_id)
    and coalesce(public.current_company_role(target_company_id), '') in ('owner', 'admin');
$$;

revoke all on function public.current_company_role(uuid) from public;
revoke all on function public.company_member_is_manager(uuid) from public;
revoke all on function public.company_member_can_access_job(uuid, uuid) from public;
revoke all on function public.company_member_can_update_job(uuid, uuid) from public;
revoke all on function public.company_member_can_delete_job(uuid, uuid) from public;
grant execute on function public.current_company_role(uuid) to authenticated, service_role;
grant execute on function public.company_member_is_manager(uuid) to authenticated, service_role;
grant execute on function public.company_member_can_access_job(uuid, uuid) to authenticated, service_role;
grant execute on function public.company_member_can_update_job(uuid, uuid) to authenticated, service_role;
grant execute on function public.company_member_can_delete_job(uuid, uuid) to authenticated, service_role;

-- Apply published limits to current plans. Trial accounts receive paid-plan limits.
update public.company_subscriptions
set active_job_limit = case plan_code when 'free' then 5 when 'pocket_planner' then 50 when 'trial' then 50 when 'crew' then 250 else active_job_limit end,
    storage_limit_bytes = case plan_code when 'free' then 262144000 when 'pocket_planner' then 5368709120 when 'trial' then 5368709120 when 'crew' then 26843545600 else storage_limit_bytes end,
    member_limit = case plan_code when 'free' then 1 when 'pocket_planner' then 1 when 'trial' then 1 when 'crew' then 25 else member_limit end
where plan_code in ('free', 'pocket_planner', 'trial', 'crew');

create or replace function public.activate_free_plan_after_trial(target_company_id uuid)
returns public.company_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_subscription public.company_subscriptions;
begin
  if not public.is_company_member(target_company_id) then raise exception 'Workspace access required'; end if;
  update public.company_subscriptions
  set plan_code = 'free',
      status = 'active',
      billing_mode = 'off',
      provider = 'none',
      plan_price_cents = 0,
      promo_percent_off = 0,
      active_job_limit = 5,
      storage_limit_bytes = 262144000,
      member_limit = 1,
      updated_at = now()
  where company_id = target_company_id
    and plan_code = 'trial'
    and status = 'trialing'
    and trial_ends_at <= now()
  returning * into saved_subscription;

  if saved_subscription.company_id is null then
    select * into saved_subscription from public.company_subscriptions where company_id = target_company_id;
  end if;
  return saved_subscription;
end;
$$;

revoke all on function public.activate_free_plan_after_trial(uuid) from public;
grant execute on function public.activate_free_plan_after_trial(uuid) to authenticated;

create or replace function public.enforce_company_job_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  configured_limit integer;
  current_count integer;
  becoming_active boolean;
begin
  becoming_active := new.archived_at is null and new.job_status not in ('Complete', 'Paid');
  if not becoming_active then return new; end if;
  if tg_op = 'UPDATE' and old.archived_at is null and old.job_status not in ('Complete', 'Paid') then return new; end if;

  select active_job_limit into configured_limit
  from public.company_subscriptions where company_id = new.company_id;
  if configured_limit is null then return new; end if;

  select count(*) into current_count
  from public.jobs
  where company_id = new.company_id
    and archived_at is null
    and job_status not in ('Complete', 'Paid')
    and id <> new.id;
  if current_count >= configured_limit then
    raise exception 'Active job limit reached for this plan';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_company_storage_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  configured_limit bigint;
  current_bytes bigint;
begin
  select storage_limit_bytes into configured_limit
  from public.company_subscriptions where company_id = new.company_id;
  if configured_limit is null then return new; end if;

  select coalesce(sum(size_bytes), 0) into current_bytes
  from public.documents
  where company_id = new.company_id
    and storage_file_id is not null
    and id <> new.id;
  if current_bytes + coalesce(new.size_bytes, 0) > configured_limit then
    raise exception 'Document storage limit reached for this plan';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_company_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  configured_limit integer;
  current_count integer;
begin
  if coalesce(new.status, 'active') <> 'active' then return new; end if;
  if tg_op = 'UPDATE' and coalesce(old.status, 'active') = 'active' then return new; end if;
  select member_limit into configured_limit
  from public.company_subscriptions where company_id = new.company_id;
  if configured_limit is null then return new; end if;
  select count(*) into current_count from public.company_members
  where company_id = new.company_id and coalesce(status, 'active') = 'active' and id <> new.id;
  if current_count >= configured_limit then
    raise exception 'Member limit reached for this plan';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_job_write_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_company uuid;
  target_job uuid;
begin
  if tg_op = 'DELETE' then
    target_company := old.company_id;
    target_job := old.id;
  else
    target_company := new.company_id;
    target_job := new.id;
  end if;
  -- Service-role operations have no end-user uid and are checked by their edge function.
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'INSERT' and not public.company_member_is_manager(target_company) then
    raise exception 'Manager access required to create jobs';
  elsif tg_op = 'UPDATE' and not public.company_member_can_update_job(target_job, target_company) then
    raise exception 'This job is not assigned to you';
  elsif tg_op = 'DELETE' and not public.company_member_can_delete_job(target_job, target_company) then
    raise exception 'Owner or admin access required to delete jobs';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create or replace function public.enforce_customer_write_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_company uuid;
begin
  if tg_op = 'DELETE' then target_company := old.company_id; else target_company := new.company_id; end if;
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'UPDATE' and new is not distinct from old then return new; end if;
  if not public.company_member_is_manager(target_company) or not public.company_has_write_access(target_company) then
    raise exception 'Manager access required to change customer details';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists enforce_company_job_limit_trigger on public.jobs;
create trigger enforce_company_job_limit_trigger before insert or update of job_status, archived_at on public.jobs
for each row execute function public.enforce_company_job_limit();
drop trigger if exists enforce_company_storage_limit_trigger on public.documents;
create trigger enforce_company_storage_limit_trigger before insert or update of size_bytes, storage_file_id, company_id on public.documents
for each row execute function public.enforce_company_storage_limit();
drop trigger if exists enforce_company_member_limit_trigger on public.company_members;
create trigger enforce_company_member_limit_trigger before insert or update of status, company_id on public.company_members
for each row execute function public.enforce_company_member_limit();
drop trigger if exists enforce_job_write_scope_trigger on public.jobs;
create trigger enforce_job_write_scope_trigger before insert or update or delete on public.jobs
for each row execute function public.enforce_job_write_scope();
drop trigger if exists enforce_customer_write_scope_trigger on public.customers;
create trigger enforce_customer_write_scope_trigger before insert or update or delete on public.customers
for each row execute function public.enforce_customer_write_scope();

-- Job and child-record policies are assignment scoped. Managers retain company-wide access.
drop policy if exists "Members can read jobs" on public.jobs;
create policy "Assigned members can read jobs" on public.jobs for select to authenticated
using (public.company_member_can_access_job(id, company_id));
drop policy if exists "Members can create jobs" on public.jobs;
create policy "Managers can create jobs" on public.jobs for insert to authenticated
with check (public.company_member_is_manager(company_id) and public.company_has_write_access(company_id) and public.customer_belongs_to_company(customer_id, company_id));
drop policy if exists "Members can update jobs" on public.jobs;
create policy "Assigned members can update jobs" on public.jobs for update to authenticated
using (public.company_member_can_update_job(id, company_id))
with check (public.company_member_can_update_job(id, company_id) and public.customer_belongs_to_company(customer_id, company_id));
drop policy if exists "Members can delete jobs" on public.jobs;
create policy "Owners and admins can delete jobs" on public.jobs for delete to authenticated
using (public.company_member_can_delete_job(id, company_id));

drop policy if exists "Members can read customers" on public.customers;
create policy "Members can read accessible customers" on public.customers for select to authenticated
using (
  public.company_member_is_manager(company_id)
  or exists (select 1 from public.jobs job where job.customer_id = id and public.company_member_can_access_job(job.id, company_id))
);
drop policy if exists "Members can create customers" on public.customers;
create policy "Managers can create customers" on public.customers for insert to authenticated
with check (public.company_member_is_manager(company_id) and public.company_has_write_access(company_id));
drop policy if exists "Members can update customers" on public.customers;
create policy "Managers can update customers" on public.customers for update to authenticated
using (public.company_member_is_manager(company_id) and public.company_has_write_access(company_id))
with check (public.company_member_is_manager(company_id) and public.company_has_write_access(company_id));

drop policy if exists "Members can manage documents" on public.documents;
drop policy if exists "Members can read documents" on public.documents;
drop policy if exists "Members can create documents" on public.documents;
drop policy if exists "Members can update documents" on public.documents;
drop policy if exists "Members can delete documents" on public.documents;
create policy "Assigned members can read documents" on public.documents for select to authenticated
using (public.company_member_can_access_job(job_id, company_id));
create policy "Assigned members can create documents" on public.documents for insert to authenticated
with check (public.company_member_can_update_job(job_id, company_id));
create policy "Assigned members can update documents" on public.documents for update to authenticated
using (public.company_member_can_update_job(job_id, company_id)) with check (public.company_member_can_update_job(job_id, company_id));
create policy "Assigned members can delete documents" on public.documents for delete to authenticated
using (public.company_member_can_update_job(job_id, company_id));

drop policy if exists "Members can manage mileage entries" on public.mileage_entries;
drop policy if exists "Members can read mileage entries" on public.mileage_entries;
drop policy if exists "Members can create mileage entries" on public.mileage_entries;
drop policy if exists "Members can update mileage entries" on public.mileage_entries;
drop policy if exists "Members can delete mileage entries" on public.mileage_entries;
create policy "Assigned members can read mileage" on public.mileage_entries for select to authenticated
using (public.company_member_can_access_job(job_id, company_id));
create policy "Assigned members can create mileage" on public.mileage_entries for insert to authenticated
with check (public.company_member_can_update_job(job_id, company_id));
create policy "Assigned members can update mileage" on public.mileage_entries for update to authenticated
using (public.company_member_can_update_job(job_id, company_id)) with check (public.company_member_can_update_job(job_id, company_id));
create policy "Assigned members can delete mileage" on public.mileage_entries for delete to authenticated
using (public.company_member_can_update_job(job_id, company_id));

drop policy if exists "Members can manage schedule exceptions" on public.schedule_exceptions;
drop policy if exists "Members can read schedule exceptions" on public.schedule_exceptions;
drop policy if exists "Members can create schedule exceptions" on public.schedule_exceptions;
drop policy if exists "Members can update schedule exceptions" on public.schedule_exceptions;
drop policy if exists "Members can delete schedule exceptions" on public.schedule_exceptions;
create policy "Assigned members can read schedule exceptions" on public.schedule_exceptions for select to authenticated
using (public.company_member_can_access_job(job_id, company_id));
create policy "Assigned members can create schedule exceptions" on public.schedule_exceptions for insert to authenticated
with check (public.company_member_can_update_job(job_id, company_id));
create policy "Assigned members can update schedule exceptions" on public.schedule_exceptions for update to authenticated
using (public.company_member_can_update_job(job_id, company_id)) with check (public.company_member_can_update_job(job_id, company_id));
create policy "Assigned members can delete schedule exceptions" on public.schedule_exceptions for delete to authenticated
using (public.company_member_can_update_job(job_id, company_id));

drop policy if exists "Members can manage custom fields" on public.custom_fields;
drop policy if exists "Members can create custom fields" on public.custom_fields;
drop policy if exists "Members can update custom fields" on public.custom_fields;
drop policy if exists "Members can delete custom fields" on public.custom_fields;
create policy "Managers can create custom fields" on public.custom_fields for insert to authenticated
with check (public.company_member_is_manager(company_id) and public.company_has_write_access(company_id));
create policy "Managers can update custom fields" on public.custom_fields for update to authenticated
using (public.company_member_is_manager(company_id) and public.company_has_write_access(company_id))
with check (public.company_member_is_manager(company_id) and public.company_has_write_access(company_id));
create policy "Managers can delete custom fields" on public.custom_fields for delete to authenticated
using (public.company_member_is_manager(company_id) and public.company_has_write_access(company_id));

drop policy if exists "Members can read magic links" on public.magic_links;
create policy "Managers can read magic links" on public.magic_links for select to authenticated
using (public.company_member_is_manager(company_id));
drop policy if exists "Members can read estimate acceptances" on public.estimate_acceptances;
create policy "Assigned members can read estimate acceptances" on public.estimate_acceptances for select to authenticated
using (public.company_member_can_access_job(job_id, company_id));
drop policy if exists "Members can create estimate acceptances" on public.estimate_acceptances;
drop policy if exists "Members can update estimate acceptances" on public.estimate_acceptances;

create or replace function public.job_id_from_storage_path(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return nullif(split_part(object_name, '/', 2), '')::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

drop policy if exists "Members can read job documents" on storage.objects;
drop policy if exists "Members can upload job documents" on storage.objects;
drop policy if exists "Members can update job documents" on storage.objects;
drop policy if exists "Members can delete job documents" on storage.objects;
drop policy if exists "Members can read job document files" on storage.objects;
drop policy if exists "Members can upload job document files" on storage.objects;
drop policy if exists "Members can update job document files" on storage.objects;
drop policy if exists "Members can delete job document files" on storage.objects;
create policy "Assigned members can read job documents" on storage.objects for select to authenticated
using (
  bucket_id = 'job-documents'
  and public.company_member_can_access_job(public.job_id_from_storage_path(name), public.company_id_from_storage_path(name))
);
create policy "Assigned members can upload job documents" on storage.objects for insert to authenticated
with check (
  bucket_id = 'job-documents'
  and public.company_member_can_update_job(public.job_id_from_storage_path(name), public.company_id_from_storage_path(name))
);
create policy "Assigned members can update job documents" on storage.objects for update to authenticated
using (
  bucket_id = 'job-documents'
  and public.company_member_can_update_job(public.job_id_from_storage_path(name), public.company_id_from_storage_path(name))
) with check (
  bucket_id = 'job-documents'
  and public.company_member_can_update_job(public.job_id_from_storage_path(name), public.company_id_from_storage_path(name))
);
create policy "Assigned members can delete job documents" on storage.objects for delete to authenticated
using (
  bucket_id = 'job-documents'
  and public.company_member_can_update_job(public.job_id_from_storage_path(name), public.company_id_from_storage_path(name))
);

drop policy if exists "Members can upload company branding" on storage.objects;
drop policy if exists "Members can update company branding" on storage.objects;
drop policy if exists "Members can delete company branding" on storage.objects;
create policy "Managers can upload company branding" on storage.objects for insert to authenticated
with check (
  bucket_id = 'company-branding'
  and public.company_member_is_manager(public.company_id_from_storage_path(name))
  and public.company_has_write_access(public.company_id_from_storage_path(name))
);
create policy "Managers can update company branding" on storage.objects for update to authenticated
using (
  bucket_id = 'company-branding'
  and public.company_member_is_manager(public.company_id_from_storage_path(name))
  and public.company_has_write_access(public.company_id_from_storage_path(name))
) with check (
  bucket_id = 'company-branding'
  and public.company_member_is_manager(public.company_id_from_storage_path(name))
  and public.company_has_write_access(public.company_id_from_storage_path(name))
);
create policy "Managers can delete company branding" on storage.objects for delete to authenticated
using (
  bucket_id = 'company-branding'
  and public.company_member_is_manager(public.company_id_from_storage_path(name))
  and public.company_has_write_access(public.company_id_from_storage_path(name))
);

-- Company-wide controls are manager-only; members can still read shared configuration.
drop policy if exists "Members can update companies" on public.companies;
create policy "Managers can update companies" on public.companies for update to authenticated
using (public.company_member_is_manager(id) and public.company_has_write_access(id))
with check (public.company_member_is_manager(id) and public.company_has_write_access(id));

