alter table public.companies
add column if not exists logo_path text;

alter table public.magic_links
add column if not exists message_type text not null default 'access';

alter table public.magic_links
add column if not exists provider_message_id text;

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

create index if not exists magic_links_job_message_created_idx
on public.magic_links(job_id, message_type, created_at desc);
