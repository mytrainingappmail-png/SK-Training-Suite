import { Navigate } from "react-router-dom";

import { useAuthorization } from "../../hooks/useAuthorization";
import { ROUTES }           from "../../constants/routes";

import type { PermissionCode } from "../../types/authorization";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ProtectedRouteProps {

  /** The page/layout to render when access is granted */
  children: React.ReactNode;

  /**
   * Optional permission code(s) required to access this route.
   * When omitted the route only requires an active session.
   * When one or more codes are supplied the user must hold ALL of them.
   */
  requiredPermissions?: PermissionCode[];

  /**
   * Where to redirect when access is denied.
   * Defaults to ROUTES.LOGIN.
   */
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

  // Still resolving — render nothing so we avoid a flash of the login page
  if (loading || !ready) {
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

  // No session — redirect to login
  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  // Session present but missing required permissions — redirect to login
  if (requiredPermissions.length > 0 && !canAll(...requiredPermissions)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
