// The company's project names for the "which project" picker in Performance Tracker's activity details — loaded once,
// and only when the picker is switched on (Settings → Activity Details). Typing a name by hand always works regardless.

import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadProjectNames } from '../../services/performanceTracker/performanceTrackerService';

export function useProjectNames(enabled: boolean): string[] {
  const companyId = getCurrentUser()?.companyId;
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    if (!enabled || !companyId) return;
    let cancelled = false;
    loadProjectNames(companyId).then((n) => { if (!cancelled) setNames(n); }).catch(() => { /* typing a name still works */ });
    return () => { cancelled = true; };
  }, [enabled, companyId]);
  return names;
}
