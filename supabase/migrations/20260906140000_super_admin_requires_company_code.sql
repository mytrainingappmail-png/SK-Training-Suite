-- A Super Admin (the company owner's role — auto-assigned during
-- onboarding) is the highest-value account in each company. Since
-- employee_code is only a simple sequential number ("00001", "00002"...),
-- every future customer company's owner will also be "00001" -- so the
-- "no Company Code, search every company" login fallback effectively lets
-- someone try one password against every company's owner at once. Super
-- Admin accounts are now excluded from that fallback: they can only log
-- in when a Company Code is given (typed, or via the /:companyCode
-- branded link), where the search is already scoped to one company.
--
-- Both pre-auth lookup RPCs gain an is_super_admin flag so authService.ts
-- can filter these candidates out of the no-code path before ever
-- touching their password.

drop function if exists public.login_lookup_employee(text, uuid);
create function public.login_lookup_employee(p_employee_code text, p_company_id uuid)
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
  auth_user_id uuid,
  is_super_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id, e.company_id, e.branch_id, e.department_id, e.designation_id,
    e.employee_code, e.first_name, e.last_name, e.email, e.mobile, e.active,
    e.password, e.failed_login_attempts, e.account_locked, e.auth_user_id,
    exists (
      select 1 from employee_roles er
      join roles r on r.id = er.role_id
      where er.employee_id = e.id and er.active = true and r.role_code = 'SUPER_ADMIN'
    ) as is_super_admin
  from employees e
  where e.company_id = p_company_id
    and (e.employee_code = p_employee_code or lower(e.email) = lower(p_employee_code))
  limit 1
$$;

drop function if exists login_lookup_employee_any_company(text);
create function login_lookup_employee_any_company(p_employee_code text)
returns table (
  id uuid, company_id uuid, company_code text, branch_id uuid, department_id uuid, designation_id uuid,
  employee_code character varying, first_name character varying, last_name character varying,
  email character varying, mobile character varying, active boolean,
  password text, failed_login_attempts integer, account_locked boolean, auth_user_id uuid,
  is_super_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id, e.company_id, c.company_code, e.branch_id, e.department_id, e.designation_id,
    e.employee_code, e.first_name, e.last_name, e.email, e.mobile, e.active,
    e.password, e.failed_login_attempts, e.account_locked, e.auth_user_id,
    exists (
      select 1 from employee_roles er
      join roles r on r.id = er.role_id
      where er.employee_id = e.id and er.active = true and r.role_code = 'SUPER_ADMIN'
    ) as is_super_admin
  from employees e
  join companies c on c.id = e.company_id and c.active = true
  where e.employee_code = p_employee_code or lower(e.email) = lower(p_employee_code)
$$;

grant execute on function public.login_lookup_employee(text, uuid) to anon, authenticated;
grant execute on function public.login_lookup_employee_any_company(text) to anon, authenticated;
