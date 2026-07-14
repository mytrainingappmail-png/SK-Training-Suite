// ─────────────────────────────────────────────────────────────────────────────
// ProtectedRoute
//
// Verified imports:
//   react-router-dom               — Navigate (installed, used in App.tsx)
//   src/hooks/useAuthorization.ts  — useAuthorization (new file)
//   src/constants/routes.ts        — ROUTES (verified)
//   src/types/authorization.ts     — PermissionCode (new file)
// ─────────────────────────────────────────────────────────────────────────────

import { Navigate } from "react-router-dom";

import { useAuthorization } from "../../hooks/useAuthorization";
import { ROUTES }           from "../../constants/routes";

import type { PermissionCode } from "../../types/authorization";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * When supplied the user must hold ALL of these codes.
   * Omit to require only an active session.
   */
  requiredPermissions?: PermissionCode[];
  /** Redirect destination when access is denied. Defaults to ROUTES.LOGIN */
  redirectTo?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ProtectedRoute({
  children,
  requiredPermissions = [],
  redirectTo = ROUTES.LOGIN,
}: ProtectedRouteProps) {
  const { user, loading, ready, canAll } = useAuthorization();

  // Still resolving — show a minimal spinner to avoid a login-page flash
  if (!ready || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <svg
          className="h-8 w-8 animate-spin text-yellow-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
      </div>
    );
  }

  // No session
  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  // Session present but missing required permissions
  if (requiredPermissions.length > 0 && !canAll(...requiredPermissions)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
