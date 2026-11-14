-- Pocket Planner plan limits and dormant team/crew foundation.
-- Team accounts must not be invited until assigned-job RLS is enabled in a later migration.

alter table public.company_subscriptions
  add column if not exists plan_code text not null default 'trial',
  add column if not exists active_job_limit integer,
  add column if not exists storage_limit_bytes bigint,
  add column if not exists member_limit integer;

alter table public.company_subscriptions
  drop constraint if exists company_subscriptions_plan_code_check;

alter table public.company_subscriptions
  add constraint company_subscriptions_plan_code_check
  check (plan_code in ('trial', 'free', 'pocket_planner', 'crew', 'custom'));

alter table public.company_subscriptions
  drop constraint if exists company_subscriptions_capacity_check;

alter table public.company_subscriptions
  add constraint company_subscriptions_capacity_check
  check (
    (active_job_limit is null or active_job_limit > 0)
    and (storage_limit_bytes is null or storage_limit_bytes > 0)
    and (member_limit is null or member_limit > 0)
  );

comment on column public.company_subscriptions.active_job_limit is
  'Maximum non-complete, non-paid jobs. Null means temporarily unlimited.';
comment on column public.company_subscriptions.storage_limit_bytes is
  'Maximum uploaded document bytes. Null means temporarily unlimited.';
comment on column public.company_subscriptions.member_limit is
  'Maximum active company memberships. Null means temporarily unlimited.';

alter table public.company_members
  add column if not exists display_name text,
  add column if not exists email text,
  add column if not exists status text not null default 'active';

update public.company_members
set role = case when role in ('owner', 'admin', 'office_manager', 'crew_lead', 'crew') then role else 'crew' end;

alter table public.company_members
  drop constraint if exists company_members_role_check;
alter table public.company_members
  add constraint company_members_role_check
  check (role in ('owner', 'admin', 'office_manager', 'crew_lead', 'crew'));

alter table public.company_members
  drop constraint if exists company_members_status_check;
alter table public.company_members
  add constraint company_members_status_check
  check (status in ('active', 'disabled'));

create unique index if not exists company_members_company_email_idx
on public.company_members(company_id, lower(email))
where email is not null;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  color text not null default '#176b5b',
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, name),
  constraint teams_name_check check (char_length(trim(name)) between 1 and 80),
  constraint teams_color_check check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  membership_id uuid not null references public.company_members(id) on delete cascade,
  is_lead boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(team_id, membership_id)
);

create table if not exists public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  membership_id uuid references public.company_members(id) on delete cascade,
  assigned_by uuid,
  created_at timestamptz not null default now(),
  constraint job_assignments_target_check check (
    (team_id is not null and membership_id is null)
    or (team_id is null and membership_id is not null)
  )
);

create unique index if not exists job_assignments_job_team_idx
on public.job_assignments(job_id, team_id)
where team_id is not null;
create unique index if not exists job_assignments_job_member_idx
on public.job_assignments(job_id, membership_id)
where membership_id is not null;
create index if not exists job_assignments_company_job_idx
on public.job_assignments(company_id, job_id);

create or replace function public.company_member_can_manage_teams(target_company_id uuid)
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
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'office_manager')
  ) and public.company_has_write_access(target_company_id);
$$;

revoke all on function public.company_member_can_manage_teams(uuid) from public;
grant execute on function public.company_member_can_manage_teams(uuid) to authenticated, service_role;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.job_assignments enable row level security;

create policy "Members can read teams"
on public.teams for select to authenticated
using (public.is_company_member(company_id));
create policy "Managers can create teams"
on public.teams for insert to authenticated
with check (public.company_member_can_manage_teams(company_id));
create policy "Managers can update teams"
on public.teams for update to authenticated
using (public.company_member_can_manage_teams(company_id))
with check (public.company_member_can_manage_teams(company_id));
create policy "Managers can delete teams"
on public.teams for delete to authenticated
using (public.company_member_can_manage_teams(company_id));

create policy "Members can read team memberships"
on public.team_members for select to authenticated
using (
  exists (
    select 1 from public.teams team
    where team.id = team_id and public.is_company_member(team.company_id)
  )
);
create policy "Managers can create team memberships"
on public.team_members for insert to authenticated
with check (
  exists (
    select 1 from public.teams team
    join public.company_members membership on membership.id = membership_id
    where team.id = team_id
      and membership.company_id = team.company_id
      and public.company_member_can_manage_teams(team.company_id)
  )
);
create policy "Managers can update team memberships"
on public.team_members for update to authenticated
using (
  exists (select 1 from public.teams team where team.id = team_id and public.company_member_can_manage_teams(team.company_id))
)
with check (
  exists (select 1 from public.teams team where team.id = team_id and public.company_member_can_manage_teams(team.company_id))
);
create policy "Managers can delete team memberships"
on public.team_members for delete to authenticated
using (
  exists (select 1 from public.teams team where team.id = team_id and public.company_member_can_manage_teams(team.company_id))
);

create policy "Members can read job assignments"
on public.job_assignments for select to authenticated
using (public.is_company_member(company_id));
create policy "Managers can create job assignments"
on public.job_assignments for insert to authenticated
with check (
  public.company_member_can_manage_teams(company_id)
  and public.job_belongs_to_company(job_id, company_id)
);
create policy "Managers can update job assignments"
on public.job_assignments for update to authenticated
using (public.company_member_can_manage_teams(company_id))
with check (
  public.company_member_can_manage_teams(company_id)
  and public.job_belongs_to_company(job_id, company_id)
);
create policy "Managers can delete job assignments"
on public.job_assignments for delete to authenticated
using (public.company_member_can_manage_teams(company_id));

grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.job_assignments to authenticated;

drop trigger if exists touch_teams_updated_at on public.teams;
create trigger touch_teams_updated_at
before update on public.teams
for each row execute function public.touch_updated_at();
