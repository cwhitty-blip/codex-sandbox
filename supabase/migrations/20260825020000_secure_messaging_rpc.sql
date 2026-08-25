-- Atomic pairing consumption prevents two devices from claiming the same QR secret.
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
  update public.messaging_pairings
     set joined_device_id = joining_device, consumed_at = now()
   where invitation_hash = invitation_hash_input
     and joined_device_id is null
     and consumed_at is null
     and expires_at > now()
   returning * into result;
  if result.id is null then raise exception 'Pairing is invalid, expired, or already used' using errcode = 'P0001'; end if;
  return result;
end;
$$;

revoke all on function public.claim_messaging_pairing(bytea, uuid) from public;
