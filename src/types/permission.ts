// src/types/permission.ts
//
// Authorization Foundation — SINGLE canonical data model for the whole
// Permission module. Every repository/service/component file uses these
// exact shapes — nothing is renamed or reshaped downstream.
//
// Tables: roles, permissions, role_permissions, employee_roles.

export interface Role {
  id: string;
  role_name: string;
  role_code: string;
  description: string;
  is_system: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type RoleForm = Omit<Role, 'id' | 'created_at' | 'updated_at'>;

export const defaultRoleForm: RoleForm = {
  role_name: '',
  role_code: '',
  description: '',
  is_system: false,
  active: true,
};

export const DEFAULT_ROLES: RoleForm[] = [
  { role_name: 'Super Admin', role_code: 'SUPER_ADMIN', description: 'Full unrestricted access to every module.', is_system: true, active: true },
  { role_name: 'Admin', role_code: 'ADMIN', description: 'Manages company operations, training content and employees.', is_system: true, active: true },
  { role_name: 'Trainer', role_code: 'TRAINER', description: 'Creates and manages training content and evaluates learners.', is_system: true, active: true },
  { role_name: 'Employee', role_code: 'EMPLOYEE', description: 'Consumes assigned training content.', is_system: true, active: true },
];

export interface Permission {
  id: string;
  permission_code: string;
  permission_name: string;
  module_name: string;
  description: string;
  created_at: string;
}

export type PermissionForm = Omit<Permission, 'id' | 'created_at'>;

export const defaultPermissionForm: PermissionForm = {
  permission_code: '',
  permission_name: '',
  module_name: '',
  description: '',
};

export const MODULE_NAMES: string[] = [
  'Company',
  'Branch',
  'Department',
  'Designation',
  'Employee',
  'Category',
  'Course',
  'Module',
  'Lesson',
  'Resource',
  'Assessment',
  'Question Bank',
  'Assignment',
  'Evaluation Rule',
  'Assessment Result',
  'Certificate',
  'Certificate Template',
  'Certificate Queue',
  'Certificate Verification',
  'Learning Path',
  'Learning Path Course',
  'Learning Path Enrollment',
  'Learning Path Progress',
  'Training Batch',
  'Role',
  'Permission',
  'Menu',
  'Theme',
  'Reports',
  'Settings',
];

export const DEFAULT_PERMISSIONS: PermissionForm[] = [

  { permission_code: 'company.view', permission_name: 'View Companies', module_name: 'Company', description: 'View company records.' },
  { permission_code: 'company.create', permission_name: 'Create Company', module_name: 'Company', description: 'Create new company records.' },
  { permission_code: 'company.edit', permission_name: 'Edit Company', module_name: 'Company', description: 'Edit existing company records.' },
  { permission_code: 'company.delete', permission_name: 'Delete Company', module_name: 'Company', description: 'Delete company records.' },

  { permission_code: 'branch.view', permission_name: 'View Branches', module_name: 'Branch', description: 'View branch records.' },
  { permission_code: 'branch.create', permission_name: 'Create Branch', module_name: 'Branch', description: 'Create new branch records.' },
  { permission_code: 'branch.edit', permission_name: 'Edit Branch', module_name: 'Branch', description: 'Edit existing branch records.' },
  { permission_code: 'branch.delete', permission_name: 'Delete Branch', module_name: 'Branch', description: 'Delete branch records.' },

  { permission_code: 'department.view', permission_name: 'View Departments', module_name: 'Department', description: 'View department records.' },
  { permission_code: 'department.create', permission_name: 'Create Department', module_name: 'Department', description: 'Create new department records.' },
  { permission_code: 'department.edit', permission_name: 'Edit Department', module_name: 'Department', description: 'Edit existing department records.' },
  { permission_code: 'department.delete', permission_name: 'Delete Department', module_name: 'Department', description: 'Delete department records.' },

  { permission_code: 'employee.view', permission_name: 'View Employees', module_name: 'Employee', description: 'View employee records.' },
  { permission_code: 'employee.create', permission_name: 'Create Employee', module_name: 'Employee', description: 'Create new employee records.' },
  { permission_code: 'employee.edit', permission_name: 'Edit Employee', module_name: 'Employee', description: 'Edit existing employee records.' },
  { permission_code: 'employee.delete', permission_name: 'Delete Employee', module_name: 'Employee', description: 'Delete employee records.' },

  { permission_code: 'course.view', permission_name: 'View Courses', module_name: 'Course', description: 'View course records.' },
  { permission_code: 'course.create', permission_name: 'Create Course', module_name: 'Course', description: 'Create new courses.' },
  { permission_code: 'course.edit', permission_name: 'Edit Course', module_name: 'Course', description: 'Edit existing courses.' },
  { permission_code: 'course.delete', permission_name: 'Delete Course', module_name: 'Course', description: 'Delete courses.' },
  { permission_code: 'course.publish', permission_name: 'Publish Course', module_name: 'Course', description: 'Publish or unpublish a course.' },
  { permission_code: 'course.assign', permission_name: 'Assign Course', module_name: 'Course', description: 'Assign courses to employees.' },

  { permission_code: 'lesson.create', permission_name: 'Create Lesson', module_name: 'Lesson', description: 'Create new lessons.' },
  { permission_code: 'lesson.edit', permission_name: 'Edit Lesson', module_name: 'Lesson', description: 'Edit existing lessons.' },
  { permission_code: 'lesson.delete', permission_name: 'Delete Lesson', module_name: 'Lesson', description: 'Delete lessons.' },

  { permission_code: 'quiz.create', permission_name: 'Create Quiz', module_name: 'Assessment', description: 'Create new quizzes.' },
  { permission_code: 'quiz.edit', permission_name: 'Edit Quiz', module_name: 'Assessment', description: 'Edit existing quizzes.' },
  { permission_code: 'quiz.delete', permission_name: 'Delete Quiz', module_name: 'Assessment', description: 'Delete quizzes.' },

  { permission_code: 'assignment.review', permission_name: 'Review Assignment', module_name: 'Assignment', description: 'Review and grade assignment submissions.' },

  { permission_code: 'certificate.generate', permission_name: 'Generate Certificate', module_name: 'Certificate', description: 'Generate certificates for employees.' },

  { permission_code: 'reports.view', permission_name: 'View Reports', module_name: 'Reports', description: 'View reports.' },
  { permission_code: 'reports.export', permission_name: 'Export Reports', module_name: 'Reports', description: 'Export reports.' },

  { permission_code: 'settings.manage', permission_name: 'Manage Settings', module_name: 'Settings', description: 'Manage system settings.' },
];

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

export type RolePermissionForm = Omit<RolePermission, 'id' | 'created_at'>;

export interface EmployeeRole {
  id: string;
  employee_id: string;
  role_id: string;
  assigned_date: string;
  active: boolean;
  created_at: string;
}

export type EmployeeRoleForm = Omit<EmployeeRole, 'id' | 'created_at'>;
