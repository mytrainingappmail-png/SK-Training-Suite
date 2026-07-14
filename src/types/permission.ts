export interface Permission {

  id: string;

  permission_code: string;

  permission_name: string;

  module_name: string;

  description: string;

  created_at: string;

}

export type PermissionForm = Omit<
  Permission,
  "id" | "created_at"
>;

export const defaultPermissionForm: PermissionForm = {
  permission_code: "",
  permission_name: "",
  module_name:     "",
  description:     "",
};

export const MODULE_NAMES: string[] = [
  "Company",
  "Branch",
  "Department",
  "Designation",
  "Employee",
  "Category",
  "Course",
  "Module",
  "Lesson",
  "Resource",
  "Assessment",
  "Question Bank",
  "Assignment",
  "Evaluation Rule",
  "Assessment Result",
  "Certificate",
  "Certificate Template",
  "Certificate Queue",
  "Certificate Verification",
  "Learning Path",
  "Learning Path Course",
  "Learning Path Enrollment",
  "Learning Path Progress",
  "Training Batch",
  "Role",
  "Permission",
  "Menu",
  "Theme",
  "Reports",
  "Settings",
];
