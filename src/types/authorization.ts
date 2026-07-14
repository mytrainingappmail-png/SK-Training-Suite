// ─────────────────────────────────────────────────────────────────────────────
// Derived from the verified src/constants/permissions.ts PERMISSIONS object.
// No other permission sources exist in the project.
// ─────────────────────────────────────────────────────────────────────────────

import { PERMISSIONS } from "../constants/permissions";

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ─────────────────────────────────────────────────────────────────────────────
// Resolved per-session authorization data.
// User is sourced from src/types/app.ts (verified).
// ─────────────────────────────────────────────────────────────────────────────

import type { User } from "./app";

export interface AuthorizationData {
  user: User;
  permissionCodes: Set<PermissionCode>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shape exposed by AuthorizationContext to all consumers.
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthorizationContextValue {
  /** Resolved data — null when no session or while loading */
  data: AuthorizationData | null;
  /** True during the initial load */
  loading: boolean;
  /** Non-null when the load failed */
  error: string | null;
  /** True once at least one load attempt has finished */
  ready: boolean;
  /** Re-run the authorization load */
  refresh: () => Promise<void>;
}
