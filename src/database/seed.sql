BEGIN;

-- ===========================================================
-- ROLES
-- company_id resolved from company_code = 'SKE001'
-- Guard: WHERE NOT EXISTS on (company_id, role_code)
-- ===========================================================

INSERT INTO roles (role_code, role_name, hierarchy_level, description, system_role, active, company_id)
SELECT 'SUPER_ADMIN', 'Super Administrator', 1, 'Full system access. All permissions granted.', TRUE, TRUE,
       (SELECT id FROM companies WHERE company_code = 'SKE001')
WHERE NOT EXISTS (
    SELECT 1 FROM roles
    WHERE company_id = (SELECT id FROM companies WHERE company_code = 'SKE001')
      AND role_code = 'SUPER_ADMIN'
);

INSERT INTO roles (role_code, role_name, hierarchy_level, description, system_role, active, company_id)
SELECT 'ADMIN', 'Administrator', 2, 'Company-level administration access.', TRUE, TRUE,
       (SELECT id FROM companies WHERE company_code = 'SKE001')
WHERE NOT EXISTS (
    SELECT 1 FROM roles
    WHERE company_id = (SELECT id FROM companies WHERE company_code = 'SKE001')
      AND role_code = 'ADMIN'
);

INSERT INTO roles (role_code, role_name, hierarchy_level, description, system_role, active, company_id)
SELECT 'HR', 'Human Resources', 3, 'Employee and organisational data management.', TRUE, TRUE,
       (SELECT id FROM companies WHERE company_code = 'SKE001')
WHERE NOT EXISTS (
    SELECT 1 FROM roles
    WHERE company_id = (SELECT id FROM companies WHERE company_code = 'SKE001')
      AND role_code = 'HR'
);

INSERT INTO roles (role_code, role_name, hierarchy_level, description, system_role, active, company_id)
SELECT 'TRAINER', 'Trainer', 4, 'Manage and deliver training content.', TRUE, TRUE,
       (SELECT id FROM companies WHERE company_code = 'SKE001')
WHERE NOT EXISTS (
    SELECT 1 FROM roles
    WHERE company_id = (SELECT id FROM companies WHERE company_code = 'SKE001')
      AND role_code = 'TRAINER'
);

INSERT INTO roles (role_code, role_name, hierarchy_level, description, system_role, active, company_id)
SELECT 'TEAM_LEADER', 'Team Leader', 5, 'Supervise team members and track their progress.', TRUE, TRUE,
       (SELECT id FROM companies WHERE company_code = 'SKE001')
WHERE NOT EXISTS (
    SELECT 1 FROM roles
    WHERE company_id = (SELECT id FROM companies WHERE company_code = 'SKE001')
      AND role_code = 'TEAM_LEADER'
);

INSERT INTO roles (role_code, role_name, hierarchy_level, description, system_role, active, company_id)
SELECT 'EMPLOYEE', 'Employee', 6, 'Standard learner access to assigned courses.', TRUE, TRUE,
       (SELECT id FROM companies WHERE company_code = 'SKE001')
WHERE NOT EXISTS (
    SELECT 1 FROM roles
    WHERE company_id = (SELECT id FROM companies WHERE company_code = 'SKE001')
      AND role_code = 'EMPLOYEE'
);

