-- ============================================================================
-- RLS HARDENING
--
-- Context: a security audit found that most tables in this database either
-- have no RLS policy at all, or have RLS "enabled" but paired with a
-- `USING (true)` policy that grants full access to anon/authenticated
-- regardless — meaning the anon key embedded in the deployed client bundle
-- can read/write almost everything, across every tenant company, with no
-- login required. A handful of tables (attendance, roles, users,
-- company_licenses) already had a correct company-scoped policy, but even
-- those used `(auth.uid() IS NULL) OR (company_id = current_employee_company_id())`
-- — and auth.uid() IS NULL for ANY anon-key request with no session, not just
-- for not-yet-migrated employees, so it was a full bypass too.
--
-- All 19 employees in this database are migrated to real Supabase Auth
-- (auth_user_id set), confirmed via:
--   select count(*) filter (where auth_user_id is not null), count(*) from employees;
-- so the `auth.uid() IS NULL` bypass has no legitimate remaining use ANYWHERE
-- EXCEPT the two pre-authentication login lookups (company-code lookup and
-- employee/password lookup), which necessarily run before a session exists.
-- Those two are handled by moving them into SECURITY DEFINER RPCs below,
-- called from src/services/auth/authService.ts, so the underlying tables
-- never need an anon carve-out at all.
--
-- IMPORTANT: this is a wide-reaching change. Test against a staging/branch
-- database and the full login + admin + employee click-through before
-- applying to production. This file was drafted from a schema+policy dump,
-- not run against the live database — review before applying.
-- ============================================================================


-- ============================================================================
-- SECTION 0 — helper functions for indirect company scoping
--
-- current_employee_company_id() already exists and is used by the policies
-- below unchanged. These new helpers resolve company_id through a foreign
-- key chain for tables that don't carry company_id directly.
-- ============================================================================

