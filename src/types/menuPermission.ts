export interface MenuPermission {

  id: string;

  menu_id: string;

  role_id: string;

  created_at: string;

}

export type MenuPermissionForm = Omit<
  MenuPermission,
  "id" | "created_at"
>;
