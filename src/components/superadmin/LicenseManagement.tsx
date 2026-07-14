// src/components/superadmin/LicenseManagement.tsx
//
// Professional License & Subscription Management. There is no license or
// subscription table/service/repository anywhere in this app — this is a
// genuinely new domain with zero existing backend, confirmed before
// writing a single line here. Per instructions, that data is kept as
// clearly-labelled, session-local UI state (resets on reload — nothing
// fake is persisted).
//
// Everything that IS real is reused as-is:
//   companyService  (loadCompanies)        — the customer list itself
//   branchService    (getAll)               — real "Current Branches" usage
//   employeeService  (getAll)               — real "Active/Current Users" usage
//   courseService    (loadCourses)          — real "Current Courses" usage
//   session.getCurrentUser()                — stamps who performed each
//                                              license action, for the
//                                              (session-local) Audit trail
//
// No repository/service/database changes.

import { useEffect, useMemo, useState } from 'react';
import { loadCompanies } from '../../services/company/companyService';
import { branchService } from '../../services/branch/branchService';
import { employeeService } from '../../services/employee/employeeService';
import { loadCourses } from '../../services/course/courseService';
import { getCurrentUser } from '../../services/auth/session';

import type { Company } from '../../types/company';
import type { Branch } from '../../types/branch';
import type { Employee } from '../../types/employee';
import type { Course } from '../../types/course';

// ─────────────────────────────────────────────────────────────────────────────
// License domain — session-local only, no backend exists for this yet
// ─────────────────────────────────────────────────────────────────────────────

type PlanType = 'trial' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'lifetime';
type LicenseStatus = 'trial' | 'active' | 'grace_period' | 'suspended' | 'expired' | 'cancelled';
type PaymentStatus = 'paid' | 'pending' | 'overdue';

const PLAN_ORDER: PlanType[] = ['trial', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'lifetime'];

const PLAN_LABEL: Record<PlanType, string> = {
  trial: 'Trial',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Half Yearly',
  yearly: 'Yearly',
  lifetime: 'Lifetime',
};

interface FeatureToggles {
  courseBuilder:   boolean;
  contentEditor:   boolean;
  assessment:      boolean;
  assignment:      boolean;
  certificates:    boolean;
  learningPaths:   boolean;
  reports:         boolean;
  dashboard:       boolean;
  attendance:      boolean;
  notifications:   boolean;
  apiAccess:       boolean;
  whiteLabel:      boolean;
  mobileApp:       boolean;
}

const DEFAULT_FEATURES: FeatureToggles = {
  courseBuilder: true,
  contentEditor: true,
  assessment: true,
  assignment: true,
  certificates: false,
  learningPaths: false,
  reports: true,
  dashboard: true,
  attendance: false,
  notifications: true,
  apiAccess: false,
  whiteLabel: false,
  mobileApp: false,
};

const FEATURE_LABELS: { key: keyof FeatureToggles; label: string }[] = [
  { key: 'courseBuilder', label: 'Course Builder' },
  { key: 'contentEditor', label: 'Content Editor' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'assignment', label: 'Assignment' },
  { key: 'certificates', label: 'Certificates' },
  { key: 'learningPaths', label: 'Learning Paths' },
  { key: 'reports', label: 'Reports' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'apiAccess', label: 'API Access' },
  { key: 'whiteLabel', label: 'White Label' },
  { key: 'mobileApp', label: 'Mobile App' },
];

interface LicenseRecord {
  licenseCode:        string;
  licenseKey:          string;
  contactPerson:       string;
  email:               string;
  phone:               string;
  address:             string;
  plan:                PlanType;
  startDate:           string;
  expiryDate:          string;
  gracePeriodEnabled:  boolean;
  graceDays:           number;
  reminderBeforeDays:  number;
  reminderAfterDays:   number;
  maxUsers:            number;
  maxStorageGb:        number;
  maxBranches:         number;
  maxCourses:          number;
  maxEmployees:        number;
  features:            FeatureToggles;
  status:              LicenseStatus;
  subscriptionAmount:  number;
  paidTill:            string;
  lastPaymentDate:     string;
  nextDueDate:         string;
  invoiceNumber:       string;
  paymentStatus:       PaymentStatus;
  createdBy:           string;
  createdDate:         string;
  modifiedBy:          string;
  modifiedDate:        string;
}

