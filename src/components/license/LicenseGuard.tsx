// src/components/license/LicenseGuard.tsx
//
// Phase 2 — Grace Period + Auto-lock enforcement. Wraps the protected
// app content (used inside AppLayout, around <Outlet />):
//
//   active        → renders normally, no banner
//   grace_period  → renders normally + a dismissible warning banner
//   expired /
//   suspended     → blocks the app with a full-screen message
//
// A company with no license row at all (Phase 1 doesn't force-assign
// one to every existing company) is treated as unrestricted — never
// blocked.
//
// Safety exception: the Admin console (ROUTES.ADMIN) always stays
// reachable even when expired/suspended, so whoever manages the
// license can actually renew it — the same self-lock mistake we hit
// with Permission Matrix earlier must not happen here.

import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCompanyLicense } from '../../hooks/useCompanyLicense';
import { ROUTES } from '../../constants/routes';

function IconAlert({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>);
}
function IconLock({ className = 'h-10 w-10' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>);
}

function LicenseGuard({ children }: { children: React.ReactNode }) {
  const { license, plan, loading, daysLeft } = useCompanyLicense();
  const location = useLocation();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const isAdminRoute = location.pathname.startsWith(ROUTES.ADMIN);

  // Still resolving, or no license row exists yet — never block.
  if (loading || !license) {
    return <>{children}</>;
  }

  const blocked = license.status === 'expired' || license.status === 'suspended';

  if (blocked && !isAdminRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <IconLock />
          </div>
          <h2 className="mb-2 text-lg font-bold text-slate-900">
            {license.status === 'suspended' ? 'Subscription Suspended' : 'Subscription Expired'}
          </h2>
          <p className="mb-1 text-sm text-slate-500">
            {license.status === 'suspended'
              ? "Your organization's subscription has been suspended."
              : `Your ${plan?.plan_name ?? ''} subscription ended on ${new Date(license.end_date).toLocaleDateString()}${license.grace_period_days > 0 ? ` and the ${license.grace_period_days}-day grace period has also passed` : ''}.`}
          </p>
          <p className="text-sm text-slate-500">Please contact your administrator to renew access.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {license.status === 'grace_period' && !bannerDismissed && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 px-6 py-3 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <IconAlert className="h-4 w-4 flex-shrink-0" />
            <span>
              Your {plan?.plan_name ?? 'subscription'} expired on {new Date(license.end_date).toLocaleDateString()} —
              you're in a grace period{daysLeft !== null ? ` with ${Math.max(0, daysLeft + license.grace_period_days)} day(s) remaining` : ''}.
              Please renew to avoid losing access.
            </span>
          </div>
          <button onClick={() => setBannerDismissed(true)} className="flex-shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100">
            Dismiss
          </button>
        </div>
      )}
      {children}
    </>
  );
}

export default LicenseGuard;