-- ===========================================================
-- PERMISSIONS
-- Guard: WHERE NOT EXISTS on permission_code
-- ===========================================================

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_dashboard', 'View Dashboard', 'Dashboard', 'Access the main dashboard'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_dashboard');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_company', 'View Company', 'Company', 'View company records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_company');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_company', 'Create Company', 'Company', 'Create new companies'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_company');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_company', 'Edit Company', 'Company', 'Edit company details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_company');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_company', 'Delete Company', 'Company', 'Delete companies'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_company');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_branch', 'View Branch', 'Branch', 'View branch records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_branch');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_branch', 'Create Branch', 'Branch', 'Create new branches'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_branch');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_branch', 'Edit Branch', 'Branch', 'Edit branch details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_branch');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_branch', 'Delete Branch', 'Branch', 'Delete branches'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_branch');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_department', 'View Department', 'Department', 'View department records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_department');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_department', 'Create Department', 'Department', 'Create new departments'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_department');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_department', 'Edit Department', 'Department', 'Edit department details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_department');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_department', 'Delete Department', 'Department', 'Delete departments'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_department');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_designation', 'View Designation', 'Designation', 'View designation records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_designation');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_designation', 'Create Designation', 'Designation', 'Create new designations'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_designation');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_designation', 'Edit Designation', 'Designation', 'Edit designation details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_designation');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_designation', 'Delete Designation', 'Designation', 'Delete designations'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_designation');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_employee', 'View Employee', 'Employee', 'View employee records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_employee');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_employee', 'Create Employee', 'Employee', 'Create new employees'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_employee');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_employee', 'Edit Employee', 'Employee', 'Edit employee details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_employee');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_employee', 'Delete Employee', 'Employee', 'Delete employees'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_employee');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_category', 'View Category', 'Category', 'View category records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_category');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_category', 'Create Category', 'Category', 'Create new categories'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_category');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_category', 'Edit Category', 'Category', 'Edit category details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_category');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_category', 'Delete Category', 'Category', 'Delete categories'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_category');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_course', 'View Course', 'Course', 'View course records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_course');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_course', 'Create Course', 'Course', 'Create new courses'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_course');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_course', 'Edit Course', 'Course', 'Edit course details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_course');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_course', 'Delete Course', 'Course', 'Delete courses'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_course');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_module', 'View Module', 'Module', 'View module records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_module');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_module', 'Create Module', 'Module', 'Create new modules'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_module');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_module', 'Edit Module', 'Module', 'Edit module details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_module');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_module', 'Delete Module', 'Module', 'Delete modules'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_module');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_lesson', 'View Lesson', 'Lesson', 'View lesson records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_lesson');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_lesson', 'Create Lesson', 'Lesson', 'Create new lessons'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_lesson');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_lesson', 'Edit Lesson', 'Lesson', 'Edit lesson details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_lesson');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_lesson', 'Delete Lesson', 'Lesson', 'Delete lessons'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_lesson');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_resource', 'View Resource', 'Resource', 'View resource records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_resource');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_resource', 'Create Resource', 'Resource', 'Create new resources'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_resource');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_resource', 'Edit Resource', 'Resource', 'Edit resource details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_resource');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_resource', 'Delete Resource', 'Resource', 'Delete resources'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_resource');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_assessment', 'View Assessment', 'Assessment', 'View assessment records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_assessment');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_assessment', 'Create Assessment', 'Assessment', 'Create new assessments'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_assessment');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_assessment', 'Edit Assessment', 'Assessment', 'Edit assessment details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_assessment');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_assessment', 'Delete Assessment', 'Assessment', 'Delete assessments'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_assessment');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_question_bank', 'View Question Bank', 'Question Bank', 'View question bank'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_question_bank');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_question', 'Create Question', 'Question Bank', 'Create new questions'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_question');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_question', 'Edit Question', 'Question Bank', 'Edit question details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_question');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_question', 'Delete Question', 'Question Bank', 'Delete questions'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_question');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_assignment', 'View Assignment', 'Assignment', 'View assignment records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_assignment');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_assignment', 'Create Assignment', 'Assignment', 'Create new assignments'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_assignment');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_assignment', 'Edit Assignment', 'Assignment', 'Edit assignment details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_assignment');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_assignment', 'Delete Assignment', 'Assignment', 'Delete assignments'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_assignment');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_evaluation_rule', 'View Evaluation Rule', 'Evaluation Rule', 'View evaluation rules'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_evaluation_rule');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_evaluation_rule', 'Create Evaluation Rule', 'Evaluation Rule', 'Create evaluation rules'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_evaluation_rule');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_evaluation_rule', 'Edit Evaluation Rule', 'Evaluation Rule', 'Edit evaluation rules'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_evaluation_rule');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_evaluation_rule', 'Delete Evaluation Rule', 'Evaluation Rule', 'Delete evaluation rules'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_evaluation_rule');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_assessment_result', 'View Assessment Result', 'Assessment Result', 'View assessment results'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_assessment_result');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_assessment_result', 'Create Assessment Result', 'Assessment Result', 'Create assessment results'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_assessment_result');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_assessment_result', 'Edit Assessment Result', 'Assessment Result', 'Edit assessment results'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_assessment_result');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_assessment_result', 'Delete Assessment Result', 'Assessment Result', 'Delete assessment results'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_assessment_result');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_certificate', 'View Certificate', 'Certificate', 'View certificate records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_certificate');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_certificate', 'Create Certificate', 'Certificate', 'Create new certificates'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_certificate');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_certificate', 'Edit Certificate', 'Certificate', 'Edit certificate details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_certificate');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_certificate', 'Delete Certificate', 'Certificate', 'Delete certificates'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_certificate');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_cert_template', 'View Certificate Template', 'Certificate Template', 'View certificate templates'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_cert_template');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_cert_template', 'Create Certificate Template', 'Certificate Template', 'Create certificate templates'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_cert_template');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_cert_template', 'Edit Certificate Template', 'Certificate Template', 'Edit certificate templates'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_cert_template');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_cert_template', 'Delete Certificate Template', 'Certificate Template', 'Delete certificate templates'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_cert_template');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_cert_queue', 'View Certificate Queue', 'Certificate Queue', 'View certificate generation queue'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_cert_queue');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_cert_queue', 'Create Certificate Queue', 'Certificate Queue', 'Trigger certificate generation'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_cert_queue');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_cert_queue', 'Edit Certificate Queue', 'Certificate Queue', 'Edit certificate queue records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_cert_queue');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_cert_queue', 'Delete Certificate Queue', 'Certificate Queue', 'Delete certificate queue records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_cert_queue');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_cert_verification', 'View Certificate Verification', 'Certificate Verification', 'View certificate verification records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_cert_verification');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_cert_verification', 'Create Certificate Verification', 'Certificate Verification', 'Create verification records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_cert_verification');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_cert_verification', 'Edit Certificate Verification', 'Certificate Verification', 'Edit verification details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_cert_verification');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_cert_verification', 'Delete Certificate Verification', 'Certificate Verification', 'Delete verification records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_cert_verification');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_learning_path', 'View Learning Path', 'Learning Path', 'View learning path records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_learning_path');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_learning_path', 'Create Learning Path', 'Learning Path', 'Create new learning paths'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_learning_path');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_learning_path', 'Edit Learning Path', 'Learning Path', 'Edit learning path details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_learning_path');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_learning_path', 'Delete Learning Path', 'Learning Path', 'Delete learning paths'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_learning_path');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_lp_course', 'View Learning Path Course', 'Learning Path Course', 'View learning path course records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_lp_course');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_lp_course', 'Create Learning Path Course', 'Learning Path Course', 'Create learning path courses'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_lp_course');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_lp_course', 'Edit Learning Path Course', 'Learning Path Course', 'Edit learning path courses'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_lp_course');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_lp_course', 'Delete Learning Path Course', 'Learning Path Course', 'Delete learning path courses'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_lp_course');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_lp_enrollment', 'View Learning Path Enrollment', 'Learning Path Enrollment', 'View learning path enrollments'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_lp_enrollment');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_lp_enrollment', 'Create Learning Path Enrollment', 'Learning Path Enrollment', 'Create learning path enrollments'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_lp_enrollment');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_lp_enrollment', 'Edit Learning Path Enrollment', 'Learning Path Enrollment', 'Edit learning path enrollments'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_lp_enrollment');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_lp_enrollment', 'Delete Learning Path Enrollment', 'Learning Path Enrollment', 'Delete learning path enrollments'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_lp_enrollment');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_lp_progress', 'View Learning Path Progress', 'Learning Path Progress', 'View learning path progress'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_lp_progress');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_lp_progress', 'Create Learning Path Progress', 'Learning Path Progress', 'Create learning path progress records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_lp_progress');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_lp_progress', 'Edit Learning Path Progress', 'Learning Path Progress', 'Edit learning path progress'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_lp_progress');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_lp_progress', 'Delete Learning Path Progress', 'Learning Path Progress', 'Delete learning path progress'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_lp_progress');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_training_batch', 'View Training Batch', 'Training Batch', 'View training batch records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_training_batch');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_training_batch', 'Create Training Batch', 'Training Batch', 'Create new training batches'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_training_batch');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_training_batch', 'Edit Training Batch', 'Training Batch', 'Edit training batch details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_training_batch');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_training_batch', 'Delete Training Batch', 'Training Batch', 'Delete training batches'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_training_batch');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_role', 'View Role', 'Role', 'View role records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_role');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_role', 'Create Role', 'Role', 'Create new roles'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_role');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_role', 'Edit Role', 'Role', 'Edit role details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_role');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_role', 'Delete Role', 'Role', 'Delete roles'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_role');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_permission', 'View Permission', 'Permission', 'View permission records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_permission');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_permission', 'Create Permission', 'Permission', 'Create new permissions'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_permission');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_permission', 'Edit Permission', 'Permission', 'Edit permission details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_permission');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_permission', 'Delete Permission', 'Permission', 'Delete permissions'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_permission');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_menu', 'View Menu', 'Menu', 'View menu records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_menu');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_menu', 'Create Menu', 'Menu', 'Create new menus'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_menu');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_menu', 'Edit Menu', 'Menu', 'Edit menu details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_menu');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_menu', 'Delete Menu', 'Menu', 'Delete menus'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_menu');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_theme', 'View Theme', 'Theme', 'View theme records'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_theme');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_theme', 'Create Theme', 'Theme', 'Create new themes'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_theme');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_theme', 'Edit Theme', 'Theme', 'Edit theme details'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_theme');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_theme', 'Delete Theme', 'Theme', 'Delete themes'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_theme');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_reports', 'View Reports', 'Reports', 'View all reports'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_reports');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'export_reports', 'Export Reports', 'Reports', 'Export report data'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'export_reports');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'view_settings', 'View Settings', 'Settings', 'View system settings'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'view_settings');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'create_settings', 'Create Settings', 'Settings', 'Create new settings'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'create_settings');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'edit_settings', 'Edit Settings', 'Settings', 'Edit system settings'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'edit_settings');

