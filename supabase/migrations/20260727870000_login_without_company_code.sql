-- Lets an employee log in with just Employee ID + Password — Company Code
-- becomes optional on the form. Since employee_code is only guaranteed
-- unique WITHIN a company (not across the whole platform), skipping the
-- code means searching every active company for a match; authService.ts
-- then tries each candidate's password in turn until one succeeds (or
-- none do). Company Code still works exactly as before when provided
-- (unchanged existing RPC/path) — this only adds the no-code fallback.

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
  where e.employee_code = p_employee_code
$$;
