-- These security-definer functions are private backend primitives. Authenticated
-- clients reach them only through the JWT-verifying secure-message Edge Function.
revoke all on function public.register_messaging_device(uuid, text, integer, bytea, integer, bytea, bytea, integer, bytea, bytea, integer, bytea) from public;
revoke all on function public.claim_messaging_prekey(uuid) from public;
revoke all on function public.claim_messaging_pairing(bytea, uuid) from public;

grant execute on function public.register_messaging_device(uuid, text, integer, bytea, integer, bytea, bytea, integer, bytea, bytea, integer, bytea) to service_role;
grant execute on function public.claim_messaging_prekey(uuid) to service_role;
grant execute on function public.claim_messaging_pairing(bytea, uuid) to service_role;