INSERT INTO permissions (permission_code, permission_name, module_name, description)
SELECT 'delete_settings', 'Delete Settings', 'Settings', 'Delete settings'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE permission_code = 'delete_settings');

-- ===========================================================
-- ROLE_PERMISSIONS  —  SUPER_ADMIN receives every permission
-- role_id and permission_id both resolved via SELECT
-- Guard: WHERE NOT EXISTS on (role_id, permission_id) pair
-- ===========================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   roles r
       CROSS JOIN permissions p
WHERE  r.role_code  = 'SUPER_ADMIN'
  AND  r.company_id = (SELECT id FROM companies WHERE company_code = 'SKE001')
  AND  NOT EXISTS (
           SELECT 1 FROM role_permissions rp
           WHERE  rp.role_id       = r.id
             AND  rp.permission_id = p.id
       );

-- ===========================================================
-- MENUS
-- Guard: WHERE NOT EXISTS on menu_code
-- ===========================================================

INSERT INTO menus (menu_code, menu_name, parent_menu_id, route_path, icon, display_order, menu_level, active)
SELECT 'MENU_DASHBOARD', 'Dashboard', NULL, '/dashboard', 'layout-dashboard', 1, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_code = 'MENU_DASHBOARD');

INSERT INTO menus (menu_code, menu_name, parent_menu_id, route_path, icon, display_order, menu_level, active)
SELECT 'MENU_EMPLOYEES', 'Employees', NULL, '/employees', 'users', 2, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_code = 'MENU_EMPLOYEES');

