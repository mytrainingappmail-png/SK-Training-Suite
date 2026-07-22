// src/pages/DashboardRouter.tsx
//
// Wraps the existing /dashboard route. Checks the logged-in user's
// real role_code directly:
//   - TRAINER -> TrainerDashboard.
//   - SUPER_ADMIN / ADMIN (or has view_dashboard permission) -> the
//     existing, unmodified company-wide Dashboard.
//   - Everyone else (a plain Employee, regardless of how Permission
//     Matrix happens to be configured) -> redirect to Learning Home
//     instead of a blank company Dashboard. Dashboard.tsx itself is
//     never touched.

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '../services/auth/session';
import { loadRoles } from '../services/role/roleService';
import { useAuthorization } from '../hooks/useAuthorization';
import { PERMISSIONS } from '../constants/permissions';
import { ROUTES } from '../constants/routes';
import Dashboard from './Dashboard';
import TrainerDashboard from '../components/dashboard/TrainerDashboard';

function DashboardRouter() {
  const user = getCurrentUser();
  const { can, ready } = useAuthorization();
  const [roleCode, setRoleCode] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!user?.roleId) {
      setRoleCode(null);
      return;
    }
    loadRoles()
      .then((roles) => {
        const role = roles.find((r) => r.id === user.roleId);
        setRoleCode(role?.role_code ?? null);
      })
      .catch(() => setRoleCode(null));
  }, [user?.roleId]);

  // Resolving role/permissions — brief, avoids a flash of the wrong
  // view before both checks complete.
  if (roleCode === undefined || !ready) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (roleCode === 'TRAINER') return <TrainerDashboard />;

  // A plain Employee never sees the company-wide Dashboard, full stop
  // — regardless of how Permission Matrix happens to be configured.
  // This directly targets the reported bug: an Employee left with a
  // stray view_dashboard permission would otherwise still land on a
  // blank company Dashboard.
  if (roleCode === 'EMPLOYEE') {
    return <Navigate to={ROUTES.LEARNING_HOME} replace />;
  }

  // Every other role (Admin, Super Admin, HR, Team Leader, or any
  // custom role) follows the real permission system as usual.
  if (can(PERMISSIONS.VIEW_DASHBOARD)) {
    return <Dashboard />;
  }

  return <Navigate to={ROUTES.LEARNING_HOME} replace />;
}

export default DashboardRouter;