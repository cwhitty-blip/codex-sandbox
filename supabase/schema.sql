create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  billing_provider text,
  billing_account text,
  billing_sync text default 'Invoice links only',
  created_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique(company_id, user_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  industry text not null default 'general',
  name text not null,
  service_address text,
  job_status text not null default 'Active',
  material_status text not null default 'Not Ordered',
  projected_date date,
  invoice_url text,
  next_action text,
  internal_notes text,
  custom_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  label text not null,
  field_type text not null default 'text',
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  name text not null,
  document_type text not null default 'Other',
  uploaded_by text not null,
  visibility text not null default 'Staff Only',
  status text not null default 'New',
  storage_provider text not null default 'google_drive',
  storage_file_id text,
  storage_url text,
  version integer,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.magic_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  token_hash text not null,
  sent_to text not null,
  channel text not null default 'email',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.estimate_acceptances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  accepted_from_ip text,
  user_agent text
);

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.customers enable row level security;
alter table public.jobs enable row level security;
alter table public.custom_fields enable row level security;
alter table public.documents enable row level security;
alter table public.magic_links enable row level security;
alter table public.estimate_acceptances enable row level security;