create or replace function public.employee_company_id(p_employee_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from employees where id = p_employee_id
$$;

create or replace function public.course_company_id(p_course_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from courses where id = p_course_id
$$;

create or replace function public.module_company_id(p_module_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.company_id
  from modules m
  join courses c on c.id = m.course_id
  where m.id = p_module_id
$$;

create or replace function public.lesson_company_id(p_lesson_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.company_id
  from lessons l
  join modules m on m.id = l.module_id
  join courses c on c.id = m.course_id
  where l.id = p_lesson_id
$$;

create or replace function public.assessment_company_id(p_assessment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.company_id
  from assessments a
  join lessons l on l.id = a.lesson_id
  join modules m on m.id = l.module_id
  join courses c on c.id = m.course_id
  where a.id = p_assessment_id
$$;

create or replace function public.question_company_id(p_question_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.assessment_company_id(assessment_id)
  from assessment_questions
  where id = p_question_id
$$;

create or replace function public.question_bank_company_id(p_question_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.assessment_company_id(assessment_id)
  from question_bank
  where id = p_question_id
$$;

create or replace function public.attempt_company_id(p_attempt_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.assessment_company_id(assessment_id)
  from assessment_attempts
  where id = p_attempt_id
$$;

create or replace function public.certificate_company_id(p_certificate_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.employee_company_id(employee_id)
  from certificates
  where id = p_certificate_id
$$;

create or replace function public.role_company_id(p_role_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from roles where id = p_role_id
$$;

create or replace function public.company_license_company_id(p_company_license_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from company_licenses where id = p_company_license_id
$$;

create or replace function public.branch_company_id(p_branch_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from branches where id = p_branch_id
$$;

create or replace function public.real_estate_project_company_id(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from real_estate_projects where id = p_project_id
$$;


-- ============================================================================
-- SECTION 1 — pre-authentication login RPCs
--
-- These run as `anon` (no session exists yet — that's the point of a login
-- call). SECURITY DEFINER lets them read/write exactly the fields the login
-- flow needs without granting anon any general access to `companies` or
-- `employees`. See src/services/auth/authService.ts for the matching
-- application-side change.
-- ============================================================================

create or replace function public.get_company_for_login(p_company_code text)
returns table (id uuid, active boolean)
language sql
stable
security definer
set search_path = public
as $$
  select id, active
  from companies
  where company_code = p_company_code
  limit 1
$$;

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
  where employee_code = p_employee_code
    and company_id = p_company_id
  limit 1
$$;

create or replace function public.login_record_failed_attempt(
  p_employee_id uuid,
  p_new_attempts integer,
  p_lock boolean
)
returns void
language sql
security definer
set search_path = public
as $$
  update employees
  set failed_login_attempts = p_new_attempts,
      account_locked = case when p_lock then true else account_locked end
  where id = p_employee_id
$$;

create or replace function public.login_record_successful_login(p_employee_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update employees
  set failed_login_attempts = 0,
      account_locked = false,
      last_login = now()
  where id = p_employee_id
$$;

grant execute on function public.get_company_for_login(text) to anon, authenticated;
grant execute on function public.login_lookup_employee(text, uuid) to anon, authenticated;
grant execute on function public.login_record_failed_attempt(uuid, integer, boolean) to anon, authenticated;
grant execute on function public.login_record_successful_login(uuid) to anon, authenticated;


-- ============================================================================
-- SECTION 2 — remove the "OR auth.uid() IS NULL" bypass from every
-- already-scoped policy, now that the two genuinely pre-auth lookups are
-- handled by the RPCs above instead of relying on this clause.
-- ============================================================================

alter policy assessment_assignments_company_scoped on assessment_assignments
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter policy attendance_company_scoped on attendance
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter policy employees_company_scoped on employees
  to authenticated
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter policy company_licenses_company_scoped on company_licenses
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter policy course_categories_company_scoped on course_categories
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter policy courses_company_scoped on courses
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter policy departments_company_scoped on departments
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter policy designations_company_scoped on designations
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter policy enrollments_company_scoped on enrollments
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter policy learning_path_enrollments_company_scoped on learning_path_enrollments
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter policy roles_company_scoped on roles
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter policy training_batches_company_scoped on training_batches
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter policy users_company_scoped on users
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter policy branches_company_scoped on branches
  using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());


-- ============================================================================
-- SECTION 3 — drop the redundant "allow everyone" policies that were
-- silently overriding the scoped policy above (Postgres OR's multiple
-- permissive policies for the same command together, so these made the
-- scoped policy meaningless regardless of section 2).
-- ============================================================================

drop policy if exists branches_select_policy on branches;
drop policy if exists branches_insert_policy on branches;
drop policy if exists branches_update_policy on branches;
drop policy if exists branches_delete_policy on branches;

drop policy if exists departments_select_policy on departments;
drop policy if exists departments_insert_policy on departments;
drop policy if exists departments_update_policy on departments;
drop policy if exists departments_delete_policy on departments;

drop policy if exists designations_select_policy on designations;
drop policy if exists designations_insert_policy on designations;
drop policy if exists designations_update_policy on designations;
drop policy if exists designations_delete_policy on designations;

drop policy if exists employees_select_policy on employees;
drop policy if exists employees_insert_policy on employees;
drop policy if exists employees_update_policy on employees;
drop policy if exists employees_delete_policy on employees;

drop policy if exists enrollments_select on enrollments;
drop policy if exists enrollments_insert on enrollments;
drop policy if exists enrollments_update on enrollments;
drop policy if exists enrollments_delete on enrollments;


-- ============================================================================
-- SECTION 4 — enable RLS on tables that already had a correct policy
-- sitting inert (rowsecurity was false).
-- ============================================================================

alter table companies enable row level security;
alter table courses enable row level security;
alter table course_categories enable row level security;
alter table training_batches enable row level security;
alter table assessment_assignments enable row level security;
alter table learning_path_enrollments enable row level security;
alter table branches enable row level security;
alter table departments enable row level security;
alter table designations enable row level security;
alter table enrollments enable row level security;
-- companies keeps its existing authenticated_see_own_company policy as-is
-- (it already has no auth.uid()-IS-NULL bypass); anon access is no longer
-- needed on this table at all now that login uses get_company_for_login().


-- ============================================================================
-- SECTION 5 — tables with zero protection today (RLS disabled, no policy
-- at all). New company-scoped policies via direct company_id or the FK-chain
-- helpers from section 0.
-- ============================================================================

alter table attendance_locations enable row level security;
create policy attendance_locations_company_scoped on attendance_locations
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

alter table employee_attendance_locations enable row level security;
create policy employee_attendance_locations_company_scoped on employee_attendance_locations
  for all using (employee_company_id(employee_id) = current_employee_company_id())
  with check (employee_company_id(employee_id) = current_employee_company_id());

alter table employee_roles enable row level security;
create policy employee_roles_company_scoped on employee_roles
  for all using (employee_company_id(employee_id) = current_employee_company_id())
  with check (employee_company_id(employee_id) = current_employee_company_id());

alter table employee_lesson_progress enable row level security;
create policy employee_lesson_progress_company_scoped on employee_lesson_progress
  for all using (employee_company_id(employee_id) = current_employee_company_id())
  with check (employee_company_id(employee_id) = current_employee_company_id());

alter table employee_module_progress enable row level security;
create policy employee_module_progress_company_scoped on employee_module_progress
  for all using (employee_company_id(employee_id) = current_employee_company_id())
  with check (employee_company_id(employee_id) = current_employee_company_id());

alter table admin_module_unlock_overrides enable row level security;
create policy admin_module_unlock_overrides_company_scoped on admin_module_unlock_overrides
  for all using (employee_company_id(employee_id) = current_employee_company_id())
  with check (employee_company_id(employee_id) = current_employee_company_id());

-- Course content tree: modules -> lessons -> learning_resources
alter table modules enable row level security;
create policy modules_company_scoped on modules
  for all using (course_company_id(course_id) = current_employee_company_id())
  with check (course_company_id(course_id) = current_employee_company_id());

alter table lessons enable row level security;
create policy lessons_company_scoped on lessons
  for all using (module_company_id(module_id) = current_employee_company_id())
  with check (module_company_id(module_id) = current_employee_company_id());

alter table learning_resources enable row level security;
create policy learning_resources_company_scoped on learning_resources
  for all using (lesson_company_id(lesson_id) = current_employee_company_id())
  with check (lesson_company_id(lesson_id) = current_employee_company_id());

alter table course_visibility enable row level security;
drop policy if exists "Allow anon full access on course_visibility" on course_visibility;
create policy course_visibility_company_scoped on course_visibility
  for all using (course_company_id(course_id) = current_employee_company_id())
  with check (course_company_id(course_id) = current_employee_company_id());

alter table learning_path_courses enable row level security;
create policy learning_path_courses_company_scoped on learning_path_courses
  for all using (course_company_id(course_id) = current_employee_company_id())
  with check (course_company_id(course_id) = current_employee_company_id());

alter table learning_path_progress enable row level security;
create policy learning_path_progress_company_scoped on learning_path_progress
  for all using (employee_company_id(employee_id) = current_employee_company_id())
  with check (employee_company_id(employee_id) = current_employee_company_id());

-- Assessment system: assessments -> lessons -> modules -> courses chain
alter table assessments enable row level security;
create policy assessments_company_scoped on assessments
  for all using (assessment_company_id(id) = current_employee_company_id())
  with check (assessment_company_id(id) = current_employee_company_id());

alter table assessment_questions enable row level security;
create policy assessment_questions_company_scoped on assessment_questions
  for all using (assessment_company_id(assessment_id) = current_employee_company_id())
  with check (assessment_company_id(assessment_id) = current_employee_company_id());

alter table assessment_options enable row level security;
create policy assessment_options_company_scoped on assessment_options
  for all using (question_company_id(question_id) = current_employee_company_id())
  with check (question_company_id(question_id) = current_employee_company_id());

alter table assessment_attempts enable row level security;
create policy assessment_attempts_company_scoped on assessment_attempts
  for all using (employee_company_id(employee_id) = current_employee_company_id())
  with check (employee_company_id(employee_id) = current_employee_company_id());

alter table assessment_answers enable row level security;
create policy assessment_answers_company_scoped on assessment_answers
  for all using (attempt_company_id(attempt_id) = current_employee_company_id())
  with check (attempt_company_id(attempt_id) = current_employee_company_id());

alter table assessment_results enable row level security;
create policy assessment_results_company_scoped on assessment_results
  for all using (employee_company_id(employee_id) = current_employee_company_id())
  with check (employee_company_id(employee_id) = current_employee_company_id());

alter table question_bank enable row level security;
create policy question_bank_company_scoped on question_bank
  for all using (assessment_company_id(assessment_id) = current_employee_company_id())
  with check (assessment_company_id(assessment_id) = current_employee_company_id());

alter table question_options enable row level security;
create policy question_options_company_scoped on question_options
  for all using (question_bank_company_id(question_id) = current_employee_company_id())
  with check (question_bank_company_id(question_id) = current_employee_company_id());

alter table evaluation_rules enable row level security;
create policy evaluation_rules_company_scoped on evaluation_rules
  for all using (assessment_company_id(assessment_id) = current_employee_company_id())
  with check (assessment_company_id(assessment_id) = current_employee_company_id());

-- Certificates
alter table certificates enable row level security;
create policy certificates_company_scoped on certificates
  for all using (employee_company_id(employee_id) = current_employee_company_id())
  with check (employee_company_id(employee_id) = current_employee_company_id());

alter table certificate_verifications enable row level security;
create policy certificate_verifications_company_scoped on certificate_verifications
  for all using (certificate_company_id(certificate_id) = current_employee_company_id())
  with check (certificate_company_id(certificate_id) = current_employee_company_id());

alter table certificate_generation_queue enable row level security;
create policy certificate_generation_queue_company_scoped on certificate_generation_queue
  for all using (employee_company_id(employee_id) = current_employee_company_id())
  with check (employee_company_id(employee_id) = current_employee_company_id());


-- ============================================================================
-- SECTION 6 — tables with RLS "enabled" but only a fully permissive
-- (USING true) policy for anon and/or authenticated. Drop the permissive
-- policy, add a real company-scoped one.
-- ============================================================================

drop policy if exists branch_geofences_authenticated on branch_geofences;
drop policy if exists "Allow anon full access on branch_geofences" on branch_geofences;
create policy branch_geofences_company_scoped on branch_geofences
  for all using (branch_company_id(branch_id) = current_employee_company_id())
  with check (branch_company_id(branch_id) = current_employee_company_id());

drop policy if exists "Allow authenticated full access on trainer_assignments" on trainer_assignments;
drop policy if exists "Allow anon full access on trainer_assignments" on trainer_assignments;
create policy trainer_assignments_company_scoped on trainer_assignments
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

drop policy if exists auth_all_rep on real_estate_projects;
drop policy if exists anon_all_rep on real_estate_projects;
create policy real_estate_projects_company_scoped on real_estate_projects
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

drop policy if exists auth_all_repc on real_estate_project_categories;
drop policy if exists anon_all_repc on real_estate_project_categories;
create policy real_estate_project_categories_company_scoped on real_estate_project_categories
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

drop policy if exists auth_all_repb on real_estate_project_brochures;
drop policy if exists anon_all_repb on real_estate_project_brochures;
create policy real_estate_project_brochures_company_scoped on real_estate_project_brochures
  for all using (real_estate_project_company_id(project_id) = current_employee_company_id())
  with check (real_estate_project_company_id(project_id) = current_employee_company_id());

drop policy if exists auth_all_lv on library_videos;
drop policy if exists anon_all_lv on library_videos;
create policy library_videos_company_scoped on library_videos
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

drop policy if exists auth_all_vs on video_subjects;
drop policy if exists anon_all_vs on video_subjects;
create policy video_subjects_company_scoped on video_subjects
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());

drop policy if exists "Allow anon full access on role_permissions" on role_permissions;
create policy role_permissions_company_scoped on role_permissions
  for all using (role_company_id(role_id) = current_employee_company_id())
  with check (role_company_id(role_id) = current_employee_company_id());

drop policy if exists "Allow anon full access on license_notifications" on license_notifications;
create policy license_notifications_company_scoped on license_notifications
  for all using (company_license_company_id(company_license_id) = current_employee_company_id())
  with check (company_license_company_id(company_license_id) = current_employee_company_id());

alter table menu_permissions enable row level security;
create policy menu_permissions_company_scoped on menu_permissions
  for all using (role_company_id(role_id) = current_employee_company_id())
  with check (role_company_id(role_id) = current_employee_company_id());


-- ============================================================================
-- SECTION 7 — platform-level / global catalog tables.
--
-- These have NO company_id and no FK path to one: discount_codes,
-- subscription_plans, payment_settings, permissions, menus, settings,
-- themes, certificate_templates, learning_paths, admin_module_categories,
-- admin_module_assignments. Today, ANY authenticated employee at ANY
-- company can read and write these via the existing Admin console screens
-- (nothing in the schema distinguishes "the platform operator" from "a
-- tenant company's super admin").
--
-- This section only removes ANONYMOUS/public access (the confirmed,
-- unambiguous hole) and requires a real login. It deliberately does NOT
-- attempt to restrict these to a "platform admin" role, because that
-- concept doesn't exist yet in this schema and inventing one here risks
-- breaking your team's own current usage of these screens. Treat closing
-- that gap (one company's super admin editing global payment/discount/plan
-- config, or a future company's admin seeing all of them) as a separate,
-- lower-urgency follow-up once you decide how "platform operator" should be
-- represented (e.g. a dedicated is_platform_admin flag).
-- ============================================================================

drop policy if exists "Allow anon full access on discount_codes" on discount_codes;
create policy discount_codes_authenticated_only on discount_codes
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "Allow anon full access on subscription_plans" on subscription_plans;
create policy subscription_plans_authenticated_only on subscription_plans
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "Allow anon full access on payment_settings" on payment_settings;
create policy payment_settings_authenticated_only on payment_settings
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "Allow anon full access on permissions" on permissions;
create policy permissions_authenticated_only on permissions
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "Allow authenticated full access on admin_module_assignments" on admin_module_assignments;
drop policy if exists "Allow anon full access on admin_module_assignments" on admin_module_assignments;
create policy admin_module_assignments_authenticated_only on admin_module_assignments
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "Allow authenticated full access on admin_module_categories" on admin_module_categories;
drop policy if exists "Allow anon full access on admin_module_categories" on admin_module_categories;
create policy admin_module_categories_authenticated_only on admin_module_categories
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

alter table menus enable row level security;
create policy menus_authenticated_only on menus
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

alter table settings enable row level security;
create policy settings_authenticated_only on settings
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

alter table themes enable row level security;
create policy themes_authenticated_only on themes
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

alter table certificate_templates enable row level security;
create policy certificate_templates_authenticated_only on certificate_templates
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

alter table learning_paths enable row level security;
create policy learning_paths_authenticated_only on learning_paths
  for all using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- user_roles: not queried anywhere in the app (it uses employee_roles
-- instead — see src/services/auth/authService.ts resolveRoleId). RLS is
-- already enabled with zero policies, i.e. already fully locked (deny-all).
-- No change needed; consider dropping this table in a later cleanup once
-- confirmed dead.
