// src/constants/adminModules.ts
//
// The full list of real Admin Console modules — id, label, and which
// permission gates it (undefined = always visible). This is the ONLY
// place a brand-new module's basic identity needs registering (since
// it's tied to a real component + import). WHICH CATEGORY each module
// lives in is no longer decided here — that's fully Admin-controlled
// via admin_module_categories / admin_module_assignments (see
// ModuleCategoryAssignment.tsx). A module with no assignment yet
// simply shows up under "Uncategorized" until an Admin sorts it.

import { PERMISSIONS } from "./permissions";

export interface AdminModuleDefinition {
  id: string;
  label: string;
  permission?: string;
}

export const ADMIN_MODULES: AdminModuleDefinition[] = [
  { id: "company",     label: "Company",      permission: PERMISSIONS.VIEW_COMPANY },
  { id: "branch",       label: "Branches",      permission: PERMISSIONS.VIEW_BRANCH },
  { id: "department",   label: "Departments",   permission: PERMISSIONS.VIEW_DEPARTMENT },
  { id: "designation",  label: "Designations",  permission: PERMISSIONS.VIEW_DESIGNATION },
  { id: "employee",     label: "Employees",     permission: PERMISSIONS.VIEW_EMPLOYEE },
  { id: "category",     label: "Categories",    permission: PERMISSIONS.VIEW_CATEGORY },

  { id: "course",         label: "Courses",         permission: PERMISSIONS.VIEW_COURSE },
  { id: "course-builder", label: "Course Builder",  permission: PERMISSIONS.VIEW_COURSE },
  { id: "resource",       label: "Resources",       permission: PERMISSIONS.VIEW_RESOURCE },

  { id: "assessment", label: "Assessment",       permission: PERMISSIONS.VIEW_ASSESSMENT },
  { id: "question",   label: "Question Bank",    permission: PERMISSIONS.VIEW_QUESTION_BANK },
  { id: "assignment", label: "Assignments",      permission: PERMISSIONS.VIEW_ASSIGNMENT },
  { id: "evaluation", label: "Evaluation Rules",  permission: PERMISSIONS.VIEW_EVALUATION_RULE },
  { id: "results",    label: "Results",           permission: PERMISSIONS.VIEW_ASSESSMENT_RESULT },

  { id: "certificate",                label: "Certificates",              permission: PERMISSIONS.VIEW_CERTIFICATE },
  { id: "certificate-template",       label: "Certificate Templates",     permission: PERMISSIONS.VIEW_CERT_TEMPLATE },
  { id: "certificate-generation",     label: "Certificate Queue",         permission: PERMISSIONS.VIEW_CERT_QUEUE },
  { id: "certificate-verification",   label: "Certificate Verification",  permission: PERMISSIONS.VIEW_CERT_VERIFICATION },
  { id: "bulk-certificate-issue",     label: "Bulk Certificate Issue" },

  { id: "learning-path",             label: "Learning Paths",             permission: PERMISSIONS.VIEW_LEARNING_PATH },
  { id: "learning-path-course",      label: "Learning Path Courses",      permission: PERMISSIONS.VIEW_LP_COURSE },
  { id: "learning-path-enrollment",  label: "Learning Path Enrollments",  permission: PERMISSIONS.VIEW_LP_ENROLLMENT },
  { id: "learning-path-progress",    label: "Learning Path Progress",     permission: PERMISSIONS.VIEW_LP_PROGRESS },

  { id: "enrollment",          label: "Enrollments",          permission: PERMISSIONS.VIEW_ENROLLMENT },
  { id: "training-batch",      label: "Training Batches",     permission: PERMISSIONS.VIEW_TRAINING_BATCH },
  { id: "trainer-assignment",  label: "Trainer Assignments",  permission: PERMISSIONS.VIEW_TRAINER_ASSIGNMENT },

  { id: "roles",           label: "Roles",             permission: PERMISSIONS.VIEW_ROLE },
  { id: "employee-role",   label: "Employee Roles",    permission: PERMISSIONS.VIEW_EMPLOYEE_ROLE },
  { id: "permissions",     label: "Permissions",       permission: PERMISSIONS.VIEW_PERMISSION },
  { id: "role-permission", label: "Permission Matrix", permission: PERMISSIONS.VIEW_PERMISSION },

  { id: "plans",                    label: "Plans" },
  { id: "company-license",          label: "Company Licenses" },
  { id: "discount-codes",           label: "Discount Codes" },
  { id: "license-notifications",    label: "License Notifications" },
  { id: "payment-settings",         label: "Payment Settings" },

  { id: "course-visibility", label: "Course Visibility" },
  { id: "attendance",        label: "Attendance" },
  { id: "geofence",          label: "Attendance Geofencing" },

  { id: "security-migration", label: "Secure Login Migration" },

  { id: "theme",    label: "Theme",    permission: PERMISSIONS.VIEW_THEME },
  { id: "settings", label: "Settings", permission: PERMISSIONS.VIEW_SETTINGS },
  { id: "menu",     label: "Menu",     permission: PERMISSIONS.VIEW_MENU },
  { id: "reports",  label: "Reports",  permission: PERMISSIONS.VIEW_REPORTS },

  // Admin manages its own module-organization tools from here too.
  { id: "module-categories", label: "Module Categories" },
];
