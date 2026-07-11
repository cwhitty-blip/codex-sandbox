alter table public.documents alter column storage_provider set default 'supabase';

revoke update on public.companies from authenticated;
grant update (name, billing_provider, billing_account, billing_sync) on public.companies to authenticated;

create unique index if not exists magic_links_token_hash_idx on public.magic_links(token_hash);
create index if not exists magic_links_job_created_idx on public.magic_links(job_id, created_at desc);
create index if not exists documents_job_created_idx on public.documents(job_id, created_at desc);
