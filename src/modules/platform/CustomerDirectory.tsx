// src/modules/platform/CustomerDirectory.tsx
//
// The platform owner's live register of every customer company: how to sign in,
// who the administrators are, licence / plan / expiry, usage against the plan,
// last activity, money received and private follow-up notes. It reads straight
// from the live tables, so a company added tomorrow shows up by itself.
//
// Passwords are never stored, so they cannot be shown; for a company
// administrator the owner can set a fresh temporary password (shown once).

import { useCallback, useEffect, useMemo, useState } from 'react';

import SectionHeroBanner from '../../components/learning/SectionHeroBanner';
import { csvEscape, downloadCsvFile } from '../../services/quiz/quizCsvService';
import { employeeService } from '../../services/employee/employeeService';
import { generateTemporaryPassword } from '../../utils/passwordGenerator';
import {
  addPayment, deletePayment, getCompanyDirectory, listPayments, saveCompanyNote,
} from '../../repositories/platform/customerDirectoryRepository';
import type {
  DirectoryAdmin, DirectoryRow, PlatformPayment,
} from '../../repositories/platform/customerDirectoryRepository';

// ── helpers ─────────────────────────────────────────────────────────────────

type StatusKey = 'active' | 'expiring' | 'grace' | 'expired' | 'suspended' | 'complimentary' | 'no_licence' | 'offboarded';
type StatusFilter = 'all' | StatusKey;
type SortKey = 'name' | 'expiry' | 'employees' | 'lastLogin' | 'created' | 'paid';

const EXPIRING_DAYS = 30;

