import type { RolePermission } from "../../types/rolePermission";
import type { RolePermissionForm } from "../../types/rolePermission";

import {
  getRolePermissions,
  getPermissionsByRole as repositoryGetByRole,
  assignPermission as repositoryAssignPermission,
  removePermission as repositoryRemovePermission,
  replacePermissions as repositoryReplacePermissions,
} from "../../repositories/rolePermission/rolePermissionRepository";

export async function loadRolePermissions(): Promise<RolePermission[]> {
  return await getRolePermissions();
}

export async function loadPermissionsByRole(
  roleId: string
): Promise<RolePermission[]> {
  if (!roleId) throw new Error("Role is required.");
  return await repositoryGetByRole(roleId);
}

export async function assignPermission(
  data: RolePermissionForm
): Promise<RolePermission> {
  if (!data.role_id)       throw new Error("Role is required.");
  if (!data.permission_id) throw new Error("Permission is required.");

  // Prevent duplicate mapping
  const existing = await repositoryGetByRole(data.role_id);
  const duplicate = existing.find((rp) => rp.permission_id === data.permission_id);
  if (duplicate) {
    throw new Error("This permission is already assigned to the selected role.");
  }

  return await repositoryAssignPermission(data);
}

export async function removePermission(
  roleId: string,
  permissionId: string
): Promise<void> {
  if (!roleId)       throw new Error("Role is required.");
  if (!permissionId) throw new Error("Permission is required.");
  await repositoryRemovePermission(roleId, permissionId);
}

export async function saveRolePermissions(
  roleId: string,
  permissionIds: string[]
): Promise<void> {
  if (!roleId) throw new Error("Role is required.");
  await repositoryReplacePermissions(roleId, permissionIds);
}
