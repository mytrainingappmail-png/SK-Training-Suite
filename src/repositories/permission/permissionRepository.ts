// src/repositories/permission/permissionRepository.ts
//
// Repository layer — Supabase ONLY, zero business logic. Reuses the
// existing shared Supabase client (same one every other repository in
// this project already imports). Tables: roles, permissions,
// role_permissions, employee_roles. Uses the single canonical shapes
// from types/permission.ts exclusively.

import { supabase } from '../../lib/supabase';
import type {
  Role, RoleForm,
  Permission, PermissionForm,
  RolePermission, RolePermissionForm,
  EmployeeRole,
} from '../../types/permission';
import { getMyCompanyId } from '../../services/company/currentCompanyContext';

// ── Roles ──────────────────────────────────────────────────────────────────

// Explicitly filtered by the caller's own company_id — see branchRepository.ts.
export async function getRoles(): Promise<Role[]> {
  const companyId = await getMyCompanyId();
  const { data, error } = await supabase.from('roles').select('*').eq('company_id', companyId).order('role_name', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createRole(form: RoleForm): Promise<Role> {
  const { data, error } = await supabase.from('roles').insert(form).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateRole(id: string, form: Partial<RoleForm>): Promise<Role> {
  const { data, error } = await supabase.from('roles').update(form).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteRole(id: string): Promise<void> {
  const { error } = await supabase.from('roles').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Permissions ──────────────────────────────────────────────────────────────

export async function getPermissions(): Promise<Permission[]> {
  const { data, error } = await supabase.from('permissions').select('*').order('permission_code', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createPermission(form: PermissionForm): Promise<Permission> {
  const { data, error } = await supabase.from('permissions').insert(form).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePermission(id: string, form: Partial<PermissionForm>): Promise<Permission> {
  const { data, error } = await supabase.from('permissions').update(form).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deletePermission(id: string): Promise<void> {
  const { error } = await supabase.from('permissions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Role ↔ Permission matrix ─────────────────────────────────────────────────

// role_permissions has no company_id column of its own (it joins through
// role_id) -- scoped by first resolving the caller's own roles, then
// filtering to just those. See branchRepository.ts for why this can't be
// left to RLS alone.
export async function getRolePermissions(): Promise<RolePermission[]> {
  const myRoles = await getRoles();
  const roleIds = myRoles.map((r) => r.id);
  if (roleIds.length === 0) return [];
  const { data, error } = await supabase.from('role_permissions').select('*').in('role_id', roleIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function assignRolePermission(form: RolePermissionForm): Promise<RolePermission> {
  const { data: existingRows, error: existingError } = await supabase
    .from('role_permissions')
    .select('*')
    .eq('role_id', form.role_id)
    .eq('permission_id', form.permission_id);
  if (existingError) throw new Error(existingError.message);
  if (existingRows && existingRows.length > 0) return existingRows[0];

  const { data, error } = await supabase
    .from('role_permissions')
    .insert(form)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Grants every given permission to a role in one statement — used when provisioning a brand-new Super Admin role, instead of one assignRolePermission round trip per permission. */
export async function assignAllPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void> {
  if (permissionIds.length === 0) return;
  const rows = permissionIds.map((permission_id) => ({ role_id: roleId, permission_id }));
  const { error } = await supabase.from('role_permissions').insert(rows);
  if (error) throw new Error(error.message);
}

export async function deleteRolePermission(roleId: string, permissionId: string): Promise<void> {
  const { error } = await supabase
    .from('role_permissions')
    .delete()
    .eq('role_id', roleId)
    .eq('permission_id', permissionId);
  if (error) throw new Error(error.message);
}

// ── Employee ↔ Role assignments ──────────────────────────────────────────────

export async function getEmployeeRoles(employeeId: string): Promise<EmployeeRole[]> {
  const { data, error } = await supabase.from('employee_roles').select('*').eq('employee_id', employeeId);
  if (error) throw new Error(error.message);
  return data ?? [];
}
