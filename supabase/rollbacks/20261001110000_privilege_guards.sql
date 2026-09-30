-- Rollback for 20261001110000_privilege_guards.sql
-- Restores the exact policies that existed before (captured from pg_policies
-- on 2026-09-30). Running this REOPENS the privilege-escalation holes the
-- migration closed — only use it if the guards break a legitimate flow.

drop trigger if exists trg_guard_companies_columns on companies;
drop function if exists guard_companies_columns();
drop trigger if exists trg_guard_employees_columns on employees;
drop function if exists guard_employees_columns();
drop trigger if exists trg_guard_quiz_admins_columns on quiz_admins;
drop function if exists guard_quiz_admins_columns();

-- employees
drop policy if exists employees_company_select on employees;
drop policy if exists employees_company_update on employees;
drop policy if exists employees_admin_insert on employees;
drop policy if exists employees_admin_delete on employees;
drop policy if exists employees_company_scoped on employees;
create policy employees_company_scoped on employees for all to authenticated
  using (company_id = current_employee_company_id()) with check (company_id = current_employee_company_id());

-- employee_roles
drop policy if exists employee_roles_company_select on employee_roles;
drop policy if exists employee_roles_admin_write on employee_roles;
drop policy if exists employee_roles_company_scoped on employee_roles;
create policy employee_roles_company_scoped on employee_roles for all to public
  using (employee_company_id(employee_id) = current_employee_company_id())
  with check (employee_company_id(employee_id) = current_employee_company_id());

-- roles
drop policy if exists roles_company_select on roles;
drop policy if exists roles_admin_write on roles;
drop policy if exists roles_company_scoped on roles;
create policy roles_company_scoped on roles for all to anon, authenticated
  using (company_id = current_employee_company_id()) with check (company_id = current_employee_company_id());

-- role_permissions
drop policy if exists role_permissions_company_select on role_permissions;
drop policy if exists role_permissions_admin_write on role_permissions;
drop policy if exists role_permissions_company_scoped on role_permissions;
create policy role_permissions_company_scoped on role_permissions for all to public
  using (role_company_id(role_id) = current_employee_company_id())
  with check (role_company_id(role_id) = current_employee_company_id());

-- company_licenses
drop policy if exists company_licenses_company_select on company_licenses;
drop policy if exists company_licenses_company_scoped on company_licenses;
create policy company_licenses_company_scoped on company_licenses for all to anon, authenticated
  using (company_id = current_employee_company_id()) with check (company_id = current_employee_company_id());

-- quiz_admins
drop policy if exists quiz_admins_update on quiz_admins;
create policy quiz_admins_update on quiz_admins for update to public
  using (company_id = current_quiz_admin_company_id()) with check (company_id = current_quiz_admin_company_id());

-- quiz_participants
create policy quiz_participants_self_insert on quiz_participants for insert to public with check (auth_user_id = auth.uid());
create policy quiz_participants_self_update on quiz_participants for update to public
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- course-content storage
drop policy if exists course_content_insert on storage.objects;
drop policy if exists course_content_update on storage.objects;
drop policy if exists course_content_delete on storage.objects;
create policy "Allow authenticated users lc55tz_0" on storage.objects for select to authenticated using (bucket_id = 'course-content' and true);
create policy "Allow authenticated users lc55tz_1" on storage.objects for insert to authenticated with check (bucket_id = 'course-content' and true);
create policy "Allow authenticated users lc55tz_2" on storage.objects for update to authenticated using (bucket_id = 'course-content' and true);
create policy "Allow authenticated users lc55tz_3" on storage.objects for delete to authenticated using (bucket_id = 'course-content' and true);
create policy course_content_insert on storage.objects for insert to authenticated with check (bucket_id = 'course-content');
create policy course_content_update on storage.objects for update to authenticated using (bucket_id = 'course-content') with check (bucket_id = 'course-content');
create policy course_content_delete on storage.objects for delete to authenticated using (bucket_id = 'course-content');

drop function if exists current_employee_is_company_admin();
drop function if exists current_quiz_admin_is_super();