INSERT INTO menus (menu_code, menu_name, parent_menu_id, route_path, icon, display_order, menu_level, active)
SELECT 'MENU_TRAINING', 'Training', NULL, '/training', 'graduation-cap', 3, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_code = 'MENU_TRAINING');

INSERT INTO menus (menu_code, menu_name, parent_menu_id, route_path, icon, display_order, menu_level, active)
SELECT 'MENU_COURSES', 'Courses', NULL, '/courses', 'book-open', 4, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_code = 'MENU_COURSES');

INSERT INTO menus (menu_code, menu_name, parent_menu_id, route_path, icon, display_order, menu_level, active)
SELECT 'MENU_MODULES', 'Modules', NULL, '/admin', 'folder', 5, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_code = 'MENU_MODULES');

INSERT INTO menus (menu_code, menu_name, parent_menu_id, route_path, icon, display_order, menu_level, active)
SELECT 'MENU_ASSESSMENTS', 'Assessments', NULL, '/assessment', 'clipboard-list', 6, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_code = 'MENU_ASSESSMENTS');

INSERT INTO menus (menu_code, menu_name, parent_menu_id, route_path, icon, display_order, menu_level, active)
SELECT 'MENU_LP', 'Learning Paths', NULL, '/admin', 'award', 7, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_code = 'MENU_LP');

