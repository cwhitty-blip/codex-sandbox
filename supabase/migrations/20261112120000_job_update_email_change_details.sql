alter table public.job_update_events
add column if not exists change_summaries jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_update_events_change_summaries_array_check'
  ) then
    alter table public.job_update_events
      add constraint job_update_events_change_summaries_array_check
      check (jsonb_typeof(change_summaries) = 'array');
  end if;
end;
$$;

comment on column public.job_update_events.change_summaries is
  'Customer-safe descriptions of changes to include in the next scheduled job update email.';
