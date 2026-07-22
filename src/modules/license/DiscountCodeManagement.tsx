// src/modules/license/DiscountCodeManagement.tsx
//
// License & Subscription — Phase 1. Discount code CRUD. Not yet wired
// into sidebar/routes — standalone module.

import { useEffect, useState } from 'react';
import {
  loadPlans,
  loadDiscountCodes,
  saveNewDiscountCode,
  saveDiscountCode,
  removeDiscountCode,
} from '../../services/license/licenseService';
import { defaultDiscountCodeForm } from '../../types/license';
import type { SubscriptionPlan, DiscountCode, DiscountCodeForm, DiscountType } from '../../types/license';

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
  return (<div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>);
}
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (<div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"><p className="font-semibold">Failed to load discount codes</p><p className="mt-1">{message}</p><SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton></div>);
}
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.83.699 2.528 0l4.319-4.319a1.79 1.79 0 0 0 0-2.528l-9.581-9.581A2.25 2.25 0 0 0 9.568 3Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" /></svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

function DiscountCodeManagement() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [creatingOpen, setCreatingOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DiscountCodeForm>(defaultDiscountCodeForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DiscountCode | null>(null);
  const [deleting, setDeleting] = useState(false);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([loadPlans(), loadDiscountCodes()])
      .then(([planRows, codeRows]) => {
        setPlans(planRows);
        setCodes(codeRows);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load discount codes.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const planById = new Map(plans.map((p) => [p.id, p]));

  function openCreate() {
    setEditingId(null);
    setForm(defaultDiscountCodeForm);
    setCreatingOpen(true);
  }

  function openEdit(code: DiscountCode) {
    setEditingId(code.id);
    setForm({
      code: code.code,
      discount_type: code.discount_type,
      discount_value: code.discount_value,
      valid_from: code.valid_from,
      valid_to: code.valid_to,
      max_uses: code.max_uses,
      applicable_plan_id: code.applicable_plan_id,
      active: code.active,
    });
    setCreatingOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        await saveDiscountCode(editingId, form);
      } else {
        await saveNewDiscountCode(form);
      }
      setCreatingOpen(false);
      fetchAll();
      showToast('Discount code saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save discount code.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeDiscountCode(deleteTarget.id);
      setDeleteTarget(null);
      fetchAll();
      showToast('Discount code deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete discount code.');
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
          <h2 className="text-lg font-bold text-slate-900">Discount Codes</h2>
          <p className="text-sm text-slate-500">Coupons applicable at subscription checkout.</p>
        </div>
        <PrimaryButton onClick={openCreate}><IconPlus className="h-3.5 w-3.5" /> Create Code</PrimaryButton>
      </div>

      {codes.length === 0 ? (
        <EmptyState message="No discount codes yet." />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Valid</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {codes.map((code) => (
                <tr key={code.id}>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-indigo-600">{code.code}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {code.discount_type === 'percentage' ? `${code.discount_value}%` : `₹${code.discount_value}`}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{code.applicable_plan_id ? (planById.get(code.applicable_plan_id)?.plan_name ?? 'Unknown') : 'All Plans'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{new Date(code.valid_from).toLocaleDateString()} – {new Date(code.valid_to).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-slate-500">{code.times_used} / {code.max_uses}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${code.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {code.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openEdit(code)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">Edit</button>
                      <button onClick={() => setDeleteTarget(code)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><IconTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creatingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setCreatingOpen(false)} />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-slate-900">{editingId ? 'Edit Discount Code' : 'Create Discount Code'}</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Code</label>
                <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className={`${INPUT_CLS} font-mono uppercase`} placeholder="e.g. DIWALI2026" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Discount Type</label>
                  <select value={form.discount_type} onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value as DiscountType }))} className={INPUT_CLS}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Value</label>
                  <input type="number" min={0} value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: Number(e.target.value) }))} className={INPUT_CLS} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Applicable Plan</label>
                <select
                  value={form.applicable_plan_id ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, applicable_plan_id: e.target.value || null }))}
                  className={INPUT_CLS}
                >
                  <option value="">All Plans</option>
                  {plans.map((p) => (<option key={p.id} value={p.id}>{p.plan_name}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Valid From</label>
                  <input type="date" value={form.valid_from} onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Valid To</label>
                  <input type="date" value={form.valid_to} onChange={(e) => setForm((f) => ({ ...f, valid_to: e.target.value }))} className={INPUT_CLS} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Max Uses</label>
                <input type="number" min={1} value={form.max_uses} onChange={(e) => setForm((f) => ({ ...f, max_uses: Number(e.target.value) }))} className={`${INPUT_CLS} max-w-[160px]`} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400" />
                Active
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <SecondaryButton onClick={() => setCreatingOpen(false)} disabled={saving}>Cancel</SecondaryButton>
              <PrimaryButton onClick={handleSave} disabled={saving || !form.code.trim() || !form.valid_from || !form.valid_to}>
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
            <h3 className="mb-1 text-lg font-bold text-slate-900">Delete Discount Code</h3>
            <p className="mb-5 text-sm text-slate-500">Delete "{deleteTarget.code}"? This cannot be undone.</p>
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

export default DiscountCodeManagement;
