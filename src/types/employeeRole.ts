export interface EmployeeRole {

  id: string;

  employee_id: string;

  role_id: string;

  assigned_date: string;

  active: boolean;

  created_at: string;

  updated_at: string;

}

export type EmployeeRoleForm = Omit<
  EmployeeRole,
  "id" | "created_at" | "updated_at"
>;

export const defaultEmployeeRoleForm: EmployeeRoleForm = {
  employee_id:   "",
  role_id:       "",
  assigned_date: "",
  active:        true,
};
