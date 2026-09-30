-- Creates the platform OWNER workspace: a private company (code PLATFORM) that
-- is never a customer, holding only the owner's own administrator account.
--
-- Why: platform-operator powers (licences, plans, discount codes, every
-- company's data for support/onboarding) used to belong to whichever company
-- carried the is_platform_operator flag — so every employee of that company had
-- them. Now only the PLATFORM company carries the flag; ordinary companies,
-- including the owner's own training company, are just customers.
--
-- This script creates the company, its SUPER_ADMIN role (with the same
-- permissions as an existing SUPER_ADMIN role) and the owner's employee row.
-- The login itself (a Supabase Auth user for platform.owner@internal.sktraining)
-- is created separately with a generated password — no password lives in this file.
--
-- Run once, with the source company whose SUPER_ADMIN permissions to copy:
--   (edit :source_company below if needed)

do $$
declare
  v_source_company constant text := 'RMT001';
  v_co uuid; v_br uuid; v_dp uuid; v_ds uuid; v_role uuid; v_emp uuid; v_src_role uuid;
begin
  if exists (select 1 from companies where company_code = 'PLATFORM') then
    raise exception 'The PLATFORM company already exists.';
  end if;

  select r.id into v_src_role
  from roles r join companies c on c.id = r.company_id
  where c.company_code = v_source_company and r.role_code = 'SUPER_ADMIN';
  if v_src_role is null then raise exception 'Source SUPER_ADMIN role not found.'; end if;

  insert into companies (company_code, company_name, short_name, is_platform_operator, live_quiz_enabled, market_analytics_enabled, active)
  values ('PLATFORM', 'Platform Owner', 'Platform', true, true, true, true)
  returning id into v_co;

  insert into branches (company_id, branch_code, branch_name, head_office) values (v_co, 'HQ', 'Head Office', true) returning id into v_br;
  insert into departments (company_id, branch_id, department_name) values (v_co, v_br, 'Platform') returning id into v_dp;
  insert into designations (company_id, department_id, designation_name) values (v_co, v_dp, 'Owner') returning id into v_ds;

  insert into roles (company_id, role_code, role_name, hierarchy_level, description, system_role, active)
  select v_co, r.role_code, r.role_name, r.hierarchy_level, r.description, r.system_role, true
  from roles r where r.id = v_src_role
  returning id into v_role;

  insert into role_permissions (role_id, permission_id)
  select v_role, rp.permission_id from role_permissions rp where rp.role_id = v_src_role;

  insert into employees (company_id, branch_id, department_id, designation_id, employee_code, first_name, last_name, joining_date, active)
  values (v_co, v_br, v_dp, v_ds, 'OWNER', 'Platform', 'Owner', current_date, true)
  returning id into v_emp;

  insert into employee_roles (employee_id, role_id, assigned_date, active) values (v_emp, v_role, current_date, true);
end $$;