const STATUS_META: Record<StatusKey, { label: string; cls: string }> = {
  active:        { label: 'Active',        cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  expiring:      { label: 'Expiring soon', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  grace:         { label: 'In grace',      cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
  expired:       { label: 'Expired',       cls: 'bg-red-50 text-red-700 ring-red-200' },
  suspended:     { label: 'Suspended',     cls: 'bg-rose-50 text-rose-800 ring-rose-200' },
  complimentary: { label: 'Complimentary', cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
  no_licence:    { label: 'No licence',    cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  offboarded:    { label: 'Offboarded',    cls: 'bg-slate-200 text-slate-600 ring-slate-300' },
};

function statusOf(r: DirectoryRow): StatusKey {
  if (!r.company_active && r.offboarded_at) return 'offboarded';
  if (r.effective_status === 'active' && r.days_left !== null && r.days_left <= EXPIRING_DAYS) return 'expiring';
  return r.effective_status;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function ago(iso: string | null): string {
  if (!iso) return 'Never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

function expiryText(r: DirectoryRow): string {
  if (r.days_left === null) return '—';
  if (r.days_left > 0) return `in ${r.days_left} day${r.days_left === 1 ? '' : 's'}`;
  if (r.days_left === 0) return 'today';
  return `${-r.days_left} day${r.days_left === -1 ? '' : 's'} ago`;
}

const loginLink = (code: string) => `${window.location.origin}/${encodeURIComponent(code)}`;

function copy(text: string) {
  void navigator.clipboard.writeText(text);
}

function Pill({ s }: { s: StatusKey }) {
  const m = STATUS_META[s];
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${m.cls}`}>{m.label}</span>;
}

function Meter({ used, max }: { used: number; max: number | null }) {
  if (max === null) return <span className="text-sm text-slate-700">{used}</span>;
  const pct = Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  const tone = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="min-w-[88px]">
      <p className="text-xs font-medium text-slate-700">{used} / {max}</p>
      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200"><div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

const INPUT_CLS = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400';

// ── screen ──────────────────────────────────────────────────────────────────

export default function CustomerDirectory() {
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('expiry');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await getCompanyDirectory());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the customer directory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Your own platform workspace is not a customer.
  const customers = useMemo(() => rows.filter((r) => !r.is_platform_operator), [rows]);

  const plans = useMemo(
    () => Array.from(new Set(customers.map((r) => r.plan_name).filter((p): p is string => !!p))).sort(),
    [customers],
  );

  const kpis = useMemo(() => {
    const live = customers.filter((r) => r.company_active);
    const count = (k: StatusKey) => customers.filter((r) => statusOf(r) === k).length;
    return {
      total: live.length,
      active: count('active') + count('complimentary'),
      expiring: count('expiring'),
      grace: count('grace'),
      lapsed: count('expired') + count('suspended'),
      employees: live.reduce((s, r) => s + r.employees_active, 0),
      collected: customers.reduce((s, r) => s + r.paid_total, 0),
      followUps: customers.filter((r) => r.follow_up_date && new Date(r.follow_up_date) <= new Date(Date.now() + 7 * 86400000)).length,
    };
  }, [customers]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = customers.filter((r) => {
      if (statusFilter !== 'all' && statusOf(r) !== statusFilter) return false;
      if (planFilter !== 'all' && r.plan_name !== planFilter) return false;
      if (!q) return true;
      const hay = [
        r.company_name, r.company_code, r.short_name, r.company_email, r.company_phone, r.city, r.licence_no, r.plan_name,
        ...r.admins.flatMap((a) => [a.employee_code, a.name, a.email, a.mobile]),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
    const farFuture = Number.MAX_SAFE_INTEGER;
    const by: Record<SortKey, (a: DirectoryRow, b: DirectoryRow) => number> = {
      name: (a, b) => a.company_name.localeCompare(b.company_name),
      expiry: (a, b) => (a.days_left ?? farFuture) - (b.days_left ?? farFuture),
      employees: (a, b) => b.employees_active - a.employees_active,
      lastLogin: (a, b) => (b.last_login ? Date.parse(b.last_login) : 0) - (a.last_login ? Date.parse(a.last_login) : 0),
      created: (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
      paid: (a, b) => b.paid_total - a.paid_total,
    };
    return filtered.slice().sort(by[sortKey]);
  }, [customers, search, statusFilter, planFilter, sortKey]);

  function exportCsv() {
    const head = [
      'Company Code', 'Company', 'Company Email', 'Phone', 'City', 'Admin IDs', 'Admin Emails',
      'Licence No', 'Plan', 'Billing', 'Status', 'Start', 'Expiry', 'Days Left',
      'Active Employees', 'Employee Limit', 'Courses', 'Course Limit', 'Storage MB',
      'Last Login', 'Paid Total (INR)', 'Last Manual Payment', 'Follow-up', 'Note',
    ];
    const lines = visible.map((r) => [
      r.company_code, r.company_name, r.company_email ?? '', r.company_phone ?? '', r.city ?? '',
      r.admins.map((a) => a.employee_code).join(' | '), r.admins.map((a) => a.email ?? '').filter(Boolean).join(' | '),
      r.licence_no ?? '', r.plan_name ?? '', r.billing_cycle ?? '', STATUS_META[statusOf(r)].label,
      r.start_date ?? '', r.end_date ?? '', r.days_left === null ? '' : String(r.days_left),
      String(r.employees_active), r.max_employees === null ? '' : String(r.max_employees),
      String(r.courses), r.max_courses === null ? '' : String(r.max_courses), String(r.storage_mb),
      r.last_login ?? '', String(r.paid_total), r.last_payment_on ?? '', r.follow_up_date ?? '', r.note ?? '',
    ]);
    downloadCsvFile(
      `customer-directory-${new Date().toISOString().slice(0, 10)}.csv`,
      [head, ...lines].map((row) => row.map(csvEscape).join(',')).join('\r\n'),
    );
  }

  const open = rows.find((r) => r.company_id === openId) ?? null;

  return (
    <div className="space-y-6">
      <SectionHeroBanner
        eyebrow="Platform owner"
        title="Customer Directory"
        subtitle="Every company on your platform — sign-in details, licence, expiry, usage and payments in one place."
        statLabel="Customers"
        statValue={kpis.total}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {[
          { label: 'Active', value: kpis.active, tone: 'text-emerald-700', filter: 'active' as StatusFilter },
          { label: 'Expiring ≤30d', value: kpis.expiring, tone: 'text-amber-700', filter: 'expiring' as StatusFilter },
          { label: 'In grace', value: kpis.grace, tone: 'text-orange-700', filter: 'grace' as StatusFilter },
          { label: 'Expired / suspended', value: kpis.lapsed, tone: 'text-red-700', filter: 'expired' as StatusFilter },
          { label: 'Active employees', value: kpis.employees, tone: 'text-slate-800', filter: null },
          { label: 'Collected', value: inr(kpis.collected), tone: 'text-slate-800', filter: null },
          { label: 'Follow-ups ≤7d', value: kpis.followUps, tone: 'text-indigo-700', filter: null },
        ].map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => k.filter && setStatusFilter(k.filter)}
            className={`rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 ${k.filter ? 'transition hover:ring-slate-400' : 'cursor-default'}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k.label}</p>
            <p className={`mt-1 text-2xl font-bold ${k.tone}`}>{k.value}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search company, code, admin, email, phone, licence no…"
          className={`${INPUT_CLS} min-w-[220px] flex-1`}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={INPUT_CLS}>
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_META) as StatusKey[]).map((k) => <option key={k} value={k}>{STATUS_META[k].label}</option>)}
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className={INPUT_CLS}>
          <option value="all">All plans</option>
          {plans.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={INPUT_CLS}>
          <option value="expiry">Sort: expiry (soonest)</option>
          <option value="name">Sort: name</option>
          <option value="employees">Sort: most employees</option>
          <option value="lastLogin">Sort: last login</option>
          <option value="paid">Sort: most paid</option>
          <option value="created">Sort: newest</option>
        </select>
        <button type="button" onClick={() => void load()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Refresh</button>
        <button type="button" onClick={exportCsv} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">Export CSV</button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 font-semibold">Sign-in</th>
              <th className="px-4 py-3 font-semibold">Plan &amp; licence</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Expires</th>
              <th className="px-4 py-3 font-semibold">Employees</th>
              <th className="px-4 py-3 font-semibold">Last login</th>
              <th className="px-4 py-3 text-right font-semibold">Paid</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Loading…</td></tr>}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">{customers.length === 0 ? 'No customer companies yet.' : 'No company matches these filters.'}</td></tr>
            )}
            {visible.map((r) => {
              const st = statusOf(r);
              const admin = r.admins[0];
              return (
                <tr key={r.company_id} onClick={() => setOpenId(r.company_id)} className="cursor-pointer border-b border-slate-100 align-top transition hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{r.company_name}</p>
                    <p className="text-xs text-slate-500">{[r.city, r.state].filter(Boolean).join(', ') || '—'}</p>
                    {r.follow_up_date && <p className="mt-1 text-[11px] font-medium text-indigo-600">Follow up {fmtDate(r.follow_up_date)}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold text-slate-800">{r.company_code}</p>
                    <p className="text-xs text-slate-600">{admin ? `ID ${admin.employee_code}` : 'No admin'}{r.admins.length > 1 ? ` +${r.admins.length - 1}` : ''}</p>
                    <p className="max-w-[190px] truncate text-xs text-slate-500">{admin?.email || r.company_email || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{r.plan_name ?? '—'}</p>
                    <p className="font-mono text-[11px] text-slate-500">{r.licence_no ?? '—'}</p>
                    {r.billing_cycle && <p className="text-[11px] text-slate-400 capitalize">{r.billing_cycle.replace('_', '-')}</p>}
                  </td>
                  <td className="px-4 py-3"><Pill s={st} /></td>
                  <td className="px-4 py-3">
                    <p className="text-slate-800">{fmtDate(r.end_date)}</p>
                    <p className={`text-xs ${r.days_left !== null && r.days_left <= EXPIRING_DAYS && !r.is_complimentary ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>{r.is_complimentary ? 'complimentary' : expiryText(r)}</p>
                  </td>
                  <td className="px-4 py-3"><Meter used={r.employees_active} max={r.max_employees} /></td>
                  <td className="px-4 py-3 text-slate-600">{ago(r.last_login)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{r.paid_total > 0 ? inr(r.paid_total) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Showing {visible.length} of {customers.length} companies. Click a row for sign-in details, payments and notes.</p>

      {open && <DetailDrawer row={open} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
    </div>
  );
}

// ── detail drawer ───────────────────────────────────────────────────────────

function Field({ label, value, mono, onCopy }: { label: string; value: string; mono?: boolean; onCopy?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="flex items-center gap-2 text-right text-sm text-slate-800">
        <span className={`break-all ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</span>
        {onCopy && value && <button type="button" onClick={() => copy(value)} className="text-[11px] font-semibold text-indigo-600 hover:underline">Copy</button>}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function DetailDrawer({ row, onClose, onChanged }: { row: DirectoryRow; onClose: () => void; onChanged: () => void }) {
  const [note, setNote] = useState(row.note ?? '');
  const [followUp, setFollowUp] = useState(row.follow_up_date ?? '');
  const [noteMsg, setNoteMsg] = useState('');
  const [payments, setPayments] = useState<PlatformPayment[]>([]);
  const [payForm, setPayForm] = useState({ paid_on: new Date().toISOString().slice(0, 10), amount: '', method: 'upi', reference: '', note: '' });
  const [payMsg, setPayMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ code: string; password: string } | null>(null);
  const [pwMsg, setPwMsg] = useState('');

  const st = statusOf(row);

  const loadPayments = useCallback(async () => {
    try { setPayments(await listPayments(row.company_id)); } catch { setPayments([]); }
  }, [row.company_id]);
  useEffect(() => { void loadPayments(); }, [loadPayments]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function saveNote() {
    setBusy(true);
    setNoteMsg('');
    try {
      await saveCompanyNote(row.company_id, note, followUp || null);
      setNoteMsg('Saved.');
      onChanged();
    } catch (e) {
      setNoteMsg(e instanceof Error ? e.message : 'Could not save.');
    } finally { setBusy(false); }
  }

  async function submitPayment() {
    const amount = Number(payForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setPayMsg('Enter the amount received.'); return; }
    setBusy(true);
    setPayMsg('');
    try {
      await addPayment({
        company_id: row.company_id, paid_on: payForm.paid_on, amount,
        method: payForm.method as PlatformPayment['method'], reference: payForm.reference, note: payForm.note,
      });
      setPayForm((f) => ({ ...f, amount: '', reference: '', note: '' }));
      await loadPayments();
      onChanged();
    } catch (e) {
      setPayMsg(e instanceof Error ? e.message : 'Could not record the payment.');
    } finally { setBusy(false); }
  }

  async function removePayment(id: string) {
    if (!confirm('Remove this payment record?')) return;
    setBusy(true);
    try { await deletePayment(id); await loadPayments(); onChanged(); } finally { setBusy(false); }
  }

  async function newPassword(a: DirectoryAdmin) {
    if (!a.auth_user_id) return;
    if (!confirm(`Set a new temporary password for ${a.name || a.employee_code}? Their current password stops working immediately.`)) return;
    setBusy(true);
    setPwMsg('');
    setIssued(null);
    try {
      const pw = generateTemporaryPassword();
      await employeeService.resetPassword(a.auth_user_id, pw);
      setIssued({ code: a.employee_code, password: pw });
    } catch (e) {
      setPwMsg(e instanceof Error ? e.message : 'Could not set the password.');
    } finally { setBusy(false); }
  }

  const sheet = [
    `Company: ${row.company_name}`,
    `Website: ${window.location.origin}`,
    `Company Code: ${row.company_code}`,
    ...row.admins.map((a) => `Admin ID: ${a.employee_code}${a.email ? ` (${a.email})` : ''}`),
    `Direct link: ${loginLink(row.company_code)}`,
  ].join('\n');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{row.company_name}</h2>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500"><span className="font-mono">{row.company_code}</span><Pill s={st} /></p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">✕</button>
        </div>

        <div className="space-y-4 p-5">
          <Section title="Sign-in details">
            <Field label="Website" value={window.location.origin} onCopy />
            <Field label="Company code" value={row.company_code} mono onCopy />
            <Field label="Direct login link" value={loginLink(row.company_code)} mono onCopy />
            {row.admins.length === 0 && <p className="py-1 text-sm text-slate-500">No administrator account found for this company.</p>}
            {row.admins.map((a) => (
              <div key={a.employee_code} className="mt-2 rounded-xl bg-slate-50 p-3">
                <Field label="Admin ID" value={a.employee_code} mono onCopy />
                <Field label="Name" value={a.name} />
                <Field label="Email" value={a.email ?? ''} onCopy />
                <Field label="Mobile" value={a.mobile ?? ''} onCopy />
                <Field label="Last login" value={ago(a.last_login)} />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {a.has_login ? (
                    <button type="button" disabled={busy} onClick={() => void newPassword(a)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50">
                      Set new temporary password
                    </button>
                  ) : <span className="text-xs text-amber-700">No login created yet</span>}
                  {a.email && <a href={`mailto:${a.email}`} className="text-xs font-semibold text-indigo-600 hover:underline">Email admin</a>}
                </div>
              </div>
            ))}
            {issued && (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">New password for {issued.code} — shown once, copy it now</p>
                <p className="mt-1 flex items-center gap-3">
                  <span className="font-mono text-base font-bold text-slate-900">{issued.password}</span>
                  <button type="button" onClick={() => copy(issued.password)} className="text-xs font-semibold text-indigo-600 hover:underline">Copy</button>
                </p>
              </div>
            )}
            {pwMsg && <p className="mt-2 text-xs text-red-600">{pwMsg}</p>}
            <p className="mt-3 text-[11px] text-slate-400">Passwords are never stored anywhere, so existing ones can't be shown. Setting a new one replaces it.</p>
            <button type="button" onClick={() => copy(sheet)} className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">Copy sign-in sheet (without password)</button>
          </Section>

          <Section title="Licence">
            <Field label="Licence no." value={row.licence_no ?? ''} mono onCopy />
            <Field label="Plan" value={row.plan_name ?? ''} />
            <Field label="Billing" value={row.billing_cycle ? row.billing_cycle.replace('_', '-') : ''} />
            <Field label="Plan price" value={row.plan_price !== null ? inr(row.plan_price) : ''} />
            <Field label="Starts" value={fmtDate(row.start_date)} />
            <Field label="Expires" value={`${fmtDate(row.end_date)}${row.days_left !== null && !row.is_complimentary ? ` (${expiryText(row)})` : ''}`} />
            <Field label="Grace period" value={row.grace_period_days !== null ? `${row.grace_period_days} days` : ''} />
            {row.is_complimentary && <p className="mt-1 text-xs text-violet-700">Complimentary licence — no payment due.</p>}
            {row.failed_reminders > 0 && <p className="mt-1 text-xs text-red-600">{row.failed_reminders} licence reminder email(s) failed to send.</p>}
            {!row.licence_id && <p className="text-sm text-slate-500">This company has no licence yet. Create one in Company Licenses.</p>}
          </Section>

          <Section title="Usage">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="mb-1 text-xs text-slate-500">Active employees</p><Meter used={row.employees_active} max={row.max_employees} /></div>
              <div><p className="mb-1 text-xs text-slate-500">Courses</p><Meter used={row.courses} max={row.max_courses} /></div>
              <div><p className="mb-1 text-xs text-slate-500">Certificates this month</p><Meter used={row.certificates_this_month} max={row.max_certificates} /></div>
              <div><p className="mb-1 text-xs text-slate-500">Storage used</p><p className="text-sm text-slate-800">{row.storage_mb} MB</p></div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Last login in this company: {ago(row.last_login)} · {row.employees_total} employee records in total</p>
          </Section>

          <Section title="Company details">
            <Field label="Email" value={row.company_email ?? ''} onCopy />
            <Field label="Phone" value={row.company_phone ?? ''} onCopy />
            <Field label="Location" value={[row.city, row.state].filter(Boolean).join(', ')} />
            <Field label="Customer since" value={fmtDate(row.created_at)} />
            {row.offboarded_at && <Field label="Offboarded" value={fmtDate(row.offboarded_at)} />}
            {row.company_email && <a href={`mailto:${row.company_email}`} className="mt-1 inline-block text-xs font-semibold text-indigo-600 hover:underline">Email company</a>}
          </Section>

          <Section title={`Payments — ${inr(row.paid_total)} received`}>
            {payments.length === 0 && <p className="text-sm text-slate-500">No manual payments recorded. Online (Razorpay) payments are added automatically.</p>}
            {payments.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{inr(p.amount)} <span className="text-xs font-normal uppercase text-slate-500">· {p.method}</span></p>
                  <p className="text-xs text-slate-500">{fmtDate(p.paid_on)}{p.reference ? ` · Ref ${p.reference}` : ''}{p.note ? ` · ${p.note}` : ''}</p>
                </div>
                <button type="button" onClick={() => void removePayment(p.id)} disabled={busy} className="text-xs text-red-500 hover:underline disabled:opacity-50">Remove</button>
              </div>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3">
              <input type="date" value={payForm.paid_on} onChange={(e) => setPayForm((f) => ({ ...f, paid_on: e.target.value }))} className={INPUT_CLS} />
              <input type="number" min="0" placeholder="Amount ₹" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} className={INPUT_CLS} />
              <select value={payForm.method} onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))} className={INPUT_CLS}>
                <option value="upi">UPI</option><option value="bank">Bank transfer</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="other">Other</option>
              </select>
              <input placeholder="Reference / UTR" value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))} className={INPUT_CLS} />
              <input placeholder="Note (optional)" value={payForm.note} onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))} className={`${INPUT_CLS} col-span-2`} />
              <button type="button" onClick={() => void submitPayment()} disabled={busy} className="col-span-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Record payment</button>
            </div>
            {payMsg && <p className="mt-2 text-xs text-red-600">{payMsg}</p>}
          </Section>

          <Section title="Private notes & follow-up">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Only you can see this — renewal talks, promises, special terms…" className={`${INPUT_CLS} w-full`} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-500">Follow up on</label>
              <input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className={INPUT_CLS} />
              <button type="button" onClick={() => void saveNote()} disabled={busy} className="ml-auto rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">Save</button>
            </div>
            {noteMsg && <p className="mt-2 text-xs text-slate-600">{noteMsg}</p>}
          </Section>
        </div>
      </aside>
    </div>
  );
}
