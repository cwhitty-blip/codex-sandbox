create or replace function public.billing_admin_create_coupon(
  input_percent_off integer,
  input_assigned_email text default null,
  input_assigned_company_id uuid default null,
  input_ends_at timestamptz default null,
  input_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_email text := lower(nullif(trim(input_assigned_email), ''));
  generated_code text;
  created_promotion public.billing_promo_codes;
  attempt integer := 0;
begin
  if not public.is_platform_billing_admin() then
    raise exception 'Billing administrator access required';
  end if;

  if input_percent_off not in (25, 50, 75, 100) then
    raise exception 'Discount must be 25, 50, 75, or 100 percent';
  end if;

  if clean_email is null and input_assigned_company_id is null then
    raise exception 'Assign the code to an email or account';
  end if;

  if input_assigned_company_id is not null
    and not exists (select 1 from public.companies where id = input_assigned_company_id) then
    raise exception 'Account not found';
  end if;

  while attempt < 10 loop
    attempt := attempt + 1;
    generated_code := 'SAVE-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4))
      || '-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4));

    insert into public.billing_promo_codes (
      code,
      percent_off,
      active,
      assigned_email,
      assigned_company_id,
      max_redemptions,
      starts_at,
      ends_at,
      created_by,
      admin_note
    )
    values (
      lower(generated_code),
      input_percent_off,
      true,
      clean_email,
      input_assigned_company_id,
      1,
      now(),
      input_ends_at,
      auth.uid(),
      nullif(trim(input_note), '')
    )
    on conflict (code) do nothing
    returning * into created_promotion;

    exit when created_promotion.code is not null;
  end loop;

  if created_promotion.code is null then
    raise exception 'Could not generate a unique code';
  end if;

  insert into public.billing_change_log (actor_user_id, company_id, action, details)
  values (
    auth.uid(),
    input_assigned_company_id,
    'coupon_created',
    jsonb_build_object(
      'code', created_promotion.code,
      'percent_off', created_promotion.percent_off,
      'assigned_email', created_promotion.assigned_email,
      'ends_at', created_promotion.ends_at
    )
  );

  return jsonb_build_object(
    'code', upper(created_promotion.code),
    'percent_off', created_promotion.percent_off,
    'assigned_email', created_promotion.assigned_email,
    'assigned_company_id', created_promotion.assigned_company_id,
    'ends_at', created_promotion.ends_at
  );
end;
$$;

revoke all on function public.billing_admin_create_coupon(integer, text, uuid, timestamptz, text) from public;
grant execute on function public.billing_admin_create_coupon(integer, text, uuid, timestamptz, text) to authenticated;
