// ─────────────────────────────────────────────────────────────────────────────
// sidebarPermissions
//
// Maps every menu id (from src/config/menu.ts) to the permission code(s)
// a user must hold to see that sidebar entry.
//
// Verified imports:
//   src/constants/permissions.ts — PERMISSIONS (as const, verified)
//   src/constants/routes.ts      — ROUTES (verified)
//   src/types/authorization.ts   — PermissionCode (new file, same project)
//
// Menu ids verified from src/config/menu.ts:
//   "dashboard" | "employees" | "training" | "courses"
//   "assessment" | "reports"  | "settings" | "admin"
// ─────────────────────────────────────────────────────────────────────────────

import { PERMISSIONS } from "../constants/permissions";
import { ROUTES }      from "../constants/routes";

import type { PermissionCode } from "../types/authorization";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SidebarPermissionEntry {
  /** Must exactly match the id field in src/config/menu.ts */
  menuId: string;
  /** The route this entry corresponds to */
  route: string;
  /**
   * The user must hold AT LEAST ONE of these codes for the item to be visible.
   * An empty array means the entry is visible to all authenticated users.
   */
  requiredPermissions: PermissionCode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Entries — order mirrors src/config/menu.ts
// ─────────────────────────────────────────────────────────────────────────────

export const SIDEBAR_PERMISSIONS: SidebarPermissionEntry[] = [
  {
    menuId:              "dashboard",
    route:               ROUTES.DASHBOARD,
    requiredPermissions: [PERMISSIONS.VIEW_DASHBOARD],
  },
  {
    menuId:              "employees",
    route:               ROUTES.EMPLOYEES,
    requiredPermissions: [PERMISSIONS.VIEW_EMPLOYEE],
  },
  {
    menuId:              "training",
    route:               ROUTES.TRAINING,
    requiredPermissions: [PERMISSIONS.VIEW_COURSE],
  },
  {
    menuId:              "courses",
    route:               ROUTES.COURSES,
    requiredPermissions: [PERMISSIONS.VIEW_COURSE],
  },
  {
    menuId:              "assessment",
    route:               ROUTES.ASSESSMENT,
    requiredPermissions: [PERMISSIONS.VIEW_ASSESSMENT],
  },
  {
    menuId:              "reports",
    route:               ROUTES.REPORTS,
    requiredPermissions: [PERMISSIONS.VIEW_REPORTS],
  },
  {
    menuId:              "settings",
    route:               ROUTES.SETTINGS,
    requiredPermissions: [PERMISSIONS.VIEW_SETTINGS],
  },
  {
    menuId:              "admin",
    route:               ROUTES.ADMIN,
    // Admin console: visible to any user who can view at least one
    // administrative resource. Super Admin holds all permissions.
    requiredPermissions: [PERMISSIONS.VIEW_COMPANY],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper consumed by Sidebar.tsx
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the set of menuIds the current user is allowed to see.
 * Pass the permissionCodes Set from useAuthorization().permissions.
 */
export function getVisibleMenuIds(
  grantedPermissions: Set<PermissionCode>
): Set<string> {
  const visible = new Set<string>();

  for (const entry of SIDEBAR_PERMISSIONS) {
    if (entry.requiredPermissions.length === 0) {
      // No restriction — all authenticated users see this
      visible.add(entry.menuId);
      continue;
    }
    const allowed = entry.requiredPermissions.some((p) =>
      grantedPermissions.has(p)
    );
    if (allowed) visible.add(entry.menuId);
  }

  return visible;
}
