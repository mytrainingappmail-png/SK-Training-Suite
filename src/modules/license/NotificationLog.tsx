// src/modules/license/NotificationLog.tsx
//
// Phase 3 — view sent license notifications, plus a manual "Run Check
// Now" button (useful for testing before wiring up a Cron Trigger).
// Not yet wired into sidebar/routes — standalone module.

import { useEffect, useState } from 'react';
import { runLicenseNotificationCheck } from '../../services/license/licenseNotificationService';
import { loadCompanyLicenses } from '../../services/license/licenseService';
import { loadCompanies } from '../../services/company/companyService';
import { supabase } from '../../lib/supabase';
import type { CompanyLicense, LicenseNotification, NotificationChannel } from '../../types/license';
import type { Company } from '../../types/company';

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}
function IconMail({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>);
}
function IconWhatsApp({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>);
}

function PrimaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">{children}</button>);
}

function Skeleton() {
  return (<div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>);
}
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <IconMail className="h-8 w-8 text-slate-300" />
      <p className="font-medium">{message}</p>
    </div>
  );
}

function NotificationLog() {
  const [licenses, setLicenses] = useState<CompanyLicense[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [notifications, setNotifications] = useState<LicenseNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [channel, setChannel] = useState<NotificationChannel>('email');
  const [lastRunSummary, setLastRunSummary] = useState('');
  const [toast, setToast] = useState('');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([loadCompanyLicenses(), loadCompanies()])
      .then(async ([licenseRows, companyRows]) => {
        setLicenses(licenseRows);
        setCompanies(companyRows);
        const allNotifications = await Promise.all(
          licenseRows.map((lic) => supabase.from('license_notifications').select('*').eq('company_license_id', lic.id))
        );
        const flat: LicenseNotification[] = [];
        allNotifications.forEach((res) => { if (res.data) flat.push(...res.data); });
        flat.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
        setNotifications(flat);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load notification log.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const companyByLicenseId = new Map(licenses.map((l) => [l.id, companies.find((c) => c.id === l.company_id)]));

  async function handleRunCheck() {
    setRunning(true);
    setLastRunSummary('');
    try {
      const result = await runLicenseNotificationCheck([channel]);
      setLastRunSummary(`Checked ${result.checked} license(s) — sent ${result.sent}, skipped ${result.skipped} (already up to date), ${result.failed} failed.`);
      if (result.errors.length > 0) {
        showToast(`Some notifications failed — see summary below for details.`);
      } else {
        showToast('Check complete');
      }
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to run the notification check.');
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <Skeleton />;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Expiry Notifications</h2>
          <p className="text-sm text-slate-500">
            Warnings fire 7 days, 3 days, and on the day of expiry — each is sent at most once per license.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={channel} onChange={(e) => setChannel(e.target.value as NotificationChannel)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <PrimaryButton onClick={handleRunCheck} disabled={running}>
            {running ? <IconSpinner className="h-3.5 w-3.5" /> : null} Run Check Now
          </PrimaryButton>
        </div>
      </div>

      {lastRunSummary && (
        <div className="rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-700">{lastRunSummary}</div>
      )}

      <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">
        This only sends automatically if you've deployed the <code className="rounded bg-amber-100 px-1 py-0.5">send-license-notification</code> Edge Function
        with your email/WhatsApp provider keys, and set up a daily Cron Trigger for it in Supabase. Use "Run Check Now" here to test manually in the meantime.
      </div>

      {notifications.length === 0 ? (
        <EmptyState message="No notifications sent yet." />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <tr key={n.id}>
                  <td className="px-4 py-2.5 font-medium text-slate-700">{companyByLicenseId.get(n.company_license_id)?.company_name ?? 'Unknown'}</td>
                  <td className="px-4 py-2.5 text-slate-500">{n.notification_type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {n.channel === 'email' ? <IconMail className="h-3 w-3" /> : <IconWhatsApp className="h-3 w-3" />} {n.channel}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{new Date(n.sent_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default NotificationLog;
