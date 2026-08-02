create or replace function public.bootstrap_company(company_name text, promo_code text default null)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  company public.companies;
  clean_promo text := lower(nullif(trim(promo_code), ''));
  promotion public.billing_promo_codes;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select c.*
  into company
  from public.companies c
  join public.company_members cm on cm.company_id = c.id
  where cm.user_id = auth.uid()
  order by c.created_at
  limit 1;

  if company.id is null then
    insert into public.companies (name, trial_started_at, trial_ends_at, subscription_status)
    values (
      coalesce(nullif(trim(company_name), ''), 'Service Company'),
      now(),
      now() + interval '14 days',
      'trialing'
    )
    returning * into company;

    insert into public.company_members (company_id, user_id, role)
    values (company.id, auth.uid(), 'owner');
  end if;

  insert into public.company_subscriptions (
    company_id,
    provider,
    billing_mode,
    billing_email,
    status,
    base_plan_price_cents,
    plan_price_cents,
    trial_started_at,
    trial_ends_at
  )
  values (
    company.id,
    'none',
    'off',
    lower(nullif(auth.jwt() ->> 'email', '')),
    'trialing',
    1299,
    1299,
    company.trial_started_at,
    company.trial_ends_at
  )
  on conflict (company_id) do nothing;

  if clean_promo is not null then
    select *
    into promotion
    from public.billing_promo_codes
    where code = clean_promo
      and active = true
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now());

    if promotion.code is not null then
      update public.company_subscriptions as subscription
      set
        promo_code = promotion.code,
        promo_percent_off = promotion.percent_off,
        plan_price_cents = round(subscription.base_plan_price_cents * (100 - promotion.percent_off) / 100.0),
        checkout_url = promotion.checkout_url,
        external_checkout_id = promotion.external_checkout_id,
        updated_at = now()
      where subscription.company_id = company.id
        and subscription.promo_code is null;
    end if;
  end if;

  return company;
end;
$$;

revoke all on function public.bootstrap_company(text, text) from public;
grant execute on function public.bootstrap_company(text, text) to authenticated;