INSERT INTO menus (menu_code, menu_name, parent_menu_id, route_path, icon, display_order, menu_level, active)
SELECT 'MENU_CERTIFICATES', 'Certificates', NULL, '/admin', 'award', 8, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_code = 'MENU_CERTIFICATES');

INSERT INTO menus (menu_code, menu_name, parent_menu_id, route_path, icon, display_order, menu_level, active)
SELECT 'MENU_REPORTS', 'Reports', NULL, '/reports', 'chart-bar', 9, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_code = 'MENU_REPORTS');

INSERT INTO menus (menu_code, menu_name, parent_menu_id, route_path, icon, display_order, menu_level, active)
SELECT 'MENU_SETTINGS', 'Settings', NULL, '/settings', 'settings', 10, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_code = 'MENU_SETTINGS');

INSERT INTO menus (menu_code, menu_name, parent_menu_id, route_path, icon, display_order, menu_level, active)
SELECT 'MENU_ADMIN', 'Administration', NULL, '/admin', 'shield', 11, 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_code = 'MENU_ADMIN');

-- ===========================================================
-- MENU_PERMISSIONS  —  SUPER_ADMIN receives every menu
-- role_id and menu_id both resolved via SELECT
-- Guard: WHERE NOT EXISTS on (menu_id, role_id) pair
-- ===========================================================

INSERT INTO menu_permissions (menu_id, role_id)
SELECT m.id, r.id
FROM   menus m
       CROSS JOIN roles r
WHERE  r.role_code  = 'SUPER_ADMIN'
  AND  r.company_id = (SELECT id FROM companies WHERE company_code = 'SKE001')
  AND  NOT EXISTS (
           SELECT 1 FROM menu_permissions mp
           WHERE  mp.menu_id = m.id
             AND  mp.role_id = r.id
       );

-- ===========================================================
-- EMPLOYEE_ROLES
-- Maps known employee UUID to SUPER_ADMIN
-- role_id resolved via SELECT on role_code
-- Guard: WHERE NOT EXISTS on (employee_id, role_id) pair
-- ===========================================================

INSERT INTO employee_roles (employee_id, role_id, assigned_date, active)
SELECT 'aaa02903-3a73-45c9-b0ef-2a8c720cb220'::UUID,
       r.id,
       CURRENT_DATE,
       TRUE
FROM   roles r
WHERE  r.role_code  = 'SUPER_ADMIN'
  AND  r.company_id = (SELECT id FROM companies WHERE company_code = 'SKE001')
  AND  NOT EXISTS (
           SELECT 1 FROM employee_roles er
           WHERE  er.employee_id = 'aaa02903-3a73-45c9-b0ef-2a8c720cb220'::UUID
             AND  er.role_id     = r.id
       );

COMMIT;
