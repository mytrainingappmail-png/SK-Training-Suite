-- Privilege guards: stop ordinary users from promoting themselves.
--
-- A design review (verified against the live DB) found that RLS on these
-- tables only checked "same company", with no notion of WHO in the company
-- may write, and no column limits. So any logged-in employee could:
--   * PATCH their own company row: is_platform_operator=true (which opens
--     every *_platform_operator_all policy across ALL tenants), or flip
--     live_quiz_enabled / market_analytics_enabled / active / company_code;
--   * insert themselves an active SUPER_ADMIN employee_roles row;
--   * rewrite their own company_licenses row (plan, end_date, status);
--   * delete colleagues, or change auth_user_id / active / account_locked;
-- and any view-only quiz admin could set their own role to super_admin,
-- and any trainee could write their own score or delete another company's
-- course files.
--
-- The app's own permission data agrees with the fix: only SUPER_ADMIN holds
-- create/edit/delete for employees, roles, employee_roles and companies
-- (Team Leader holds none, Trainer one unrelated permission), so restricting
-- these writes to SUPER_ADMIN blocks nothing the UI legitimately does.
--
-- Guard triggers only fire for DIRECT client writes (current_user is
-- 'authenticated'/'anon'); SECURITY DEFINER RPCs (login lockout counters),
-- edge functions using the service role, and migrations run as other roles
-- and are untouched.

-- ── Helpers ─────────────────────────────────────────────────────────────
create or replace function current_employee_is_company_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from employees e
    join employee_roles er on er.employee_id = e.id and er.active = true
    join roles r on r.id = er.role_id and r.company_id = e.company_id
    where e.auth_user_id = auth.uid() and r.role_code = 'SUPER_ADMIN'
  );
$$;

create or replace function current_quiz_admin_is_super()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from quiz_admins qa
    where qa.auth_user_id = auth.uid() and qa.role = 'super_admin' and qa.status = 'active'
  );
$$;

grant execute on function current_employee_is_company_admin() to authenticated;
grant execute on function current_quiz_admin_is_super() to authenticated;

-- ── companies: tenants may edit branding/profile, never the switches ────
-- Allow-list on purpose: any column added later stays locked to the
-- platform operator until deliberately added here.
create or replace function guard_companies_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_allowed text[] := array[
    'company_name','short_name','legal_name','website','email','phone','logo','favicon',
    'address','city','state','country','pincode','gst_number','pan_number','timezone',
    'currency','language','theme','updated_at','login_logo_url','app_icon_url','cards_per_page',
    'admin_console_bg_color','admin_console_button_color','admin_console_border_color',
    'sidebar_name_position','market_analytics_source_note','sidebar_menu_order',
    'default_watermark_enabled','default_watermark_text','default_watermark_orientation',
    'default_watermark_opacity','default_no_copy'
  ];
begin
  if current_user in ('authenticated', 'anon') and not current_company_is_platform_operator() then
    if (to_jsonb(new) - v_allowed) is distinct from (to_jsonb(old) - v_allowed) then
      raise exception 'Only the platform operator can change this company setting.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_companies_columns on companies;
create trigger trg_guard_companies_columns before update on companies
  for each row execute function guard_companies_columns();

-- ── employees ───────────────────────────────────────────────────────────
-- Identity/access columns can't be changed by a non-admin; inserting and
-- deleting employees is admin-only. (password / password_changed_at are
-- deliberately NOT guarded here: the client still syncs them on a self
-- password change until the plaintext path is removed in the next phase.)
create or replace function guard_employees_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and not current_employee_is_company_admin()
     and not current_company_is_platform_operator() then
    if new.company_id is distinct from old.company_id
       or new.auth_user_id is distinct from old.auth_user_id
       or new.employee_code is distinct from old.employee_code
       or new.active is distinct from old.active
       or new.account_locked is distinct from old.account_locked
       or new.failed_login_attempts is distinct from old.failed_login_attempts then
      raise exception 'Only an administrator can change these employee fields.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_employees_columns on employees;
create trigger trg_guard_employees_columns before update on employees
  for each row execute function guard_employees_columns();

drop policy if exists employees_company_scoped on employees;
drop policy if exists employees_company_select on employees;
drop policy if exists employees_company_update on employees;
drop policy if exists employees_admin_insert on employees;
drop policy if exists employees_admin_delete on employees;
create policy employees_company_select on employees for select to authenticated
  using (company_id = current_employee_company_id());
create policy employees_company_update on employees for update to authenticated
  using (company_id = current_employee_company_id()) with check (company_id = current_employee_company_id());
create policy employees_admin_insert on employees for insert to authenticated
  with check (company_id = current_employee_company_id() and current_employee_is_company_admin());
create policy employees_admin_delete on employees for delete to authenticated
  using (company_id = current_employee_company_id() and current_employee_is_company_admin());

