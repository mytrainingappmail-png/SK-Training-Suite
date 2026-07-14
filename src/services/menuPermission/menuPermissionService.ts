import type { MenuPermission } from "../../types/menuPermission";
import type { MenuPermissionForm } from "../../types/menuPermission";

import {
  getMenuPermissions,
  getMenusByRole as repositoryGetMenusByRole,
  assignMenu as repositoryAssignMenu,
  removeMenu as repositoryRemoveMenu,
  replaceMenus as repositoryReplaceMenus,
} from "../../repositories/menuPermission/menuPermissionRepository";

export async function loadMenuPermissions(): Promise<MenuPermission[]> {
  return await getMenuPermissions();
}

export async function loadMenusByRole(
  roleId: string
): Promise<MenuPermission[]> {
  if (!roleId) throw new Error("Role is required.");
  return await repositoryGetMenusByRole(roleId);
}

export async function assignMenu(
  data: MenuPermissionForm
): Promise<MenuPermission> {
  if (!data.role_id) throw new Error("Role is required.");
  if (!data.menu_id) throw new Error("Menu is required.");

  // Prevent duplicate mapping
  const existing = await repositoryGetMenusByRole(data.role_id);
  const duplicate = existing.find((mp) => mp.menu_id === data.menu_id);
  if (duplicate) {
    throw new Error("This menu is already assigned to the selected role.");
  }

  return await repositoryAssignMenu(data);
}

export async function removeMenu(
  roleId: string,
  menuId: string
): Promise<void> {
  if (!roleId) throw new Error("Role is required.");
  if (!menuId) throw new Error("Menu is required.");
  await repositoryRemoveMenu(roleId, menuId);
}

export async function saveMenuPermissions(
  roleId: string,
  menuIds: string[]
): Promise<void> {
  if (!roleId) throw new Error("Role is required.");
  await repositoryReplaceMenus(roleId, menuIds);
}
