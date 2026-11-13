create table if not exists public.platform_billing_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_billing_admins enable row level security;
revoke all on public.platform_billing_admins from anon, authenticated;

create or replace function public.is_platform_billing_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.platform_billing_admins administrator
      where administrator.user_id = auth.uid()
    );
$$;

revoke all on function public.is_platform_billing_admin() from public;
grant execute on function public.is_platform_billing_admin() to authenticated, service_role;

create or replace function public.grant_platform_billing_admin(input_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(nullif(trim(input_email), ''))
  limit 1;

  if target_user_id is null then
    raise exception 'Account not found';
  end if;

  insert into public.platform_billing_admins (user_id)
  values (target_user_id)
  on conflict (user_id) do nothing;

  return target_user_id;
end;
$$;

revoke all on function public.grant_platform_billing_admin(text) from public;
grant execute on function public.grant_platform_billing_admin(text) to service_role;

create table if not exists public.billing_plan_options (
  percent_off integer primary key,
  base_price_cents integer not null default 1299,
  monthly_price_cents integer not null,
  checkout_url text,
  external_checkout_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_plan_options_percent_check check (percent_off in (0, 25, 50, 75, 100)),
  constraint billing_plan_options_base_price_check check (base_price_cents = 1299),
  constraint billing_plan_options_monthly_price_check check (monthly_price_cents >= 0)
);

insert into public.billing_plan_options (percent_off, monthly_price_cents)
values
  (0, 1299),
  (25, 974),
  (50, 650),
  (75, 325),
  (100, 0)
on conflict (percent_off) do update
set monthly_price_cents = excluded.monthly_price_cents;

alter table public.billing_plan_options enable row level security;
revoke all on public.billing_plan_options from anon, authenticated;

alter table public.billing_promo_codes
drop constraint if exists billing_promo_codes_percent_check;

alter table public.billing_promo_codes
add constraint billing_promo_codes_percent_check check (percent_off between 1 and 100);

alter table public.billing_promo_codes
add column if not exists assigned_email text,
add column if not exists assigned_company_id uuid references public.companies(id) on delete set null,
add column if not exists max_redemptions integer not null default 1,
add column if not exists redemption_count integer not null default 0,
add column if not exists redeemed_at timestamptz,
add column if not exists created_by uuid references auth.users(id) on delete set null,
add column if not exists admin_note text;

alter table public.billing_promo_codes
drop constraint if exists billing_promo_codes_assigned_email_check;

alter table public.billing_promo_codes
add constraint billing_promo_codes_assigned_email_check
check (assigned_email is null or assigned_email = lower(trim(assigned_email)));

alter table public.billing_promo_codes
drop constraint if exists billing_promo_codes_redemption_check;

alter table public.billing_promo_codes
add constraint billing_promo_codes_redemption_check
check (max_redemptions > 0 and redemption_count between 0 and max_redemptions);

create index if not exists billing_promo_codes_assigned_email_idx
on public.billing_promo_codes(assigned_email)
where assigned_email is not null;

create index if not exists billing_promo_codes_assigned_company_idx
on public.billing_promo_codes(assigned_company_id)
where assigned_company_id is not null;

alter table public.company_subscriptions
add column if not exists next_invoice_at timestamptz,
add column if not exists external_invoice_url text,
add column if not exists admin_notes text,
add column if not exists discount_ends_at timestamptz;

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null default 'wave',
  external_payment_id text,
  external_invoice_id text,
  external_invoice_url text,
  amount_cents integer not null,
  currency_code text not null default 'USD',
  status text not null,
  period_starts_at timestamptz,
  period_ends_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_payments_provider_check check (provider in ('wave', 'manual')),
  constraint billing_payments_amount_check check (amount_cents >= 0),
  constraint billing_payments_currency_check check (currency_code = upper(currency_code) and char_length(currency_code) = 3),
  constraint billing_payments_status_check check (status in ('pending', 'paid', 'failed', 'refunded', 'void'))
);

alter table public.billing_payments enable row level security;
revoke all on public.billing_payments from anon, authenticated;

create unique index if not exists billing_payments_external_payment_idx
on public.billing_payments(provider, external_payment_id)
where external_payment_id is not null;

