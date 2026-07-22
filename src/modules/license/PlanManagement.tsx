// src/modules/license/PlanManagement.tsx
//
// License & Subscription — Phase 1. Subscription plan CRUD. Not yet
// wired into sidebar/routes — standalone module.

import { useEffect, useState } from 'react';
import {
  loadPlans,
  saveNewPlan,
  savePlan,
  removePlan,
  seedDefaultPlans,
} from '../../services/license/licenseService';
import { defaultPlanForm } from '../../types/license';
import type { SubscriptionPlan, SubscriptionPlanForm } from '../../types/license';

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
  return (<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-100" />)}</div>);
}
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (<div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"><p className="font-semibold">Failed to load plans</p><p className="mt-1">{message}</p><SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton></div>);
}
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

function PlanManagement() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SubscriptionPlanForm>(defaultPlanForm);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null);
  const [deleting, setDeleting] = useState(false);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    loadPlans()
      .then(setPlans)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load plans.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function handleSeedDefaults() {
    setSeeding(true);
    try {
      const created = await seedDefaultPlans(plans);
      fetchAll();
      showToast(created.length > 0 ? `Created ${created.length} default plan(s)` : 'Default plans already exist');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to seed default plans.');
    } finally {
      setSeeding(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(defaultPlanForm);
    setCreatingOpen(true);
  }

  function openEdit(plan: SubscriptionPlan) {
    setEditingId(plan.id);
    setForm({
      plan_name: plan.plan_name,
      plan_code: plan.plan_code,
      description: plan.description,
      max_employees: plan.max_employees,
      max_courses: plan.max_courses,
      max_storage_gb: plan.max_storage_gb,
      max_certificates_per_month: plan.max_certificates_per_month,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      features: plan.features,
      active: plan.active,
    });
    setCreatingOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        await savePlan(editingId, form);
      } else {
        await saveNewPlan(form);
      }
      setCreatingOpen(false);
      fetchAll();
      showToast('Plan saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save plan.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removePlan(deleteTarget.id);
      setDeleteTarget(null);
      fetchAll();
      showToast('Plan deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete plan.');
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
          <h2 className="text-lg font-bold text-slate-900">Subscription Plans</h2>
          <p className="text-sm text-slate-500">Define the plans companies can subscribe to.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={handleSeedDefaults} disabled={seeding}>
            {seeding ? <IconSpinner className="h-3.5 w-3.5" /> : null} Seed Default Plans
          </SecondaryButton>
          <PrimaryButton onClick={openCreate}><IconPlus className="h-3.5 w-3.5" /> Create Plan</PrimaryButton>
        </div>
      </div>

      {plans.length === 0 ? (
        <EmptyState message="No plans yet — seed the defaults or create one." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.id} className="flex flex-col rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-base font-bold text-slate-900">{plan.plan_name}</p>
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${plan.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {plan.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="mb-3 text-xs text-slate-400">{plan.description || 'No description.'}</p>
              <div className="mb-4 space-y-1 text-xs text-slate-600">
                <p>👤 {plan.max_employees} employees</p>
                <p>📚 {plan.max_courses} courses</p>
                <p>💾 {plan.max_storage_gb} GB storage</p>
                <p>🏆 {plan.max_certificates_per_month} certs/month</p>
              </div>
              <div className="mb-4">
                <p className="text-xl font-bold text-slate-900">₹{plan.price_monthly.toLocaleString()}<span className="text-xs font-normal text-slate-400">/mo</span></p>
                <p className="text-xs text-slate-400">or ₹{plan.price_yearly.toLocaleString()}/yr</p>
              </div>
              <div className="mt-auto flex gap-2">
                <SecondaryButton onClick={() => openEdit(plan)} className="flex-1">Edit</SecondaryButton>
                <DangerButton onClick={() => setDeleteTarget(plan)}><IconTrash /></DangerButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {creatingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setCreatingOpen(false)} />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-slate-900">{editingId ? 'Edit Plan' : 'Create Plan'}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Plan Name</label>
                  <input value={form.plan_name} onChange={(e) => setForm((f) => ({ ...f, plan_name: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Plan Code</label>
                  <input value={form.plan_code} onChange={(e) => setForm((f) => ({ ...f, plan_code: e.target.value }))} className={`${INPUT_CLS} font-mono`} placeholder="e.g. professional" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={`${INPUT_CLS} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Max Employees</label>
                  <input type="number" min={1} value={form.max_employees} onChange={(e) => setForm((f) => ({ ...f, max_employees: Number(e.target.value) }))} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Max Courses</label>
                  <input type="number" min={1} value={form.max_courses} onChange={(e) => setForm((f) => ({ ...f, max_courses: Number(e.target.value) }))} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Storage (GB)</label>
                  <input type="number" min={1} value={form.max_storage_gb} onChange={(e) => setForm((f) => ({ ...f, max_storage_gb: Number(e.target.value) }))} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Certs/Month</label>
                  <input type="number" min={1} value={form.max_certificates_per_month} onChange={(e) => setForm((f) => ({ ...f, max_certificates_per_month: Number(e.target.value) }))} className={INPUT_CLS} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Price / Month (₹)</label>
                  <input type="number" min={0} value={form.price_monthly} onChange={(e) => setForm((f) => ({ ...f, price_monthly: Number(e.target.value) }))} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Price / Year (₹)</label>
                  <input type="number" min={0} value={form.price_yearly} onChange={(e) => setForm((f) => ({ ...f, price_yearly: Number(e.target.value) }))} className={INPUT_CLS} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Features (comma-separated)</label>
                <textarea value={form.features} onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))} rows={2} className={`${INPUT_CLS} resize-none`} placeholder="Course authoring, Assessments, Certificates" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400" />
                Active
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <SecondaryButton onClick={() => setCreatingOpen(false)} disabled={saving}>Cancel</SecondaryButton>
              <PrimaryButton onClick={handleSave} disabled={saving || !form.plan_name.trim() || !form.plan_code.trim()}>
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
            <h3 className="mb-1 text-lg font-bold text-slate-900">Delete Plan</h3>
            <p className="mb-5 text-sm text-slate-500">Delete "{deleteTarget.plan_name}"? Companies on this plan will keep their license, but it will no longer be assignable.</p>
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</SecondaryButton>
              <DangerButton onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? <IconSpinner className="h-3.5 w-3.5" /> : <IconTrash />} Delete
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

export default PlanManagement;
