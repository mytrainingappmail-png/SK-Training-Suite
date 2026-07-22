// src/modules/license/CompanyLicenseManagement.tsx
//
// License & Subscription — Phase 1. Real per-company license assignment,
// with a real usage dashboard (actual employee/course counts vs plan
// limits — never mocked) and grace-period-aware status. Not yet wired
// into sidebar/routes — standalone module.

import { useEffect, useState } from 'react';
import {
  loadPlans,
  loadCompanyLicenses,
  saveNewCompanyLicense,
  saveCompanyLicense,
  suspendCompanyLicense,
  reactivateCompanyLicense,
  removeCompanyLicense,
  loadUsageForCompany,
  daysUntilExpiry,
} from '../../services/license/licenseService';
import { loadCompanies } from '../../services/company/companyService';
import { defaultCompanyLicenseForm } from '../../types/license';
import type { SubscriptionPlan, CompanyLicense, CompanyLicenseForm } from '../../types/license';
import type { LicenseUsage } from '../../services/license/licenseService';
import type { Company } from '../../types/company';

function IconPlus({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>);
}
function IconTrash({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>);
}
function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}

function PrimaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">{children}</button>);
}
function SecondaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>{children}</button>);
}
function DangerButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">{children}</button>);
}
const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

function Skeleton() {
  return (<div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)}</div>);
}
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (<div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"><p className="font-semibold">Failed to load licenses</p><p className="mt-1">{message}</p><SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton></div>);
}
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  grace_period: 'bg-amber-50 text-amber-700',
  expired: 'bg-red-50 text-red-700',
  suspended: 'bg-slate-200 text-slate-600',
};
const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  grace_period: 'Grace Period',
  expired: 'Expired',
  suspended: 'Suspended',
};

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const over = used > max;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className={over ? 'font-semibold text-red-600' : 'text-slate-400'}>{used} / {max}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CompanyLicenseManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [licenses, setLicenses] = useState<CompanyLicense[]>([]);
  const [usageByCompany, setUsageByCompany] = useState<Record<string, LicenseUsage>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyLicenseForm>(defaultCompanyLicenseForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompanyLicense | null>(null);
  const [deleting, setDeleting] = useState(false);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([loadCompanies(), loadPlans(), loadCompanyLicenses()])
      .then(async ([companyRows, planRows, licenseRows]) => {
        setCompanies(companyRows);
        setPlans(planRows);
        setLicenses(licenseRows);

        const usageEntries = await Promise.all(
          licenseRows.map(async (lic) => [lic.company_id, await loadUsageForCompany(lic.company_id)] as const)
        );
        const usageMap: Record<string, LicenseUsage> = {};
        usageEntries.forEach(([companyId, usage]) => { usageMap[companyId] = usage; });
        setUsageByCompany(usageMap);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load licenses.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const companyById = new Map(companies.map((c) => [c.id, c]));
  const planById = new Map(plans.map((p) => [p.id, p]));
  const licensedCompanyIds = new Set(licenses.map((l) => l.company_id));
  const companiesWithoutLicense = companies.filter((c) => !licensedCompanyIds.has(c.id));

  function openCreate() {
    setEditingId(null);
    setForm(defaultCompanyLicenseForm);
    setCreatingOpen(true);
  }

  function openEdit(lic: CompanyLicense) {
    setEditingId(lic.id);
    setForm({
      company_id: lic.company_id,
      plan_id: lic.plan_id,
      start_date: lic.start_date,
      end_date: lic.end_date,
      billing_cycle: lic.billing_cycle,
      grace_period_days: lic.grace_period_days,
      auto_renew: lic.auto_renew,
    });
    setCreatingOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        await saveCompanyLicense(editingId, form);
      } else {
        await saveNewCompanyLicense(form);
      }
      setCreatingOpen(false);
      fetchAll();
      showToast('License saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save license.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSuspend(lic: CompanyLicense) {
    try {
      await suspendCompanyLicense(lic.id);
      fetchAll();
      showToast('License suspended');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to suspend license.');
    }
  }

  async function handleReactivate(lic: CompanyLicense) {
    try {
      await reactivateCompanyLicense(lic.id, lic);
      fetchAll();
      showToast('License reactivated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reactivate license.');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeCompanyLicense(deleteTarget.id);
      setDeleteTarget(null);
      fetchAll();
      showToast('License removed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove license.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Company Licenses</h2>
          <p className="text-sm text-slate-500">Real, per-company subscription — usage is live, computed from actual employees and courses.</p>
        </div>
        <PrimaryButton onClick={openCreate} disabled={companiesWithoutLicense.length === 0 && !editingId}>
          <IconPlus className="h-3.5 w-3.5" /> Assign License
        </PrimaryButton>
      </div>

      {licenses.length === 0 ? (
        <EmptyState message="No company has a license yet — assign one to get started." />
      ) : (
        <div className="space-y-4">
          {licenses.map((lic) => {
            const company = companyById.get(lic.company_id);
            const plan = planById.get(lic.plan_id);
            const usage = usageByCompany[lic.company_id];
            const days = daysUntilExpiry(lic.end_date);
            return (
              <div key={lic.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <p className="text-base font-bold text-slate-900">{company?.company_name ?? 'Unknown Company'}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[lic.status] ?? ''}`}>
                        {STATUS_LABELS[lic.status] ?? lic.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {plan?.plan_name ?? 'Unknown Plan'} · {lic.billing_cycle} · Ends {new Date(lic.end_date).toLocaleDateString()}
                      {' · '}
                      {days >= 0 ? `${days} day(s) left` : `Expired ${Math.abs(days)} day(s) ago`}
                      {lic.grace_period_days > 0 ? ` · ${lic.grace_period_days}-day grace period` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SecondaryButton onClick={() => openEdit(lic)}>Edit</SecondaryButton>
                    {lic.status === 'suspended' ? (
                      <SecondaryButton onClick={() => handleReactivate(lic)}>Reactivate</SecondaryButton>
                    ) : (
                      <SecondaryButton onClick={() => handleSuspend(lic)}>Suspend</SecondaryButton>
                    )}
                    <DangerButton onClick={() => setDeleteTarget(lic)}><IconTrash /></DangerButton>
                  </div>
                </div>
                {plan && usage && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <UsageBar label="Employees" used={usage.employeeCount} max={plan.max_employees} />
                    <UsageBar label="Courses" used={usage.courseCount} max={plan.max_courses} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {creatingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setCreatingOpen(false)} />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-slate-900">{editingId ? 'Edit License' : 'Assign License'}</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Company</label>
                <select
                  value={form.company_id}
                  onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value }))}
                  disabled={!!editingId}
                  className={`${INPUT_CLS} disabled:opacity-60`}
                >
                  <option value="">Select a company…</option>
                  {(editingId ? companies : companiesWithoutLicense).map((c) => (<option key={c.id} value={c.id}>{c.company_name}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Plan</label>
                <select value={form.plan_id} onChange={(e) => setForm((f) => ({ ...f, plan_id: e.target.value }))} className={INPUT_CLS}>
                  <option value="">Select a plan…</option>
                  {plans.map((p) => (<option key={p.id} value={p.id}>{p.plan_name}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Start Date</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">End Date</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} className={INPUT_CLS} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Billing Cycle</label>
                  <select value={form.billing_cycle} onChange={(e) => setForm((f) => ({ ...f, billing_cycle: e.target.value as 'monthly' | 'yearly' }))} className={INPUT_CLS}>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Grace Period (days)</label>
                  <input type="number" min={0} value={form.grace_period_days} onChange={(e) => setForm((f) => ({ ...f, grace_period_days: Number(e.target.value) }))} className={INPUT_CLS} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.auto_renew} onChange={(e) => setForm((f) => ({ ...f, auto_renew: e.target.checked }))} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400" />
                Auto-renew
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <SecondaryButton onClick={() => setCreatingOpen(false)} disabled={saving}>Cancel</SecondaryButton>
              <PrimaryButton onClick={handleSave} disabled={saving || !form.company_id || !form.plan_id || !form.start_date || !form.end_date}>
                {saving ? <IconSpinner className="h-3.5 w-3.5" /> : null} Save
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-slate-900">Remove License</h3>
            <p className="mb-5 text-sm text-slate-500">Remove this company's license? They will have no active subscription afterward.</p>
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</SecondaryButton>
              <DangerButton onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? <IconSpinner className="h-3.5 w-3.5" /> : <IconTrash />} Remove
              </DangerButton>
            </div>
          </div>
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

export default CompanyLicenseManagement;
