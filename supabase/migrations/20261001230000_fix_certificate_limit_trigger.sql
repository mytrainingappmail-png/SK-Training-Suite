-- Hotfix: the certificate-limit trigger added in 20261001150000 failed on EVERY
-- certificate insert ("record "new" has no field ..."), because one shared trigger
-- function read fields (employee_id / company_id) that only exist on some of the
-- three certificate tables. Quiz, exam and course certificates could not be issued.
-- The fields are now read from the row as JSON, which is valid for every table.

create or replace function enforce_certificate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_row jsonb := to_jsonb(new);
  v_company uuid;
begin
  v_company := case
    when v_row ? 'company_id' then nullif(v_row ->> 'company_id', '')::uuid
    when v_row ? 'employee_id' then (select e.company_id from employees e where e.id = nullif(v_row ->> 'employee_id', '')::uuid)
    else null
  end;
  if v_company is null then return new; end if;

  select * into v from company_plan_limits(v_company);
  if v.plan_name is null then return new; end if;
  if v.blocked then raise exception '%', v.block_reason using errcode = 'P0001'; end if;
  if company_certificates_this_month(v_company) >= v.max_certificates then
    raise exception 'Your % plan allows % certificates a month and this month''s are used up. Upgrade the plan or try again next month.', v.plan_name, v.max_certificates
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
