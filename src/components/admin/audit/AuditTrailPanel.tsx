// src/components/admin/audit/AuditTrailPanel.tsx
//
// The tamper-proof record of sensitive changes (licence, role and company
// changes, employee sign-in state, payments, discount codes). Unlike the
// activity feed below it, these rows are written by the database itself and
// can't be edited or deleted. Company administrators see their own company's
// history; the platform operator sees everything.

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../../../lib/supabase';

interface AuditEvent {
  id: number;
  at: string;
  actor_label: string | null;
  company_id: string | null;
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  row_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

const TABLE_LABELS: Record<string, string> = {
  companies: 'Company settings',
  company_licenses: 'Licence',
  employee_roles: 'Role assignment',
  employees: 'Employee access',
  discount_codes: 'Discount code',
  razorpay_payments: 'Online payment',
};

const ACTION_LABELS: Record<string, string> = { INSERT: 'Added', UPDATE: 'Changed', DELETE: 'Removed' };

/** Lists only the fields that actually differ, so a row reads as "status: active → suspended". */
function describeChange(e: AuditEvent): string {
  const skip = new Set(['updated_at', 'created_at']);
  if (e.action === 'UPDATE' && e.old_data && e.new_data) {
    const parts: string[] = [];
    for (const key of Object.keys(e.new_data)) {
      if (skip.has(key)) continue;
      if (JSON.stringify(e.old_data[key]) !== JSON.stringify(e.new_data[key])) {
        parts.push(`${key}: ${String(e.old_data[key] ?? '—')} → ${String(e.new_data[key] ?? '—')}`);
      }
    }
    return parts.join(', ') || '—';
  }
  const row = e.new_data ?? e.old_data ?? {};
  const keys = ['company_name', 'company_code', 'employee_code', 'status', 'end_date', 'code', 'role_id', 'active'];
  const parts = keys.filter((k) => row[k] !== undefined && row[k] !== null).map((k) => `${k}: ${String(row[k])}`);
  return parts.join(', ') || '—';
}

export default function AuditTrailPanel() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('audit_events')
      .select('id, at, actor_label, company_id, table_name, action, row_id, old_data, new_data')
      .order('at', { ascending: false })
      .limit(200);
    if (err) setError(err.message);
    else setEvents((data as AuditEvent[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { if (open) void load(); }, [open, load]);

  return (
    <div className="rounded-2xl bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left"
      >
        <span>
          <span className="block text-sm font-bold text-slate-800">Security &amp; billing history</span>
          <span className="block text-xs text-slate-500">Licence, role, company and sign-in changes — written by the system, cannot be edited</span>
        </span>
        <span className="text-xs font-semibold text-indigo-600">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-3">
          {loading && <p className="text-sm text-slate-500">Loading…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!loading && !error && events.length === 0 && <p className="text-sm text-slate-500">Nothing recorded yet.</p>}
          {events.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-semibold">When</th>
                    <th className="py-2 pr-3 font-semibold">Who</th>
                    <th className="py-2 pr-3 font-semibold">What</th>
                    <th className="py-2 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 align-top last:border-0">
                      <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{new Date(e.at).toLocaleString()}</td>
                      <td className="py-2 pr-3 font-medium text-slate-800">{e.actor_label ?? '—'}</td>
                      <td className="py-2 pr-3 text-slate-700">{ACTION_LABELS[e.action]} · {TABLE_LABELS[e.table_name] ?? e.table_name}</td>
                      <td className="max-w-md break-words py-2 text-slate-600">{describeChange(e)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