-- ── employee_roles / roles / role_permissions: read = company, write = admin
drop policy if exists employee_roles_company_scoped on employee_roles;
drop policy if exists employee_roles_company_select on employee_roles;
drop policy if exists employee_roles_admin_write on employee_roles;
create policy employee_roles_company_select on employee_roles for select to authenticated
  using (employee_company_id(employee_id) = current_employee_company_id());
create policy employee_roles_admin_write on employee_roles for all to authenticated
  using (employee_company_id(employee_id) = current_employee_company_id() and current_employee_is_company_admin())
  with check (employee_company_id(employee_id) = current_employee_company_id() and current_employee_is_company_admin());

drop policy if exists roles_company_scoped on roles;
drop policy if exists roles_company_select on roles;
drop policy if exists roles_admin_write on roles;
create policy roles_company_select on roles for select to authenticated
  using (company_id = current_employee_company_id());
create policy roles_admin_write on roles for all to authenticated
  using (company_id = current_employee_company_id() and current_employee_is_company_admin())
  with check (company_id = current_employee_company_id() and current_employee_is_company_admin());

drop policy if exists role_permissions_company_scoped on role_permissions;
drop policy if exists role_permissions_company_select on role_permissions;
drop policy if exists role_permissions_admin_write on role_permissions;
create policy role_permissions_company_select on role_permissions for select to authenticated
  using (role_company_id(role_id) = current_employee_company_id());
create policy role_permissions_admin_write on role_permissions for all to authenticated
  using (role_company_id(role_id) = current_employee_company_id() and current_employee_is_company_admin())
  with check (role_company_id(role_id) = current_employee_company_id() and current_employee_is_company_admin());

-- ── company_licenses: tenants read their own; only the operator writes ──
-- (company_licenses_platform_operator_all stays and covers the operator.)
drop policy if exists company_licenses_company_scoped on company_licenses;
drop policy if exists company_licenses_company_select on company_licenses;
create policy company_licenses_company_select on company_licenses for select to authenticated
  using (company_id = current_employee_company_id());

-- ── quiz_admins: super_admin manages everyone; anyone edits only their own profile
create or replace function guard_quiz_admins_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    -- Identity never changes from a browser (rename/move goes through the
    -- provisioning edge function, which runs as the service role).
    if new.auth_user_id is distinct from old.auth_user_id
       or new.company_id is distinct from old.company_id
       or new.username is distinct from old.username then
      raise exception 'These quiz admin fields cannot be changed here.' using errcode = '42501';
    end if;
    if (new.role is distinct from old.role
        or new.permission_level is distinct from old.permission_level
        or new.status is distinct from old.status)
       and not current_quiz_admin_is_super() then
      raise exception 'Only a super admin can change roles, permissions or status.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_quiz_admins_columns on quiz_admins;
create trigger trg_guard_quiz_admins_columns before update on quiz_admins
  for each row execute function guard_quiz_admins_columns();

drop policy if exists quiz_admins_update on quiz_admins;
create policy quiz_admins_update on quiz_admins for update to authenticated
  using (company_id = current_quiz_admin_company_id() and (current_quiz_admin_is_super() or auth_user_id = auth.uid()))
  with check (company_id = current_quiz_admin_company_id() and (current_quiz_admin_is_super() or auth_user_id = auth.uid()));

-- ── quiz_participants: joining is done by the join_quiz_session RPC; the
-- client only ever SELECTs (verified in src/repositories/quiz). These two
-- policies let a trainee write their own score or insert into any session.
drop policy if exists quiz_participants_self_insert on quiz_participants;
drop policy if exists quiz_participants_self_update on quiz_participants;

-- ── course-content bucket: writes limited to employees ──────────────────
-- Any logged-in user (including quiz trainees) could overwrite or delete any
-- company's files. Until files live under per-company folders (later phase),
-- at least require the caller to be an employee. Not owner-based on purpose:
-- most existing objects were uploaded by the service role (owner null), and
-- the admin Storage Manager must still be able to manage them.
drop policy if exists "Allow authenticated users lc55tz_0" on storage.objects;
drop policy if exists "Allow authenticated users lc55tz_1" on storage.objects;
drop policy if exists "Allow authenticated users lc55tz_2" on storage.objects;
drop policy if exists "Allow authenticated users lc55tz_3" on storage.objects;
drop policy if exists course_content_insert on storage.objects;
drop policy if exists course_content_update on storage.objects;
drop policy if exists course_content_delete on storage.objects;
create policy course_content_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'course-content' and current_employee_company_id() is not null);
create policy course_content_update on storage.objects for update to authenticated
  using (bucket_id = 'course-content' and current_employee_company_id() is not null)
  with check (bucket_id = 'course-content' and current_employee_company_id() is not null);
create policy course_content_delete on storage.objects for delete to authenticated
  using (bucket_id = 'course-content' and current_employee_company_id() is not null);
-- course_content_select (authenticated, bucket_id match) is left as is; the bucket is public anyway.
