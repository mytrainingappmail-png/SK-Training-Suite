// src/hooks/useCompanyLicense.ts
//
// Resolves the current logged-in user's own company license (real,
// grace-period-aware status from licenseService). Used by LicenseGuard.
// Companies without any license row are treated as "unrestricted" —
// Phase 1 does not force-assign a license to every existing company.

import { useEffect, useState, useCallback } from 'react';
import { useAuthorization } from './useAuthorization';
import { loadCompanyLicenses, loadPlans, daysUntilExpiry } from '../services/license/licenseService';
import type { CompanyLicense, SubscriptionPlan } from '../types/license';

export interface UseCompanyLicenseResult {
  license: CompanyLicense | null;
  plan: SubscriptionPlan | null;
  loading: boolean;
  daysLeft: number | null;
  reload: () => void;
}

export function useCompanyLicense(): UseCompanyLicenseResult {
  const { user } = useAuthorization();
  const [license, setLicense] = useState<CompanyLicense | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!user?.companyId) {
      setLicense(null);
      setPlan(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([loadCompanyLicenses(), loadPlans()])
      .then(([licenses, plans]) => {
        if (cancelled) return;
        const ownLicense = licenses.find((l) => l.company_id === user.companyId) ?? null;
        setLicense(ownLicense);
        setPlan(ownLicense ? plans.find((p) => p.id === ownLicense.plan_id) ?? null : null);
      })
      .catch(() => {
        // Fail open — never block the app because the license check
        // itself failed to load (e.g. transient network error).
        if (!cancelled) {
          setLicense(null);
          setPlan(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user?.companyId, reloadToken]);

  const daysLeft = license ? daysUntilExpiry(license.end_date) : null;
  const reload = useCallback(() => setReloadToken((v) => v + 1), []);

  return { license, plan, loading, daysLeft, reload };
}
