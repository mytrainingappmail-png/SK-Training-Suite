-- The original RLS hardening pass (20260722120000) enabled row-level
-- security on ~35 tables without adding a single index to back any of their
-- policy predicates — every later migration in this project correctly
-- indexes company_id/FK columns for new features, but the foundational
-- schema never got the same treatment. Harmless at today's data volume;
-- becomes a full sequential scan on every RLS-filtered query once a real
-- customer has hundreds of employees and months of history. Purely
-- additive — cannot change any query result, only how fast it runs.
--
-- Two shapes, matching how 20260722120000's policies actually filter:
--  (a) tables with a direct company_id column — index it, it's directly
--      sargable against `company_id = current_employee_company_id()`.
--  (b) tables scoped via a helper function walking a foreign-key chain
--      (e.g. assessment_company_id(assessment_id)) — index the FK column
--      itself. This doesn't make the RLS predicate itself sargable (a
--      function-wrapped comparison never is), but it's exactly the column
--      the app's own repositories already filter by directly, and it's
--      what every one of those helper functions does its own lookup on.

-- (a) direct company_id
create index if not exists idx_assessment_assignments_company on assessment_assignments (company_id);
create index if not exists idx_attendance_company on attendance (company_id);
create index if not exists idx_employees_company on employees (company_id);
create index if not exists idx_company_licenses_company on company_licenses (company_id);
create index if not exists idx_course_categories_company on course_categories (company_id);
create index if not exists idx_courses_company on courses (company_id);
create index if not exists idx_departments_company on departments (company_id);
create index if not exists idx_designations_company on designations (company_id);
create index if not exists idx_enrollments_company on enrollments (company_id);
create index if not exists idx_learning_path_enrollments_company on learning_path_enrollments (company_id);
create index if not exists idx_roles_company on roles (company_id);
create index if not exists idx_training_batches_company on training_batches (company_id);
create index if not exists idx_users_company on users (company_id);
create index if not exists idx_branches_company on branches (company_id);
create index if not exists idx_attendance_locations_company on attendance_locations (company_id);
create index if not exists idx_trainer_assignments_company on trainer_assignments (company_id);
create index if not exists idx_real_estate_projects_company on real_estate_projects (company_id);
create index if not exists idx_real_estate_project_categories_company on real_estate_project_categories (company_id);
create index if not exists idx_library_videos_company on library_videos (company_id);
create index if not exists idx_video_subjects_company on video_subjects (company_id);

-- (b) FK columns behind a company-resolving helper function
create index if not exists idx_employee_attendance_locations_employee on employee_attendance_locations (employee_id);
create index if not exists idx_employee_roles_employee on employee_roles (employee_id);
create index if not exists idx_employee_lesson_progress_employee on employee_lesson_progress (employee_id);
create index if not exists idx_employee_module_progress_employee on employee_module_progress (employee_id);
create index if not exists idx_admin_module_unlock_overrides_employee on admin_module_unlock_overrides (employee_id);
create index if not exists idx_modules_course on modules (course_id);
create index if not exists idx_lessons_module on lessons (module_id);
create index if not exists idx_learning_resources_lesson on learning_resources (lesson_id);
create index if not exists idx_course_visibility_course on course_visibility (course_id);
create index if not exists idx_learning_path_courses_course on learning_path_courses (course_id);
create index if not exists idx_learning_path_progress_employee on learning_path_progress (employee_id);
create index if not exists idx_assessments_lesson on assessments (lesson_id);
create index if not exists idx_assessment_questions_assessment on assessment_questions (assessment_id);
create index if not exists idx_assessment_options_question on assessment_options (question_id);
create index if not exists idx_assessment_attempts_employee on assessment_attempts (employee_id);
create index if not exists idx_assessment_answers_attempt on assessment_answers (attempt_id);
create index if not exists idx_assessment_results_employee on assessment_results (employee_id);
create index if not exists idx_question_bank_assessment on question_bank (assessment_id);
create index if not exists idx_question_options_question on question_options (question_id);
create index if not exists idx_evaluation_rules_assessment on evaluation_rules (assessment_id);
create index if not exists idx_certificates_employee on certificates (employee_id);
create index if not exists idx_certificate_verifications_certificate on certificate_verifications (certificate_id);
create index if not exists idx_certificate_generation_queue_employee on certificate_generation_queue (employee_id);
create index if not exists idx_branch_geofences_branch on branch_geofences (branch_id);
create index if not exists idx_real_estate_project_brochures_project on real_estate_project_brochures (project_id);
create index if not exists idx_role_permissions_role on role_permissions (role_id);
create index if not exists idx_license_notifications_company_license on license_notifications (company_license_id);
create index if not exists idx_menu_permissions_role on menu_permissions (role_id);
