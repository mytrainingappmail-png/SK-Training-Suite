// src/services/permission/permissionService.ts
//
// Service layer — business logic, validation, orchestration. Delegates
// all Supabase access to permissionRepository.ts. Uses the single
// canonical shapes from types/permission.ts exclusively — no aliasing,
// no alternate field names.

import {
  getRoles, createRole, updateRole, deleteRole,
  getPermissions, createPermission as createPermissionRow, updatePermission, deletePermission,
  getRolePermissions, assignRolePermission, deleteRolePermission,
  getEmployeeRoles,
} from '../../repositories/permission/permissionRepository';

import type {
  Role, RoleForm,
  Permission, PermissionForm,
  RolePermission,
} from '../../types/permission';
import { DEFAULT_ROLES, DEFAULT_PERMISSIONS } from '../../types/permission';

// ── Roles ──────────────────────────────────────────────────────────────────

export async function loadRoles(): Promise<Role[]> {
  return getRoles();
}

function validateRoleForm(form: RoleForm): void {
  if (!form.role_name.trim()) throw new Error('Role name is required.');
  if (!form.role_code.trim()) throw new Error('Role code is required.');
}

export async function createNewRole(form: RoleForm): Promise<Role> {
  validateRoleForm(form);
  return createRole(form);
}

export async function saveRole(id: string, form: Partial<RoleForm>): Promise<Role> {
  if (!id) throw new Error('Invalid role id.');
  return updateRole(id, form);
}

export async function removeRole(id: string, roles: Role[]): Promise<void> {
  const target = roles.find((r) => r.id === id);
  if (target?.is_system) throw new Error('System roles cannot be deleted.');
  await deleteRole(id);
}

export async function seedDefaultRoles(existingRoles: Role[]): Promise<Role[]> {
  const existingCodes = new Set(existingRoles.map((r) => r.role_code));
  const missing = DEFAULT_ROLES.filter((r) => !existingCodes.has(r.role_code));
  const created: Role[] = [];
  for (const role of missing) {
    created.push(await createRole(role));
  }
  return created;
}

// ── Permissions ──────────────────────────────────────────────────────────────

export async function loadPermissions(): Promise<Permission[]> {
  return getPermissions();
}

function validatePermissionForm(form: PermissionForm): void {
  if (!form.permission_code.trim()) throw new Error('Permission code is required.');
  if (!/^[a-z0-9_]+\.[a-z0-9_]+$/.test(form.permission_code.trim())) {
    throw new Error('Permission code must be in the form "module.action" (e.g. course.publish).');
  }
  if (!form.permission_name.trim()) throw new Error('Permission name is required.');
  if (!form.module_name.trim()) throw new Error('Module name is required.');
}

export async function createPermission(form: PermissionForm): Promise<Permission> {
  validatePermissionForm(form);
  return createPermissionRow(form);
}

export async function savePermission(id: string, form: Partial<PermissionForm>): Promise<Permission> {
  if (!id) throw new Error('Invalid permission id.');
  return updatePermission(id, form);
}

export async function removePermission(id: string): Promise<void> {
  await deletePermission(id);
}

export async function seedDefaultPermissions(existingPermissions: Permission[]): Promise<Permission[]> {
  const existingCodes = new Set(existingPermissions.map((p) => p.permission_code));
  const missing = DEFAULT_PERMISSIONS.filter((p) => !existingCodes.has(p.permission_code));
  const created: Permission[] = [];
  for (const form of missing) {
    created.push(await createPermissionRow(form));
  }
  return created;
}

// ── Role ↔ Permission matrix ─────────────────────────────────────────────────

export async function loadRolePermissions(): Promise<RolePermission[]> {
  return getRolePermissions();
}

export interface PermissionMatrixChange {
  roleId: string;
  permissionId: string;
  granted: boolean;
}

export async function saveMatrixChanges(changes: PermissionMatrixChange[]): Promise<void> {
  for (const change of changes) {
    if (change.granted) {
      await assignRolePermission({ role_id: change.roleId, permission_id: change.permissionId });
    } else {
      await deleteRolePermission(change.roleId, change.permissionId);
    }
  }
}

// ── Effective permissions for the current employee ──────────────────────────

export async function loadEmployeePermissionCodes(employeeId: string): Promise<Set<string>> {
  if (!employeeId) return new Set();

  const [employeeRoles, allRolePermissions, allPermissions] = await Promise.all([
    getEmployeeRoles(employeeId),
    getRolePermissions(),
    getPermissions(),
  ]);

  const activeRoleIds = new Set(employeeRoles.filter((er) => er.active).map((er) => er.role_id));
  if (activeRoleIds.size === 0) return new Set();

  const permissionById = new Map(allPermissions.map((p) => [p.id, p]));
  const grantedPermissionIds = new Set(
    allRolePermissions
      .filter((rp) => activeRoleIds.has(rp.role_id))
      .map((rp) => rp.permission_id)
  );

  const codes = new Set<string>();
  grantedPermissionIds.forEach((permissionId) => {
    const permission = permissionById.get(permissionId);
    if (permission) codes.add(permission.permission_code);
  });
  return codes;
}

export function hasPermission(permissionCodes: Set<string>, code: string): boolean {
  return permissionCodes.has(code);
}
