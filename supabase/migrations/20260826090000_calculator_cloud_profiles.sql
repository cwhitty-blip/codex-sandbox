create table if not exists public.calculator_cloud_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"version":1,"data":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.calculator_cloud_profiles enable row level security;

drop policy if exists "calculator cloud profiles select own" on public.calculator_cloud_profiles;
create policy "calculator cloud profiles select own"
on public.calculator_cloud_profiles for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "calculator cloud profiles insert own" on public.calculator_cloud_profiles;
create policy "calculator cloud profiles insert own"
on public.calculator_cloud_profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "calculator cloud profiles update own" on public.calculator_cloud_profiles;
create policy "calculator cloud profiles update own"
on public.calculator_cloud_profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.calculator_cloud_profiles to authenticated;
revoke all on public.calculator_cloud_profiles from anon;
