export interface RolePermission {

  id: string;

  role_id: string;

  permission_id: string;

  created_at: string;

}

export type RolePermissionForm = Omit<
  RolePermission,
  "id" | "created_at"
>;
