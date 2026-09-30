-- Rollback for 20261001121000_drop_plaintext_password.sql
-- Recreates the old RPCs and an EMPTY password column. The old plaintext values
-- are NOT restored (deliberately not backed up); employees keep signing in with
-- their Supabase Auth password. Running this re-opens the old lookup/lockout
-- holes — only use it if the new login flow is broken and the old client is
-- being redeployed.

alter table employees add column if not exists password text;

create or replace function login_lookup_employee(p_employee_code text, p_company_id uuid)
returns table(id uuid, company_id uuid, branch_id uuid, department_id uuid, designation_id uuid, employee_code character varying, first_name character varying, last_name character varying, email character varying, mobile character varying, active boolean, password text, failed_login_attempts integer, account_locked boolean, auth_user_id uuid, is_super_admin boolean)
language sql stable security definer set search_path to 'public'
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

create or replace function login_lookup_employee_any_company(p_employee_code text)
returns table(id uuid, company_id uuid, company_code text, branch_id uuid, department_id uuid, designation_id uuid, employee_code character varying, first_name character varying, last_name character varying, email character varying, mobile character varying, active boolean, password text, failed_login_attempts integer, account_locked boolean, auth_user_id uuid, is_super_admin boolean)
language sql stable security definer set search_path to 'public'
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

create or replace function login_record_failed_attempt(p_employee_id uuid, p_new_attempts integer, p_lock boolean)
returns void language sql security definer set search_path to 'public'
as $$
  update employees
  set failed_login_attempts = p_new_attempts,
      account_locked = case when p_lock then true else account_locked end
  where id = p_employee_id
$$;

create or replace function login_record_successful_login(p_employee_id uuid)
returns void language sql security definer set search_path to 'public'
as $$
  update employees
  set failed_login_attempts = 0,
      account_locked = false,
      last_login = now()
  where id = p_employee_id
$$;

grant execute on function login_lookup_employee(text, uuid) to anon, authenticated, service_role;
grant execute on function login_lookup_employee_any_company(text) to anon, authenticated, service_role;
grant execute on function login_record_failed_attempt(uuid, integer, boolean) to anon, authenticated, service_role;
grant execute on function login_record_successful_login(uuid) to anon, authenticated, service_role;
