import type { Role } from "../../types/role";
import type { RoleForm } from "../../types/role";

import {
  getRoles,
  createRole as repositoryCreateRole,
  updateRole,
  deleteRole,
  toggleActive as repositoryToggleActive,
} from "../../repositories/role/roleRepository";

export async function loadRoles(): Promise<Role[]> {
  return await getRoles();
}

export async function createRole(data: RoleForm): Promise<Role> {
  validateForm(data);

  const existing = await getRoles();
  assertUniqueCode(data.role_code, existing);

  return await repositoryCreateRole(data);
}

export async function saveRole(id: string, data: RoleForm): Promise<Role> {
  if (!id) throw new Error("Invalid Role ID.");
  validateForm(data);

  const existing = await getRoles();
  assertUniqueCode(data.role_code, existing, id);

  return await updateRole(id, data);
}

export async function removeRole(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Role ID.");

  const existing = await getRoles();
  const role = existing.find((r) => r.id === id);

  if (role?.system_role) {
    throw new Error("System Roles cannot be deleted.");
  }

  await deleteRole(id);
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<Role> {
  if (!id) throw new Error("Invalid Role ID.");
  return await repositoryToggleActive(id, active);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(data: RoleForm): void {
  if (!data.company_id) {
    throw new Error("Company is required.");
  }

  if (!data.role_code.trim()) {
    throw new Error("Role Code is required.");
  }

  if (!data.role_name.trim()) {
    throw new Error("Role Name is required.");
  }

  if (data.hierarchy_level < 1) {
    throw new Error("Hierarchy Level must be greater than or equal to 1.");
  }
}

function assertUniqueCode(
  code: string,
  existing: Role[],
  excludeId?: string
): void {
  const normalised = code.trim().toLowerCase();
  const duplicate = existing.find(
    (r) =>
      r.role_code.trim().toLowerCase() === normalised &&
      (excludeId === undefined || r.id !== excludeId)
  );

  if (duplicate) {
    throw new Error(`Role Code "${code.trim()}" already exists.`);
  }
}
