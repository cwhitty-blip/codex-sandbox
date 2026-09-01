-- Adds the missing Signal-compatible pre-key bundle fields and atomic one-time
-- pre-key consumption. Existing foundation rows remain valid but cannot be used
-- for a new session until they are re-registered with a complete bundle.

alter table public.messaging_devices
  add column if not exists registration_id integer check (registration_id between 1 and 16380),
  add column if not exists signed_prekey_id integer check (signed_prekey_id >= 0),
  add column if not exists kyber_prekey_id integer check (kyber_prekey_id >= 0),
  add column if not exists kyber_prekey bytea check (octet_length(kyber_prekey) between 32 and 4096),
  add column if not exists kyber_prekey_signature bytea check (octet_length(kyber_prekey_signature) between 32 and 4096);

create table if not exists public.messaging_prekeys (
  device_id uuid not null references public.messaging_devices(id) on delete cascade,
  key_id integer not null check (key_id >= 0),
  public_key bytea not null check (octet_length(public_key) between 32 and 4096),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (device_id, key_id)
);

alter table public.messaging_prekeys enable row level security;

-- Pre-keys are served only by the authenticated Edge Function. Clients cannot
-- enumerate or claim them directly.

alter table public.messaging_envelopes
  add column if not exists client_message_id uuid;

create unique index if not exists messaging_envelopes_sender_message_idx
  on public.messaging_envelopes (sender_device_id, client_message_id)
  where client_message_id is not null;

create or replace function public.register_messaging_device(
  owner_id uuid,
  device_name_input text,
  registration_id_input integer,
  identity_key_input bytea,
  signed_prekey_id_input integer,
  signed_prekey_input bytea,
  signed_prekey_signature_input bytea,
  kyber_prekey_id_input integer,
  kyber_prekey_input bytea,
  kyber_prekey_signature_input bytea,
  one_time_prekey_id_input integer,
  one_time_prekey_input bytea
)
returns public.messaging_devices
language plpgsql
security definer
set search_path = public
as $$
declare result public.messaging_devices;
begin
  insert into public.messaging_devices (
    user_id, device_name, registration_id, identity_key,
    signed_prekey_id, signed_prekey, signed_prekey_signature,
    kyber_prekey_id, kyber_prekey, kyber_prekey_signature
  ) values (
    owner_id, device_name_input, registration_id_input, identity_key_input,
    signed_prekey_id_input, signed_prekey_input, signed_prekey_signature_input,
    kyber_prekey_id_input, kyber_prekey_input, kyber_prekey_signature_input
  ) returning * into result;

  insert into public.messaging_prekeys (device_id, key_id, public_key)
  values (result.id, one_time_prekey_id_input, one_time_prekey_input);
  return result;
end;
$$;

create or replace function public.claim_messaging_prekey(target_device uuid)
returns table (key_id integer, public_key bytea)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select p.ctid
      from public.messaging_prekeys p
     where p.device_id = target_device and p.claimed_at is null
     order by p.key_id
     for update skip locked
     limit 1
  )
  update public.messaging_prekeys p
     set claimed_at = now()
    from candidate
   where p.ctid = candidate.ctid
  returning p.key_id, p.public_key;
end;
$$;

create or replace function public.claim_messaging_pairing(
  invitation_hash_input bytea,
  joining_device uuid
)
returns public.messaging_pairings
language plpgsql
security definer
set search_path = public
as $$
declare result public.messaging_pairings;
begin
  update public.messaging_pairings p
     set joined_device_id = joining_device, consumed_at = now()
   where p.invitation_hash = invitation_hash_input
     and p.joined_device_id is null
     and p.consumed_at is null
     and p.expires_at > now()
     and exists (select 1 from public.messaging_devices d where d.id = p.initiator_device_id and d.revoked_at is null)
     and exists (select 1 from public.messaging_devices d where d.id = joining_device and d.revoked_at is null)
   returning p.* into result;
  if result.id is null then
    raise exception 'Pairing is invalid, expired, already used, or revoked' using errcode = 'P0001';
  end if;
  return result;
end;
$$;

revoke all on function public.register_messaging_device(uuid, text, integer, bytea, integer, bytea, bytea, integer, bytea, bytea, integer, bytea) from public;
revoke all on function public.claim_messaging_prekey(uuid) from public;
revoke all on function public.claim_messaging_pairing(bytea, uuid) from public;