function defaultLicenseRecord(actorName: string): LicenseRecord {
  const now = new Date().toISOString();
  return {
    licenseCode: '',
    licenseKey: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    plan: 'trial',
    startDate: '',
    expiryDate: '',
    gracePeriodEnabled: false,
    graceDays: 7,
    reminderBeforeDays: 7,
    reminderAfterDays: 3,
    maxUsers: 0,
    maxStorageGb: 0,
    maxBranches: 0,
    maxCourses: 0,
    maxEmployees: 0,
    features: { ...DEFAULT_FEATURES },
    status: 'trial',
    subscriptionAmount: 0,
    paidTill: '',
    lastPaymentDate: '',
    nextDueDate: '',
    invoiceNumber: '',
    paymentStatus: 'pending',
    createdBy: actorName,
    createdDate: now,
    modifiedBy: actorName,
    modifiedDate: now,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG only)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function PrimaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}

function SecondaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}

function DangerButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition ${on ? 'bg-indigo-600' : 'bg-slate-300'}`}>
      <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white transition ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      {children}
    </div>
  );
}

const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

const STATUS_STYLES: Record<LicenseStatus, string> = {
  trial:        'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  active:       'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  grace_period: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  suspended:    'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  expired:      'bg-red-50 text-red-700 ring-1 ring-red-200',
  cancelled:    'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
};

const STATUS_LABEL: Record<LicenseStatus, string> = {
  trial: 'Trial',
  active: 'Active',
  grace_period: 'Grace Period',
  suspended: 'Suspended',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

function StatusBadge({ status }: { status: LicenseStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>{STATUS_LABEL[status]}</span>;
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load customer data</p>
      <p className="mt-1">{message}</p>
      <SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

function LocalStateNotice() {
  return (
    <p className="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
      License &amp; subscription data isn't backed by a dedicated table yet — kept for this session only, and won't survive a page reload.
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main LicenseManagement
// ─────────────────────────────────────────────────────────────────────────────

function LicenseManagement() {
  const user = getCurrentUser();
  const actorName = user ? `${user.firstName} ${user.lastName}`.trim() : 'System';

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [licensesByCompany, setLicensesByCompany] = useState<Record<string, LicenseRecord>>({});

  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | PlanType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | LicenseStatus>('all');
  const [codeSearch, setCodeSearch] = useState('');

  const [activeCompanyId, setActiveCompanyId] = useState('');
  const [extendDays, setExtendDays] = useState(30);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([loadCompanies(), branchService.getAll(), employeeService.getAll(), loadCourses()])
      .then(([companyRows, branchRows, employeeRows, courseRows]) => {
        setCompanies(companyRows);
        setBranches(branchRows);
        setEmployees(employeeRows);
        setCourses(courseRows);
        setActiveCompanyId((prev) => prev || companyRows[0]?.id || '');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load customer data.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getLicense(companyId: string): LicenseRecord {
    return licensesByCompany[companyId] ?? defaultLicenseRecord(actorName);
  }

  function updateLicense(companyId: string, patch: Partial<LicenseRecord>) {
    setLicensesByCompany((prev) => {
      const current = prev[companyId] ?? defaultLicenseRecord(actorName);
      return {
        ...prev,
        [companyId]: { ...current, ...patch, modifiedBy: actorName, modifiedDate: new Date().toISOString() },
      };
    });
  }

  function toggleFeature(companyId: string, key: keyof FeatureToggles) {
    const current = getLicense(companyId);
    updateLicense(companyId, { features: { ...current.features, [key]: !current.features[key] } });
  }

  // ── Usage (real, derived from existing services) ────────────────────────────

  const usageByCompany = useMemo(() => {
    const map = new Map<string, { activeUsers: number; branches: number; courses: number }>();
    companies.forEach((c) => {
      map.set(c.id, {
        activeUsers: employees.filter((e) => e.company_id === c.id && e.active).length,
        branches: branches.filter((b) => b.company_id === c.id).length,
        courses: courses.filter((co) => co.company_id === c.id).length,
      });
    });
    return map;
  }, [companies, employees, branches, courses]);

  // ── License Actions ──────────────────────────────────────────────────────────

  function addDays(dateStr: string, days: number): string {
    const base = dateStr ? new Date(dateStr) : new Date();
    base.setDate(base.getDate() + days);
    return base.toISOString().slice(0, 10);
  }

  function planDurationDays(plan: PlanType): number {
    if (plan === 'monthly') return 30;
    if (plan === 'quarterly') return 90;
    if (plan === 'half_yearly') return 182;
    if (plan === 'yearly') return 365;
    if (plan === 'lifetime') return 36500;
    return 14; // trial
  }

  function handleActivate(companyId: string) {
    const lic = getLicense(companyId);
    const today = new Date().toISOString().slice(0, 10);
    updateLicense(companyId, {
      status: 'active',
      startDate: lic.startDate || today,
      expiryDate: lic.expiryDate || addDays(today, planDurationDays(lic.plan)),
    });
    showToast('License activated');
  }

  function handleSuspend(companyId: string) {
    updateLicense(companyId, { status: 'suspended' });
    showToast('License suspended');
  }

  function handleResume(companyId: string) {
    updateLicense(companyId, { status: 'active' });
    showToast('License resumed');
  }

  function handleRenew(companyId: string) {
    const lic = getLicense(companyId);
    const today = new Date().toISOString().slice(0, 10);
    updateLicense(companyId, {
      status: 'active',
      expiryDate: addDays(today, planDurationDays(lic.plan)),
      paidTill: addDays(today, planDurationDays(lic.plan)),
      lastPaymentDate: today,
      paymentStatus: 'paid',
    });
    showToast('License renewed');
  }

  function handleExtend(companyId: string) {
    const lic = getLicense(companyId);
    updateLicense(companyId, { expiryDate: addDays(lic.expiryDate, extendDays) });
    showToast(`Extended by ${extendDays} days`);
  }

  function handleUpgrade(companyId: string) {
    const lic = getLicense(companyId);
    const index = PLAN_ORDER.indexOf(lic.plan);
    if (index < PLAN_ORDER.length - 1) {
      updateLicense(companyId, { plan: PLAN_ORDER[index + 1] });
      showToast(`Upgraded to ${PLAN_LABEL[PLAN_ORDER[index + 1]]}`);
    }
  }

  function handleDowngrade(companyId: string) {
    const lic = getLicense(companyId);
    const index = PLAN_ORDER.indexOf(lic.plan);
    if (index > 0) {
      updateLicense(companyId, { plan: PLAN_ORDER[index - 1] });
      showToast(`Downgraded to ${PLAN_LABEL[PLAN_ORDER[index - 1]]}`);
    }
  }

  function handleCancel(companyId: string) {
    updateLicense(companyId, { status: 'cancelled' });
    showToast('License cancelled');
  }

  // ── Filtering ────────────────────────────────────────────────────────────────

  const searchTerm = search.trim().toLowerCase();
  const codeTerm = codeSearch.trim().toLowerCase();

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const lic = getLicense(c.id);
      if (searchTerm && !c.company_name.toLowerCase().includes(searchTerm)) return false;
      if (planFilter !== 'all' && lic.plan !== planFilter) return false;
      if (statusFilter !== 'all' && lic.status !== statusFilter) return false;
      if (codeTerm && !lic.licenseCode.toLowerCase().includes(codeTerm)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, licensesByCompany, searchTerm, planFilter, statusFilter, codeTerm]);

  const topSummary = useMemo(() => {
    let active = 0, trial = 0, expired = 0, grace = 0, suspended = 0;
    companies.forEach((c) => {
      const status = getLicense(c.id).status;
      if (status === 'active') active += 1;
      else if (status === 'trial') trial += 1;
      else if (status === 'expired') expired += 1;
      else if (status === 'grace_period') grace += 1;
      else if (status === 'suspended') suspended += 1;
    });
    return { total: companies.length, active, trial, expired, grace, suspended };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, licensesByCompany]);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? null;
  const activeLicense = activeCompanyId ? getLicense(activeCompanyId) : null;
  const activeUsage = activeCompanyId ? usageByCompany.get(activeCompanyId) : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">

      {/* TOP SUMMARY */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        <SummaryCard label="Total Customers" value={topSummary.total} accent="border-slate-200" />
        <SummaryCard label="Active Licenses" value={topSummary.active} accent="border-emerald-200" />
        <SummaryCard label="Trial" value={topSummary.trial} accent="border-blue-200" />
        <SummaryCard label="Expired" value={topSummary.expired} accent="border-red-200" />
        <SummaryCard label="Grace Period" value={topSummary.grace} accent="border-amber-200" />
        <SummaryCard label="Suspended" value={topSummary.suspended} accent="border-orange-200" />
      </div>

      {/* SEARCH */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company…" className="min-w-[180px] flex-1 rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
        <input value={codeSearch} onChange={(e) => setCodeSearch(e.target.value)} placeholder="License code…" className="min-w-[140px] rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as 'all' | PlanType)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Plans</option>
          {PLAN_ORDER.map((p) => (<option key={p} value={p}>{PLAN_LABEL[p]}</option>))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | LicenseStatus)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Statuses</option>
          {(Object.keys(STATUS_LABEL) as LicenseStatus[]).map((s) => (<option key={s} value={s}>{STATUS_LABEL[s]}</option>))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr]">

        {/* CUSTOMER LIST */}
        <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
          {filteredCompanies.length === 0 ? (
            <EmptyState message="No customers match these filters." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="pb-2 pr-3">Company</th>
                  <th className="pb-2 pr-3">License Code</th>
                  <th className="pb-2 pr-3">Plan</th>
                  <th className="pb-2 pr-3">Active Users</th>
                  <th className="pb-2 pr-3">Max Users</th>
                  <th className="pb-2 pr-3">Storage Used</th>
                  <th className="pb-2 pr-3">Expiry</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCompanies.map((c) => {
                  const lic = getLicense(c.id);
                  const usage = usageByCompany.get(c.id);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setActiveCompanyId(c.id)}
                      className={`cursor-pointer transition hover:bg-slate-50 ${activeCompanyId === c.id ? 'bg-indigo-50/60' : ''}`}
                    >
                      <td className="py-2.5 pr-3 font-medium text-slate-800">{c.company_name}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{lic.licenseCode || '—'}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{PLAN_LABEL[lic.plan]}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{usage?.activeUsers ?? 0}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{lic.maxUsers || '—'}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{lic.maxStorageGb > 0 ? `${lic.maxStorageGb} GB limit` : '—'}</td>
                      <td className="py-2.5 pr-3 text-slate-500">{lic.expiryDate || '—'}</td>
                      <td className="py-2.5"><StatusBadge status={lic.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* LICENSE DETAILS */}
        {!activeCompany || !activeLicense ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <EmptyState message="Select a customer above to view license details." />
          </div>
        ) : (
          <div className="space-y-6">

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-800">{activeCompany.company_name}</h3>
                <StatusBadge status={activeLicense.status} />
              </div>
              <LocalStateNotice />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Contact Person">
                  <input value={activeLicense.contactPerson} onChange={(e) => updateLicense(activeCompanyId, { contactPerson: e.target.value })} className={INPUT_CLS} />
                </Field>
                <Field label="Email">
                  <input value={activeLicense.email} onChange={(e) => updateLicense(activeCompanyId, { email: e.target.value })} className={INPUT_CLS} />
                </Field>
                <Field label="Phone">
                  <input value={activeLicense.phone} onChange={(e) => updateLicense(activeCompanyId, { phone: e.target.value })} className={INPUT_CLS} />
                </Field>
                <Field label="License Key">
                  <input value={activeLicense.licenseKey} onChange={(e) => updateLicense(activeCompanyId, { licenseKey: e.target.value })} className={INPUT_CLS} />
                </Field>
                <Field label="License Code">
                  <input value={activeLicense.licenseCode} onChange={(e) => updateLicense(activeCompanyId, { licenseCode: e.target.value })} className={INPUT_CLS} />
                </Field>
                <Field label="Subscription Plan">
                  <select value={activeLicense.plan} onChange={(e) => updateLicense(activeCompanyId, { plan: e.target.value as PlanType })} className={INPUT_CLS}>
                    {PLAN_ORDER.map((p) => (<option key={p} value={p}>{PLAN_LABEL[p]}</option>))}
                  </select>
                </Field>
                <Field label="Start Date">
                  <input type="date" value={activeLicense.startDate} onChange={(e) => updateLicense(activeCompanyId, { startDate: e.target.value })} className={INPUT_CLS} />
                </Field>
                <Field label="Expiry Date">
                  <input type="date" value={activeLicense.expiryDate} onChange={(e) => updateLicense(activeCompanyId, { expiryDate: e.target.value })} className={INPUT_CLS} />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Address">
                  <textarea value={activeLicense.address} onChange={(e) => updateLicense(activeCompanyId, { address: e.target.value })} rows={2} className={`${INPUT_CLS} resize-none`} />
                </Field>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
                <Field label="Max Users"><input type="number" min={0} value={activeLicense.maxUsers} onChange={(e) => updateLicense(activeCompanyId, { maxUsers: Number(e.target.value) })} className={INPUT_CLS} /></Field>
                <Field label="Max Storage (GB)"><input type="number" min={0} value={activeLicense.maxStorageGb} onChange={(e) => updateLicense(activeCompanyId, { maxStorageGb: Number(e.target.value) })} className={INPUT_CLS} /></Field>
                <Field label="Max Branches"><input type="number" min={0} value={activeLicense.maxBranches} onChange={(e) => updateLicense(activeCompanyId, { maxBranches: Number(e.target.value) })} className={INPUT_CLS} /></Field>
                <Field label="Max Courses"><input type="number" min={0} value={activeLicense.maxCourses} onChange={(e) => updateLicense(activeCompanyId, { maxCourses: Number(e.target.value) })} className={INPUT_CLS} /></Field>
                <Field label="Max Employees"><input type="number" min={0} value={activeLicense.maxEmployees} onChange={(e) => updateLicense(activeCompanyId, { maxEmployees: Number(e.target.value) })} className={INPUT_CLS} /></Field>
              </div>
            </div>

            {/* FEATURE TOGGLES */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Feature Toggles</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURE_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3">
                    <span className="text-sm font-medium text-slate-700">{label}</span>
                    <Toggle on={activeLicense.features[key]} onChange={() => toggleFeature(activeCompanyId, key)} />
                  </div>
                ))}
              </div>
            </div>

            {/* GRACE PERIOD */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Grace Period</h3>
              <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3">
                <span className="text-sm font-medium text-slate-700">Enable Grace Period</span>
                <Toggle on={activeLicense.gracePeriodEnabled} onChange={() => updateLicense(activeCompanyId, { gracePeriodEnabled: !activeLicense.gracePeriodEnabled })} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Grace Days"><input type="number" min={0} value={activeLicense.graceDays} onChange={(e) => updateLicense(activeCompanyId, { graceDays: Number(e.target.value) })} className={INPUT_CLS} /></Field>
                <Field label="Reminder Before Expiry (days)"><input type="number" min={0} value={activeLicense.reminderBeforeDays} onChange={(e) => updateLicense(activeCompanyId, { reminderBeforeDays: Number(e.target.value) })} className={INPUT_CLS} /></Field>
                <Field label="Reminder After Expiry (days)"><input type="number" min={0} value={activeLicense.reminderAfterDays} onChange={(e) => updateLicense(activeCompanyId, { reminderAfterDays: Number(e.target.value) })} className={INPUT_CLS} /></Field>
              </div>
            </div>

            {/* LICENSE ACTIONS */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">License Actions</h3>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton onClick={() => handleActivate(activeCompanyId)}>Activate</PrimaryButton>
                <SecondaryButton onClick={() => handleSuspend(activeCompanyId)}>Suspend</SecondaryButton>
                <SecondaryButton onClick={() => handleResume(activeCompanyId)}>Resume</SecondaryButton>
                <SecondaryButton onClick={() => handleRenew(activeCompanyId)}>Renew</SecondaryButton>
                <SecondaryButton onClick={() => handleUpgrade(activeCompanyId)}>Upgrade</SecondaryButton>
                <SecondaryButton onClick={() => handleDowngrade(activeCompanyId)}>Downgrade</SecondaryButton>
                <DangerButton onClick={() => handleCancel(activeCompanyId)}>Cancel</DangerButton>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input type="number" min={1} value={extendDays} onChange={(e) => setExtendDays(Number(e.target.value))} className="w-24 rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
                <SecondaryButton onClick={() => handleExtend(activeCompanyId)}>Extend (days)</SecondaryButton>
              </div>
            </div>

            {/* PAYMENT */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Payment</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Subscription Amount"><input type="number" min={0} value={activeLicense.subscriptionAmount} onChange={(e) => updateLicense(activeCompanyId, { subscriptionAmount: Number(e.target.value) })} className={INPUT_CLS} /></Field>
                <Field label="Paid Till"><input type="date" value={activeLicense.paidTill} onChange={(e) => updateLicense(activeCompanyId, { paidTill: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Last Payment"><input type="date" value={activeLicense.lastPaymentDate} onChange={(e) => updateLicense(activeCompanyId, { lastPaymentDate: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Next Due"><input type="date" value={activeLicense.nextDueDate} onChange={(e) => updateLicense(activeCompanyId, { nextDueDate: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Invoice Number"><input value={activeLicense.invoiceNumber} onChange={(e) => updateLicense(activeCompanyId, { invoiceNumber: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Payment Status">
                  <select value={activeLicense.paymentStatus} onChange={(e) => updateLicense(activeCompanyId, { paymentStatus: e.target.value as PaymentStatus })} className={INPUT_CLS}>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* USAGE */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">Usage</h3>
              <p className="mb-4 text-xs text-slate-400">Current Users / Courses / Branches are real, live counts. Companies and Storage have no equivalent tracked metric yet.</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <SummaryCard label="Current Users" value={activeUsage?.activeUsers ?? 0} accent="border-slate-200" />
                <SummaryCard label="Current Courses" value={activeUsage?.courses ?? 0} accent="border-slate-200" />
                <SummaryCard label="Current Branches" value={activeUsage?.branches ?? 0} accent="border-slate-200" />
                <SummaryCard label="Current Storage" value={0} accent="border-slate-200" />
                <SummaryCard label="Current Companies" value={1} accent="border-slate-200" />
              </div>
            </div>

            {/* AUDIT */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Audit</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Created By"><p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{activeLicense.createdBy || '—'}</p></Field>
                <Field label="Created Date"><p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{new Date(activeLicense.createdDate).toLocaleString()}</p></Field>
                <Field label="Modified By"><p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{activeLicense.modifiedBy || '—'}</p></Field>
                <Field label="Modified Date"><p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{new Date(activeLicense.modifiedDate).toLocaleString()}</p></Field>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default LicenseManagement;