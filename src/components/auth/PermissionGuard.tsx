// ─────────────────────────────────────────────────────────────────────────────
// PermissionGuard
//
// Wraps JSX; shows/hides based on permission codes.
// Contains zero database logic.
// Verified imports:
//   src/hooks/useAuthorization.ts — useAuthorization
//   src/types/authorization.ts    — PermissionCode
// ─────────────────────────────────────────────────────────────────────────────

import { useAuthorization } from "../../hooks/useAuthorization";

import type { PermissionCode } from "../../types/authorization";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface PermissionGuardProps {
  children: React.ReactNode;
  /**
   * User must hold ALL of these codes.
   * Mutually exclusive with anyOf.
   */
  allOf?: PermissionCode[];
  /**
   * User must hold AT LEAST ONE of these codes.
   * Mutually exclusive with allOf.
   */
  anyOf?: PermissionCode[];
  /** Optional content rendered when the check fails. Defaults to null. */
  fallback?: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function PermissionGuard({
  children,
  allOf,
  anyOf,
  fallback = null,
}: PermissionGuardProps) {
  const { canAll, canAny, user, loading, ready } = useAuthorization();

  // While loading, render nothing to avoid a content flash
  if (!ready || loading) return null;

  // No session — never show protected content
  if (!user) return <>{fallback}</>;

  let granted = true;

  if (allOf && allOf.length > 0) {
    granted = canAll(...allOf);
  } else if (anyOf && anyOf.length > 0) {
    granted = canAny(...anyOf);
  }
  // If neither prop is supplied, any authenticated user sees the content

  return granted ? <>{children}</> : <>{fallback}</>;
}
