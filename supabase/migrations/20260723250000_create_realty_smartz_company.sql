-- ============================================================================
-- CREATE REALTY SMARTZ PVT LTD AS A REAL, SEPARATE COMPANY
--
-- Previously the Realty Smartz demo was a branding overlay on top of the
-- S&K Enterprise company row (same DB, same data, only login/sidebar/tab
-- title rewired via env vars) — always meant to be temporary. This
-- migration creates a genuinely separate company with its own roles,
-- permissions, org structure, and a COPY of the course catalog (courses,
-- modules, lessons, assessments, question bank) so it no longer shares
-- S&K Enterprise's identity anywhere in the app.
--
-- Every remapped entity uses a PRE-GENERATED new id (mapping table
-- populated with gen_random_uuid() before the insert, then the insert
-- specifies that id explicitly) rather than rejoining by natural key —
-- immune to duplicate names/codes/ordinals in the source data.
--
-- NOT copied (by design):
--   - Employees, enrollments, assessment results, certificates issued,
--     attendance — all specific to S&K Enterprise's real people.
--   - learning_paths / certificate_templates — platform-wide shared
--     catalogs (see 20260722130000_platform_operator_scoping.sql); a new
--     learning_path row IS created here so Realty Smartz has one that
--     resolves against ITS OWN copied courses.
-- ============================================================================

do $$
declare
  v_old_company_id uuid := 'b259bfa8-bf5b-464f-b9a5-008d00efa1e4';
  v_new_company_id uuid;
  v_branch_id uuid;
  v_department_id uuid;
  v_designation_id uuid;
  v_new_learning_path_id uuid;
