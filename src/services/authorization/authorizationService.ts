// File: src/services/authorization/authorizationService.ts
//
// Authentication and Authorization are independent.
// If a session user exists, ALWAYS return { user, permissionCodes }.
// Never return null because authorization tables are empty.
// permissionCodes is an empty Set when no role/permissions are assigned yet.
//
// Verified imports:
//   ../../lib/supabase        → src/lib/supabase.ts              (exports: supabase)
//   ../auth/session           → src/services/auth/session.ts     (exports: getCurrentUser)
//   ../../types/app           → src/types/app.ts                 (exports: User)
//   ../../types/authorization → src/types/authorization.ts       (exports: AuthorizationData, PermissionCode)

import { supabase }       from '../../lib/supabase';
import { getCurrentUser } from '../auth/session';

import type { User }              from '../../types/app';
import type { AuthorizationData } from '../../types/authorization';
import type { PermissionCode }    from '../../types/authorization';

// ─────────────────────────────────────────────────────────────────────────────
// Public — called only by AuthorizationContext
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves authorization data for the current session user.
 *
 * Returns null ONLY when there is no authenticated session.
 *
 * When a session exists, always returns { user, permissionCodes } —
 * permissionCodes is an empty Set when employee_roles, role_permissions,
 * or permissions tables are empty or contain no matching rows.
 * Authorization table state never causes a null return.
 */
export async function resolveAuthorization(): Promise<AuthorizationData | null> {
  const user = getCurrentUser();

  // No session — caller (AuthorizationContext) treats this as unauthenticated.
  if (!user) return null;

  // Always resolve permissions, but gracefully return empty set on any failure.
  const permissionCodes = await resolvePermissions(user);

  return { user, permissionCodes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Top-level permission resolver.
 * Returns empty Set on any error so authentication is never blocked
 * by missing or empty authorization tables.
 */
async function resolvePermissions(user: User): Promise<Set<PermissionCode>> {
  try {
    const roleId = await resolveRoleId(user);

    // No role assigned yet (employee_roles is empty or has no active row).
    // Return empty set — user is authenticated but has no permissions.
    if (!roleId) return new Set<PermissionCode>();

    return await loadPermissionCodes(roleId);
  } catch {
    // Any unexpected error must not block the authenticated session.
    console.error('[authorizationService] resolvePermissions failed — returning empty set.');
    return new Set<PermissionCode>();
  }
}

/**
 * Returns the active role_id for this user from employee_roles.
 * Returns null when the table is empty or no active row exists.
 *
 * Table:   employee_roles
 * Columns: employee_id, role_id, active, assigned_date
 */
async function resolveRoleId(user: User): Promise<string | null> {
  const { data, error } = await supabase
    .from('employee_roles')
    .select('role_id')
    .eq('employee_id', user.id)
    .eq('active', true)
    .order('assigned_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[authorizationService] resolveRoleId:', error.message);
    return null;
  }

  return data?.role_id ?? null;
}

/**
 * Returns all permission codes for the given role.
 * Returns empty Set when role_permissions or permissions tables are empty.
 *
 * Tables:  role_permissions (role_id, permission_id)
 *          permissions      (id, permission_code)
 */
async function loadPermissionCodes(
  roleId: string
): Promise<Set<PermissionCode>> {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('permissions ( permission_code )')
    .eq('role_id', roleId);

  if (error) {
    console.error('[authorizationService] loadPermissionCodes:', error.message);
    return new Set<PermissionCode>();
  }

  const codes = new Set<PermissionCode>();

  for (const row of data ?? []) {
    const perm = Array.isArray(row.permissions)
      ? row.permissions[0]
      : row.permissions;

    if (perm?.permission_code) {
      codes.add(perm.permission_code as PermissionCode);
    }
  }

  return codes;
}