create index if not exists billing_payments_company_created_idx
on public.billing_payments(company_id, created_at desc);

create table if not exists public.billing_change_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.billing_change_log enable row level security;
revoke all on public.billing_change_log from anon, authenticated;

create index if not exists billing_change_log_company_created_idx
on public.billing_change_log(company_id, created_at desc);

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
    generated_code := 'SAVE-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4))
      || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4));

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

create or replace function public.apply_billing_promo_code(input_code text)
returns public.company_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_code text := lower(nullif(trim(input_code), ''));
  membership_company_id uuid;
  member_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  promotion public.billing_promo_codes;
  plan_option public.billing_plan_options;
  existing_subscription public.company_subscriptions;
  saved_subscription public.company_subscriptions;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select company_id
  into membership_company_id
  from public.company_members
  where user_id = auth.uid()
  order by created_at
  limit 1;

  if membership_company_id is null then
    raise exception 'Workspace not found';
  end if;

  select *
  into existing_subscription
  from public.company_subscriptions
  where company_id = membership_company_id;

  if existing_subscription.promo_code = clean_code then
    return existing_subscription;
  end if;

  select *
  into promotion
  from public.billing_promo_codes
  where code = clean_code
    and active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  for update;

  if promotion.code is null
    or promotion.percent_off not in (25, 50, 75, 100)
    or (promotion.assigned_email is not null and promotion.assigned_email <> member_email)
    or (promotion.assigned_company_id is not null and promotion.assigned_company_id <> membership_company_id)
    or promotion.redemption_count >= promotion.max_redemptions then
    raise exception 'Promo code is not active';
  end if;

  select *
  into plan_option
  from public.billing_plan_options
  where percent_off = promotion.percent_off
    and active = true;

  if plan_option.percent_off is null then
    raise exception 'Promo code is not active';
  end if;

  update public.company_subscriptions
  set
    provider = case when promotion.percent_off = 100 then 'none' else provider end,
    billing_mode = case when promotion.percent_off = 100 then 'manual' else billing_mode end,
    status = case when promotion.percent_off = 100 then 'active' else status end,
    promo_code = promotion.code,
    promo_percent_off = promotion.percent_off,
    plan_price_cents = plan_option.monthly_price_cents,
    checkout_url = plan_option.checkout_url,
    external_checkout_id = plan_option.external_checkout_id,
    current_period_starts_at = case when promotion.percent_off = 100 then now() else current_period_starts_at end,
    current_period_ends_at = case when promotion.percent_off = 100 then null else current_period_ends_at end,
    grace_ends_at = case when promotion.percent_off = 100 then null else grace_ends_at end,
    discount_ends_at = null,
    updated_at = now()
  where company_id = membership_company_id
    and status in ('beta', 'trialing', 'past_due')
  returning * into saved_subscription;

  if saved_subscription.company_id is null then
    raise exception 'Promo code cannot be changed for this subscription';
  end if;

  update public.billing_promo_codes
  set
    assigned_email = coalesce(assigned_email, member_email),
    assigned_company_id = coalesce(assigned_company_id, membership_company_id),
    redemption_count = redemption_count + 1,
    redeemed_at = now(),
    updated_at = now()
  where code = promotion.code;

  insert into public.billing_change_log (actor_user_id, company_id, action, details)
  values (
    auth.uid(),
    membership_company_id,
    'coupon_redeemed',
    jsonb_build_object('code', promotion.code, 'percent_off', promotion.percent_off)
  );

  return saved_subscription;
end;
$$;

revoke all on function public.apply_billing_promo_code(text) from public;
grant execute on function public.apply_billing_promo_code(text) to authenticated;

