// ─────────────────────────────────────────────────────────────────────────────
// useAuthorization
//
// Contains ZERO database logic.
// Reads from AuthorizationContext only.
// Verified imports:
//   src/context/AuthorizationContext.tsx  exports useAuthorizationContext
//   src/constants/permissions.ts          exports PERMISSIONS
//   src/types/authorization.ts            exports PermissionCode
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback } from "react";

import { useAuthorizationContext } from "../context/AuthorizationContext";
import { PERMISSIONS }             from "../constants/permissions";

import type { PermissionCode } from "../types/authorization";
import type { User }           from "../types/app";

// ─────────────────────────────────────────────────────────────────────────────
// Return type
// ─────────────────────────────────────────────────────────────────────────────

export interface UseAuthorizationReturn {
  /** Authenticated user or null when no session is active */
  user:        User | null;
  loading:     boolean;
  error:       string | null;
  ready:       boolean;
  /** Re-trigger the authorization load (e.g. after a role change) */
  refresh:     () => Promise<void>;
  /** All granted permission codes for the current session */
  permissions: Set<PermissionCode>;
  /** PERMISSIONS constant available without a separate import */
  PERMISSIONS: typeof PERMISSIONS;
  /** Returns true if the current user has this permission code */
  can:         (permission: PermissionCode) => boolean;
  /** Returns true only when the user holds every supplied permission */
  canAll:      (...permissions: PermissionCode[]) => boolean;
  /** Returns true when the user holds at least one supplied permission */
  canAny:      (...permissions: PermissionCode[]) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAuthorization(): UseAuthorizationReturn {
  const { data, loading, error, ready, refresh } = useAuthorizationContext();

  const permissionCodes = data?.permissionCodes ?? new Set<PermissionCode>();

  const can = useCallback(
    (permission: PermissionCode): boolean => permissionCodes.has(permission),
    [permissionCodes]
  );

  const canAll = useCallback(
    (...perms: PermissionCode[]): boolean =>
      perms.every((p) => permissionCodes.has(p)),
    [permissionCodes]
  );

  const canAny = useCallback(
    (...perms: PermissionCode[]): boolean =>
      perms.some((p) => permissionCodes.has(p)),
    [permissionCodes]
  );

  return {
    user:        data?.user ?? null,
    loading,
    error,
    ready,
    refresh,
    permissions: permissionCodes,
    PERMISSIONS,
    can,
    canAll,
    canAny,
  };
}
