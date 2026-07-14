export interface Role {

  id: string;

  company_id: string;

  role_code: string;

  role_name: string;

  hierarchy_level: number;

  description: string;

  system_role: boolean;

  active: boolean;

  created_at: string;

  updated_at: string;

}

export type RoleForm = Omit<
  Role,
  "id" | "created_at" | "updated_at"
>;

export const defaultRoleForm: RoleForm = {
  company_id:      "",
  role_code:       "",
  role_name:       "",
  hierarchy_level: 1,
  description:     "",
  system_role:     false,
  active:          true,
};
