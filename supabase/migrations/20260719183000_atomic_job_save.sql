create or replace function public.save_job_record(
  target_company_id uuid,
  target_job_id uuid,
  input_customer_name text,
  input_customer_email text,
  input_customer_phone text,
  input_job_industry text,
  input_job_name text,
  input_job_service_address text,
  input_job_status text,
  input_job_material_status text,
  input_job_projected_date date,
  input_job_invoice_url text,
  input_job_next_action text,
  input_job_internal_notes text,
  input_job_custom_values jsonb
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_job public.jobs;
  saved_customer_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.company_members
    where company_id = target_company_id
      and user_id = auth.uid()
  ) then
    raise exception 'Company access denied';
  end if;

  if nullif(trim(input_customer_name), '') is null
    or nullif(trim(input_customer_email), '') is null
    or nullif(trim(input_job_name), '') is null
    or nullif(trim(input_job_service_address), '') is null then
    raise exception 'Required job information is missing';
  end if;

  if target_job_id is null then
    insert into public.customers (company_id, name, email, phone)
    values (
      target_company_id,
      trim(input_customer_name),
      lower(trim(input_customer_email)),
      nullif(trim(input_customer_phone), '')
    )
    returning id into saved_customer_id;

    insert into public.jobs (
      company_id,
      customer_id,
      industry,
      name,
      service_address,
      job_status,
      material_status,
      projected_date,
      invoice_url,
      next_action,
      internal_notes,
      custom_values
    )
    values (
      target_company_id,
      saved_customer_id,
      coalesce(nullif(trim(input_job_industry), ''), 'general'),
      trim(input_job_name),
      trim(input_job_service_address),
      coalesce(nullif(trim(input_job_status), ''), 'Active'),
      coalesce(nullif(trim(input_job_material_status), ''), 'Not Ordered'),
      input_job_projected_date,
      nullif(trim(input_job_invoice_url), ''),
      nullif(trim(input_job_next_action), ''),
      nullif(trim(input_job_internal_notes), ''),
      coalesce(input_job_custom_values, '{}'::jsonb)
    )
    returning * into saved_job;
  else
    select customer_id
    into saved_customer_id
    from public.jobs
    where id = target_job_id
      and company_id = target_company_id;

    if saved_customer_id is null then
      raise exception 'Job not found';
    end if;

    update public.customers
    set
      name = trim(input_customer_name),
      email = lower(trim(input_customer_email)),
      phone = nullif(trim(input_customer_phone), '')
    where id = saved_customer_id
      and company_id = target_company_id;

    update public.jobs
    set
      industry = coalesce(nullif(trim(input_job_industry), ''), industry),
      name = trim(input_job_name),
      service_address = trim(input_job_service_address),
      job_status = coalesce(nullif(trim(input_job_status), ''), job_status),
      material_status = coalesce(nullif(trim(input_job_material_status), ''), material_status),
      projected_date = input_job_projected_date,
      invoice_url = nullif(trim(input_job_invoice_url), ''),
      next_action = nullif(trim(input_job_next_action), ''),
      internal_notes = nullif(trim(input_job_internal_notes), ''),
      custom_values = coalesce(input_job_custom_values, '{}'::jsonb),
      updated_at = now()
    where id = target_job_id
      and company_id = target_company_id
    returning * into saved_job;
  end if;

  return saved_job;
end;
$$;

revoke all on function public.save_job_record(uuid, uuid, text, text, text, text, text, text, text, text, date, text, text, text, jsonb) from public;
grant execute on function public.save_job_record(uuid, uuid, text, text, text, text, text, text, text, text, date, text, text, text, jsonb) to authenticated;
