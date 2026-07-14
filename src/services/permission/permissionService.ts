import type { Permission } from "../../types/permission";
import type { PermissionForm } from "../../types/permission";

import {
  getPermissions,
  createPermission as repositoryCreatePermission,
  updatePermission,
  deletePermission,
} from "../../repositories/permission/permissionRepository";

export async function loadPermissions(): Promise<Permission[]> {
  return await getPermissions();
}

export async function createPermission(
  data: PermissionForm
): Promise<Permission> {
  validateForm(data);

  const existing = await getPermissions();
  assertUniqueCode(data.permission_code, existing);

  return await repositoryCreatePermission(data);
}

export async function savePermission(
  id: string,
  data: PermissionForm
): Promise<Permission> {
  if (!id) throw new Error("Invalid Permission ID.");
  validateForm(data);

  const existing = await getPermissions();
  assertUniqueCode(data.permission_code, existing, id);

  return await updatePermission(id, data);
}

export async function removePermission(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Permission ID.");
  await deletePermission(id);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(data: PermissionForm): void {
  if (!data.permission_code.trim()) {
    throw new Error("Permission Code is required.");
  }

  if (!data.permission_name.trim()) {
    throw new Error("Permission Name is required.");
  }

  if (!data.module_name.trim()) {
    throw new Error("Module Name is required.");
  }
}

function assertUniqueCode(
  code: string,
  existing: Permission[],
  excludeId?: string
): void {
  const normalised = code.trim().toLowerCase();
  const duplicate = existing.find(
    (p) =>
      p.permission_code.trim().toLowerCase() === normalised &&
      (excludeId === undefined || p.id !== excludeId)
  );

  if (duplicate) {
    throw new Error(`Permission Code "${code.trim()}" already exists.`);
  }
}