create or replace function public.billing_admin_update_account(
  target_company_id uuid,
  input_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_subscription public.company_subscriptions;
  next_status text;
  next_mode text;
  next_provider text;
begin
  if not public.is_platform_billing_admin() then
    raise exception 'Billing administrator access required';
  end if;

  if not exists (select 1 from public.company_subscriptions where company_id = target_company_id) then
    raise exception 'Account not found';
  end if;

  next_status := coalesce(nullif(input_changes ->> 'status', ''), (select status from public.company_subscriptions where company_id = target_company_id));
  next_mode := coalesce(nullif(input_changes ->> 'billing_mode', ''), (select billing_mode from public.company_subscriptions where company_id = target_company_id));
  next_provider := coalesce(nullif(input_changes ->> 'provider', ''), (select provider from public.company_subscriptions where company_id = target_company_id));

  if next_status not in ('beta', 'trialing', 'active', 'past_due', 'cancelled') then
    raise exception 'Invalid account status';
  end if;
  if next_mode not in ('off', 'manual', 'wave') then
    raise exception 'Invalid billing mode';
  end if;
  if next_provider not in ('none', 'wave') then
    raise exception 'Invalid billing provider';
  end if;

  update public.company_subscriptions
  set
    status = next_status,
    billing_mode = next_mode,
    provider = next_provider,
    billing_email = case when input_changes ? 'billing_email' then lower(nullif(trim(input_changes ->> 'billing_email'), '')) else billing_email end,
    next_invoice_at = case when input_changes ? 'next_invoice_at' then nullif(input_changes ->> 'next_invoice_at', '')::timestamptz else next_invoice_at end,
    current_period_ends_at = case when input_changes ? 'current_period_ends_at' then nullif(input_changes ->> 'current_period_ends_at', '')::timestamptz else current_period_ends_at end,
    grace_ends_at = case when input_changes ? 'grace_ends_at' then nullif(input_changes ->> 'grace_ends_at', '')::timestamptz else grace_ends_at end,
    external_customer_id = case when input_changes ? 'external_customer_id' then nullif(trim(input_changes ->> 'external_customer_id'), '') else external_customer_id end,
    external_contract_id = case when input_changes ? 'external_contract_id' then nullif(trim(input_changes ->> 'external_contract_id'), '') else external_contract_id end,
    external_invoice_url = case when input_changes ? 'external_invoice_url' then nullif(trim(input_changes ->> 'external_invoice_url'), '') else external_invoice_url end,
    admin_notes = case when input_changes ? 'admin_notes' then nullif(trim(input_changes ->> 'admin_notes'), '') else admin_notes end,
    last_reconciled_at = now(),
    updated_at = now()
  where company_id = target_company_id
  returning * into saved_subscription;

  insert into public.billing_change_log (actor_user_id, company_id, action, details)
  values (
    auth.uid(),
    target_company_id,
    'account_updated',
    jsonb_build_object(
      'status', saved_subscription.status,
      'billing_mode', saved_subscription.billing_mode,
      'provider', saved_subscription.provider,
      'next_invoice_at', saved_subscription.next_invoice_at
    )
  );

  return to_jsonb(saved_subscription);
end;
$$;

revoke all on function public.billing_admin_update_account(uuid, jsonb) from public;
grant execute on function public.billing_admin_update_account(uuid, jsonb) to authenticated;

create or replace function public.billing_admin_record_payment(
  target_company_id uuid,
  input_payment jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_payment public.billing_payments;
  payment_status text := lower(coalesce(nullif(input_payment ->> 'status', ''), 'paid'));
  payment_provider text := lower(coalesce(nullif(input_payment ->> 'provider', ''), 'wave'));
  payment_amount integer := coalesce((input_payment ->> 'amount_cents')::integer, -1);
  payment_paid_at timestamptz := coalesce(nullif(input_payment ->> 'paid_at', '')::timestamptz, now());
  payment_period_end timestamptz;
begin
  if not public.is_platform_billing_admin() then
    raise exception 'Billing administrator access required';
  end if;

  if not exists (select 1 from public.company_subscriptions where company_id = target_company_id) then
    raise exception 'Account not found';
  end if;

  if payment_status not in ('pending', 'paid', 'failed', 'refunded', 'void') then
    raise exception 'Invalid payment status';
  end if;
  if payment_provider not in ('wave', 'manual') then
    raise exception 'Invalid payment provider';
  end if;
  if payment_amount < 0 then
    raise exception 'Payment amount is required';
  end if;

  payment_period_end := nullif(input_payment ->> 'period_ends_at', '')::timestamptz;
  if payment_status = 'paid' and payment_period_end is null then
    payment_period_end := payment_paid_at + interval '1 month';
  end if;

  insert into public.billing_payments (
    company_id,
    provider,
    external_payment_id,
    external_invoice_id,
    external_invoice_url,
    amount_cents,
    currency_code,
    status,
    period_starts_at,
    period_ends_at,
    due_at,
    paid_at,
    notes,
    recorded_by
  )
  values (
    target_company_id,
    payment_provider,
    nullif(trim(input_payment ->> 'external_payment_id'), ''),
    nullif(trim(input_payment ->> 'external_invoice_id'), ''),
    nullif(trim(input_payment ->> 'external_invoice_url'), ''),
    payment_amount,
    upper(coalesce(nullif(input_payment ->> 'currency_code', ''), 'USD')),
    payment_status,
    nullif(input_payment ->> 'period_starts_at', '')::timestamptz,
    payment_period_end,
    nullif(input_payment ->> 'due_at', '')::timestamptz,
    case when payment_status = 'paid' then payment_paid_at else null end,
    nullif(trim(input_payment ->> 'notes'), ''),
    auth.uid()
  )
  returning * into saved_payment;

  if payment_status = 'paid' then
    update public.company_subscriptions
    set
      provider = case when payment_provider = 'wave' then 'wave' else provider end,
      status = 'active',
      last_invoice_id = coalesce(saved_payment.external_invoice_id, last_invoice_id),
      external_invoice_url = coalesce(saved_payment.external_invoice_url, external_invoice_url),
      last_paid_at = saved_payment.paid_at,
      current_period_starts_at = coalesce(saved_payment.period_starts_at, saved_payment.paid_at),
      current_period_ends_at = saved_payment.period_ends_at,
      next_invoice_at = saved_payment.period_ends_at,
      grace_ends_at = null,
      last_reconciled_at = now(),
      updated_at = now()
    where company_id = target_company_id;
  elsif payment_status = 'failed' then
    update public.company_subscriptions
    set
      status = 'past_due',
      grace_ends_at = now() + interval '7 days',
      last_reconciled_at = now(),
      updated_at = now()
    where company_id = target_company_id;
  end if;

  insert into public.billing_change_log (actor_user_id, company_id, action, details)
  values (
    auth.uid(),
    target_company_id,
    'payment_recorded',
    jsonb_build_object(
      'payment_id', saved_payment.id,
      'status', saved_payment.status,
      'amount_cents', saved_payment.amount_cents,
      'provider', saved_payment.provider
    )
  );

  return to_jsonb(saved_payment);
end;
$$;

revoke all on function public.billing_admin_record_payment(uuid, jsonb) from public;
grant execute on function public.billing_admin_record_payment(uuid, jsonb) to authenticated;

create or replace function public.billing_admin_set_plan_option(
  input_percent_off integer,
  input_checkout_url text default null,
  input_external_checkout_id text default null,
  input_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_option public.billing_plan_options;
begin
  if not public.is_platform_billing_admin() then
    raise exception 'Billing administrator access required';
  end if;

  if input_percent_off not in (0, 25, 50, 75, 100) then
    raise exception 'Invalid plan discount';
  end if;

  update public.billing_plan_options
  set
    checkout_url = nullif(trim(input_checkout_url), ''),
    external_checkout_id = nullif(trim(input_external_checkout_id), ''),
    active = input_active,
    updated_at = now()
  where percent_off = input_percent_off
  returning * into saved_option;

  if saved_option.percent_off is null then
    raise exception 'Plan option not found';
  end if;

  insert into public.billing_change_log (actor_user_id, action, details)
  values (
    auth.uid(),
    'plan_option_updated',
    jsonb_build_object(
      'percent_off', saved_option.percent_off,
      'active', saved_option.active,
      'has_checkout_url', saved_option.checkout_url is not null
    )
  );

  return to_jsonb(saved_option);
end;
$$;

revoke all on function public.billing_admin_set_plan_option(integer, text, text, boolean) from public;
grant execute on function public.billing_admin_set_plan_option(integer, text, text, boolean) to authenticated;

create or replace function public.get_billing_admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_platform_billing_admin() then
    raise exception 'Billing administrator access required';
  end if;

  with account_rows as (
    select
      company.id as company_id,
      company.name as company_name,
      owner.email as owner_email,
      subscription.billing_email,
      subscription.status,
      subscription.billing_mode,
      subscription.provider,
      subscription.base_plan_price_cents,
      subscription.plan_price_cents,
      subscription.promo_code,
      subscription.promo_percent_off,
      subscription.trial_started_at,
      subscription.trial_ends_at,
      subscription.last_paid_at,
      subscription.current_period_ends_at,
      subscription.grace_ends_at,
      subscription.next_invoice_at,
      subscription.cancel_at_period_end,
      subscription.external_customer_id,
      subscription.external_contract_id,
      subscription.last_invoice_id,
      subscription.external_invoice_url,
      subscription.admin_notes,
      subscription.last_reconciled_at,
      coalesce(job_totals.job_count, 0) as job_count,
      coalesce(payment_totals.total_paid_cents, 0) as total_paid_cents,
      payment_totals.last_payment_status,
      payment_totals.last_payment_at
    from public.companies company
    join public.company_subscriptions subscription on subscription.company_id = company.id
    left join lateral (
      select users.email
      from public.company_members membership
      join auth.users users on users.id = membership.user_id
      where membership.company_id = company.id
      order by (membership.role = 'owner') desc, membership.created_at
      limit 1
    ) owner on true
    left join lateral (
      select count(*)::integer as job_count
      from public.jobs job
      where job.company_id = company.id
    ) job_totals on true
    left join lateral (
      select
        coalesce(sum(payment.amount_cents) filter (where payment.status = 'paid'), 0)::integer as total_paid_cents,
        (array_agg(payment.status order by payment.created_at desc))[1] as last_payment_status,
        max(coalesce(payment.paid_at, payment.created_at)) as last_payment_at
      from public.billing_payments payment
      where payment.company_id = company.id
    ) payment_totals on true
  ), coupon_rows as (
    select
      promotion.code,
      promotion.percent_off,
      promotion.active,
      promotion.assigned_email,
      promotion.assigned_company_id,
      company.name as assigned_company_name,
      promotion.starts_at,
      promotion.ends_at,
      promotion.redemption_count,
      promotion.max_redemptions,
      promotion.redeemed_at,
      promotion.admin_note,
      promotion.created_at
    from public.billing_promo_codes promotion
    left join public.companies company on company.id = promotion.assigned_company_id
    where promotion.percent_off in (25, 50, 75, 100)
  ), payment_rows as (
    select
      payment.id,
      payment.company_id,
      company.name as company_name,
      payment.provider,
      payment.external_payment_id,
      payment.external_invoice_id,
      payment.external_invoice_url,
      payment.amount_cents,
      payment.currency_code,
      payment.status,
      payment.period_starts_at,
      payment.period_ends_at,
      payment.due_at,
      payment.paid_at,
      payment.notes,
      payment.created_at
    from public.billing_payments payment
    join public.companies company on company.id = payment.company_id
    order by payment.created_at desc
    limit 200
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'total_accounts', (select count(*) from account_rows),
      'trialing_accounts', (select count(*) from account_rows where status = 'trialing'),
      'active_accounts', (select count(*) from account_rows where status = 'active'),
      'past_due_accounts', (select count(*) from account_rows where status = 'past_due'),
      'comped_accounts', (select count(*) from account_rows where status = 'active' and plan_price_cents = 0),
      'expected_monthly_cents', coalesce((select sum(plan_price_cents) from account_rows where status = 'active'), 0)
    ),
    'accounts', coalesce((select jsonb_agg(to_jsonb(account_rows) order by company_name) from account_rows), '[]'::jsonb),
    'coupons', coalesce((select jsonb_agg(to_jsonb(coupon_rows) order by created_at desc) from coupon_rows), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(payment_rows) order by created_at desc) from payment_rows), '[]'::jsonb),
    'plan_options', coalesce((select jsonb_agg(to_jsonb(plan_option) order by percent_off) from public.billing_plan_options plan_option), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

revoke all on function public.get_billing_admin_dashboard() from public;
grant execute on function public.get_billing_admin_dashboard() to authenticated;