begin
  -- ── Company ────────────────────────────────────────────────────────────────
  insert into companies (
    company_code, company_name, short_name, legal_name, active,
    is_platform_operator, market_analytics_enabled,
    website, email, phone, city, state, country, timezone, currency, language
  ) values (
    'RSPL001', 'Realty Smartz Pvt Ltd', 'Realty Smartz', 'Realty Smartz Private Limited', true,
    false, false,
    '', '', '', '', '', 'India', 'Asia/Kolkata', 'INR', 'en'
  )
  returning id into v_new_company_id;

  -- ── Org structure ────────────────────────────────────────────────────────────
  insert into branches (company_id, branch_code, branch_name, contact_person, address, city, state, country, pincode, phone, email, head_office, active)
  values (v_new_company_id, 'RSPL-001', 'Head Office', 'Amit Arora', '', '', '', 'India', '', '', '', true, true)
  returning id into v_branch_id;

  insert into departments (company_id, branch_id, department_code, department_name, description, active)
  values (v_new_company_id, v_branch_id, 'RSPL-001', 'Sales & Training', 'Sales and learning & development', true)
  returning id into v_department_id;

  insert into designations (company_id, branch_id, department_id, designation_code, designation_name, description, hierarchy_level, active)
  values (v_new_company_id, v_branch_id, v_department_id, 'RSPL-DESIG-001', 'Manager', 'Top level', 1, true)
  returning id into v_designation_id;

  -- ── Roles (mirrors S&K Enterprise's 6 system roles exactly) ────────────────
  create temp table role_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  insert into role_map (old_id, new_id) select id, gen_random_uuid() from roles where company_id = v_old_company_id;

  insert into roles (id, company_id, role_code, role_name, hierarchy_level, description, system_role, active)
  select rm.new_id, v_new_company_id, r.role_code, r.role_name, r.hierarchy_level, r.description, r.system_role, r.active
  from roles r join role_map rm on rm.old_id = r.id;

  -- ── Permissions — copy each new role's grants from its S&K counterpart ─────
  insert into role_permissions (role_id, permission_id)
  select rm.new_id, rp.permission_id
  from role_permissions rp
  join role_map rm on rm.old_id = rp.role_id;

  -- ── Course categories ────────────────────────────────────────────────────────
  create temp table category_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  insert into category_map (old_id, new_id) select id, gen_random_uuid() from course_categories where company_id = v_old_company_id;

  insert into course_categories (id, company_id, category_name, description, icon, display_order, active)
  select cm.new_id, v_new_company_id, c.category_name, c.description, c.icon, c.display_order, c.active
  from course_categories c join category_map cm on cm.old_id = c.id;

  -- ── Courses ──────────────────────────────────────────────────────────────────
  create temp table course_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  insert into course_map (old_id, new_id) select id, gen_random_uuid() from courses where company_id = v_old_company_id;

  insert into courses (
    id, company_id, category_id, course_code, course_name, short_description, full_description,
    thumbnail, level, duration_days, duration_hours, passing_percentage, certificate_enabled,
    display_order, active, created_by
  )
  select
    cm.new_id, v_new_company_id, catm.new_id, 'RSPL-' || c.course_code, c.course_name, c.short_description, c.full_description,
    c.thumbnail, c.level, c.duration_days, c.duration_hours, c.passing_percentage, c.certificate_enabled,
    c.display_order, c.active, null
  from courses c
  join course_map cm on cm.old_id = c.id
  left join category_map catm on catm.old_id = c.category_id;

  -- ── Modules ──────────────────────────────────────────────────────────────────
  create temp table module_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  insert into module_map (old_id, new_id)
  select m.id, gen_random_uuid() from modules m join course_map cm on cm.old_id = m.course_id;

  insert into modules (id, course_id, module_code, module_name, description, module_order, estimated_minutes, thumbnail, active)
  select mm.new_id, cm.new_id, 'RSPL-' || m.module_code, m.module_name, m.description, m.module_order, m.estimated_minutes, m.thumbnail, m.active
  from modules m
  join module_map mm on mm.old_id = m.id
  join course_map cm on cm.old_id = m.course_id;

  -- ── Lessons ──────────────────────────────────────────────────────────────────
  create temp table lesson_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  insert into lesson_map (old_id, new_id)
  select l.id, gen_random_uuid() from lessons l join module_map mm on mm.old_id = l.module_id;

  insert into lessons (id, module_id, lesson_title, lesson_type, content, video_url, duration_minutes, display_order, downloadable, active)
  select lm.new_id, mm.new_id, l.lesson_title, l.lesson_type, l.content, l.video_url, l.duration_minutes, l.display_order, l.downloadable, l.active
  from lessons l
  join lesson_map lm on lm.old_id = l.id
  join module_map mm on mm.old_id = l.module_id;

  -- ── Assessments (linked to specific lessons) ─────────────────────────────────
  create temp table assessment_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  insert into assessment_map (old_id, new_id)
  select a.id, gen_random_uuid() from assessments a join lesson_map lm on lm.old_id = a.lesson_id;

  insert into assessments (
    id, lesson_id, assessment_code, assessment_title, description, assessment_type, passing_percentage,
    maximum_attempts, duration_minutes, question_timer_enabled, question_time_seconds, shuffle_questions,
    shuffle_options, negative_marking, negative_marks, show_result_immediately, show_correct_answers,
    auto_submit, certificate_enabled, active
  )
  select
    am.new_id, lm.new_id, 'RSPL-' || a.assessment_code, a.assessment_title, a.description, a.assessment_type, a.passing_percentage,
    a.maximum_attempts, a.duration_minutes, a.question_timer_enabled, a.question_time_seconds, a.shuffle_questions,
    a.shuffle_options, a.negative_marking, a.negative_marks, a.show_result_immediately, a.show_correct_answers,
    a.auto_submit, a.certificate_enabled, a.active
  from assessments a
  join assessment_map am on am.old_id = a.id
  join lesson_map lm on lm.old_id = a.lesson_id;

  -- ── Question bank + options ───────────────────────────────────────────────────
  create temp table question_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  insert into question_map (old_id, new_id)
  select q.id, gen_random_uuid() from question_bank q join assessment_map am on am.old_id = q.assessment_id;

  insert into question_bank (
    id, assessment_id, question_code, question_text, question_type, difficulty_level, marks, negative_marks,
    time_limit_seconds, explanation, hint, display_order, mandatory, randomize_options, attachment_url,
    image_url, active
  )
  select
    qm.new_id, am.new_id, 'RSPL-' || q.question_code, q.question_text, q.question_type, q.difficulty_level, q.marks, q.negative_marks,
    q.time_limit_seconds, q.explanation, q.hint, q.display_order, q.mandatory, q.randomize_options, q.attachment_url,
    q.image_url, q.active
  from question_bank q
  join question_map qm on qm.old_id = q.id
  join assessment_map am on am.old_id = q.assessment_id;

  insert into question_options (question_id, option_text, is_correct, display_order)
  select qm.new_id, o.option_text, o.is_correct, o.display_order
  from question_options o
  join question_map qm on qm.old_id = o.question_id;

  -- ── Learning path (new row, pointed at Realty Smartz's own copied courses) ──
  insert into learning_paths (path_code, path_name, description, thumbnail_url, estimated_duration, difficulty_level, active, published, display_order)
  select 'RSPL-LP-001', 'Realty Smartz Sales Career Path', lp.description, lp.thumbnail_url, lp.estimated_duration, lp.difficulty_level, lp.active, lp.published, lp.display_order
  from learning_paths lp where lp.path_code = 'LP-RE-001'
  returning id into v_new_learning_path_id;

  insert into learning_path_courses (learning_path_id, course_id, sequence_no, mandatory, unlock_previous, estimated_duration, active)
  select
    v_new_learning_path_id, cm.new_id, lpc.sequence_no, lpc.mandatory, lpc.unlock_previous, lpc.estimated_duration, lpc.active
  from learning_path_courses lpc
  join course_map cm on cm.old_id = lpc.course_id
  where lpc.learning_path_id = (select id from learning_paths where path_code = 'LP-RE-001');

  -- ── Move Amit Arora ──────────────────────────────────────────────────────────
  update employees set active = false where company_id = v_old_company_id and employee_code = 'AMIT01';

  insert into employees (
    company_id, branch_id, department_id, designation_id, employee_code, first_name, last_name,
    mobile, email, active, password, attendance_location_scope
  ) values (
    v_new_company_id, v_branch_id, v_department_id, v_designation_id, 'AMIT01', 'Amit', 'Arora',
    '9810000200', 'amit.arora@demo.com', true, 'Amit@2026', 'specific'
  );

  -- ── Assign the new employee the new company's SUPER_ADMIN role ─────────────
  insert into employee_roles (employee_id, role_id, assigned_date, active)
  select e.id, r.id, now(), true
  from employees e, roles r
  where e.company_id = v_new_company_id and e.employee_code = 'AMIT01'
    and r.company_id = v_new_company_id and r.role_code = 'SUPER_ADMIN';
end $$;
