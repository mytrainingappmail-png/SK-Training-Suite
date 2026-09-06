-- Lets someone log in with their EMAIL instead of their Employee ID, as an
-- optional alternative — same box, same flow, just also checked against
-- employees.email (case-insensitive) alongside employee_code. Both
-- pre-auth lookup RPCs get the same broadened match so this works whether
-- or not a Company Code was given.

create or replace function public.login_lookup_employee(p_employee_code text, p_company_id uuid)
returns table (
  id uuid,
  company_id uuid,
  branch_id uuid,
  department_id uuid,
  designation_id uuid,
  employee_code character varying,
  first_name character varying,
  last_name character varying,
  email character varying,
  mobile character varying,
  active boolean,
  password text,
  failed_login_attempts integer,
  account_locked boolean,
  auth_user_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    id, company_id, branch_id, department_id, designation_id,
    employee_code, first_name, last_name, email, mobile, active,
    password, failed_login_attempts, account_locked, auth_user_id
  from employees
  where company_id = p_company_id
    and (employee_code = p_employee_code or lower(email) = lower(p_employee_code))
  limit 1
$$;

drop function if exists login_lookup_employee_any_company(text);
create function login_lookup_employee_any_company(p_employee_code text)
returns table (
  id uuid, company_id uuid, company_code text, branch_id uuid, department_id uuid, designation_id uuid,
  employee_code character varying, first_name character varying, last_name character varying,
  email character varying, mobile character varying, active boolean,
  password text, failed_login_attempts integer, account_locked boolean, auth_user_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id, e.company_id, c.company_code, e.branch_id, e.department_id, e.designation_id,
    e.employee_code, e.first_name, e.last_name, e.email, e.mobile, e.active,
    e.password, e.failed_login_attempts, e.account_locked, e.auth_user_id
  from employees e
  join companies c on c.id = e.company_id and c.active = true
  where e.employee_code = p_employee_code or lower(e.email) = lower(p_employee_code)
$$;

grant execute on function public.login_lookup_employee(text, uuid) to anon, authenticated;
grant execute on function public.login_lookup_employee_any_company(text) to anon, authenticated;
