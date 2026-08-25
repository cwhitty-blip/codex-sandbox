-- Secure Messaging foundation. This migration deliberately stores only public
-- device keys and opaque ciphertext envelopes: never message text or private keys.

create table if not exists public.messaging_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text not null check (char_length(device_name) between 1 and 80),
  identity_key bytea not null check (octet_length(identity_key) between 32 and 4096),
  signed_prekey bytea not null check (octet_length(signed_prekey) between 32 and 4096),
  signed_prekey_signature bytea not null check (octet_length(signed_prekey_signature) between 32 and 4096),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, id)
);

create table if not exists public.messaging_pairings (
  id uuid primary key default gen_random_uuid(),
  invitation_hash bytea not null unique check (octet_length(invitation_hash) = 32),
  initiator_device_id uuid not null references public.messaging_devices(id) on delete cascade,
  joined_device_id uuid references public.messaging_devices(id) on delete set null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '15 minutes'),
  check (joined_device_id is null or joined_device_id <> initiator_device_id)
);

create table if not exists public.messaging_envelopes (
  id uuid primary key default gen_random_uuid(),
  sender_device_id uuid not null references public.messaging_devices(id) on delete restrict,
  recipient_device_id uuid not null references public.messaging_devices(id) on delete cascade,
  -- Opaque, client-encrypted envelope. The database must not be able to read it.
  header jsonb not null default '{}'::jsonb,
  ciphertext bytea not null check (octet_length(ciphertext) between 1 and 1048576),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  check (sender_device_id <> recipient_device_id)
);

create index if not exists messaging_envelopes_recipient_created_idx
  on public.messaging_envelopes (recipient_device_id, created_at);
create index if not exists messaging_pairings_expiry_idx
  on public.messaging_pairings (expires_at) where consumed_at is null;

alter table public.messaging_devices enable row level security;
alter table public.messaging_pairings enable row level security;
alter table public.messaging_envelopes enable row level security;

create policy "messaging users manage their own devices"
  on public.messaging_devices for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Fetching a paired device's public key is intentionally handled by the
-- authenticated pairing Edge Function. Keeping the base table self-only avoids
-- a recursive RLS policy and prevents public-key enumeration.

create policy "initiator can create and view short lived pairings"
  on public.messaging_pairings for select to authenticated
  using (exists (select 1 from public.messaging_devices d where d.id = initiator_device_id and d.user_id = auth.uid()));
create policy "initiator can create pairings"
  on public.messaging_pairings for insert to authenticated
  with check (
    expires_at > now()
    and exists (select 1 from public.messaging_devices d where d.id = initiator_device_id and d.user_id = auth.uid())
  );

-- Joining a pairing is intentionally not exposed as a client-side update policy.
-- It must be performed atomically by an authenticated Edge Function after it
-- hashes the one-time invitation secret and validates expiry/first use.

-- Envelope insertion is intentionally handled by an authenticated Edge Function.
-- It verifies a completed pairing and enforces per-device rate limits before a
-- service-role insert. Clients cannot enumerate device ids or spam arbitrary ids.
create policy "participants can read their ciphertext envelopes"
  on public.messaging_envelopes for select to authenticated
  using (
    exists (select 1 from public.messaging_devices d where d.id = recipient_device_id and d.user_id = auth.uid())
    or exists (select 1 from public.messaging_devices d where d.id = sender_device_id and d.user_id = auth.uid())
  );
create policy "recipient can acknowledge ciphertext envelopes"
  on public.messaging_envelopes for update to authenticated
  using (exists (select 1 from public.messaging_devices d where d.id = recipient_device_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.messaging_devices d where d.id = recipient_device_id and d.user_id = auth.uid()));
