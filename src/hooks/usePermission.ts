// src/hooks/usePermission.ts
//
// Reads the current session's employee id (read-only — does not modify
// login/session logic) and resolves their effective permission set via
// permissionService. Exposes a `can(code)` check using the single
// canonical permission_code field.
//
//   const { can } = usePermission();
//   if (can('course.publish')) { ... }

import { useEffect, useState, useCallback } from 'react';
import { getCurrentUser } from '../services/auth/session';
import { loadEmployeePermissionCodes } from '../services/permission/permissionService';

export interface UsePermissionResult {
  can: (code: string) => boolean;
  permissionCodes: Set<string>;
  loading: boolean;
  error: string;
  reload: () => void;
}

export function usePermission(): UsePermissionResult {
  const [permissionCodes, setPermissionCodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const user = getCurrentUser();

    if (!user?.employeeId) {
      setPermissionCodes(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    loadEmployeePermissionCodes(user.employeeId)
      .then((codes) => {
        if (!cancelled) setPermissionCodes(codes);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load permissions.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [reloadToken]);

  const can = useCallback((code: string) => permissionCodes.has(code), [permissionCodes]);
  const reload = useCallback(() => setReloadToken((v) => v + 1), []);

  return { can, permissionCodes, loading, error, reload };
}
