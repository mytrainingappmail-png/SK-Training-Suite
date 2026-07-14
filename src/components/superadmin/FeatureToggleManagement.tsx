// src/components/superadmin/FeatureToggleManagement.tsx
//
// Professional Feature Toggle Management. Reuses only existing,
// unmodified architecture:
//   companyService (loadCompanies / saveCompany) — the company list, and
//                   the storage location for this module's configuration.
//
// There is no feature-toggle table/service/repository anywhere in this
// app. Per instructions, configuration is stored using the existing,
// real `companies.theme` text column — the same column
// BrandingManagement.tsx already uses for its own JSON config. To avoid
// colliding with that (or any other) data already saved there, this file
// never overwrites `theme` wholesale: it parses whatever JSON object is
// already present, merges its own state in under a single dedicated
// `featureToggles` key, and writes the merged object back — every other
// key already in `theme` (including BrandingManagement's fields) is
// preserved untouched.
//
// No repository/service/database changes.

import { useEffect, useMemo, useState } from 'react';
import { loadCompanies, saveCompany } from '../../services/company/companyService';
import type { Company } from '../../types/company';

// ─────────────────────────────────────────────────────────────────────────────
// Feature catalogue — static app configuration, not user data
// ─────────────────────────────────────────────────────────────────────────────

type Tier = 'starter' | 'professional' | 'enterprise';
type PresetName = Tier | 'custom';

interface FeatureMeta {
  key:          string;
  label:        string;
  description:  string;
  tier:         Tier;
  dependsOn:    string[];
  affects:      string[];
}

interface FeatureGroup {
  name:     string;
  features: FeatureMeta[];
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    name: 'Learning',
    features: [
      { key: 'courseBuilder',  label: 'Course Builder',  description: 'Author courses, modules and pages.', tier: 'starter', dependsOn: [], affects: ['Course Authoring'] },
      { key: 'contentEditor',  label: 'Content Editor',  description: 'Rich text authoring for lesson pages.', tier: 'starter', dependsOn: ['courseBuilder'], affects: ['Course Authoring'] },
      { key: 'coursePlayer',   label: 'Course Player',   description: 'Learner-facing course playback experience.', tier: 'starter', dependsOn: ['courseBuilder'], affects: ['Learner Portal'] },
      { key: 'learningPaths',  label: 'Learning Paths',  description: 'Sequence multiple courses into guided paths.', tier: 'professional', dependsOn: ['courseBuilder'], affects: ['Course Authoring', 'Learner Portal'] },
      { key: 'assessment',     label: 'Assessment',      description: 'Quizzes and graded evaluations.', tier: 'starter', dependsOn: [], affects: ['Learner Portal'] },
      { key: 'assignments',    label: 'Assignments',     description: 'Submission-based coursework.', tier: 'professional', dependsOn: [], affects: ['Learner Portal'] },
      { key: 'certificates',   label: 'Certificates',    description: 'Auto-generate completion certificates.', tier: 'professional', dependsOn: ['assessment'], affects: ['Learner Portal'] },
      { key: 'results',        label: 'Results',         description: 'Score history and results centre.', tier: 'professional', dependsOn: ['assessment'], affects: ['Learner Portal'] },
    ],
  },
  {
    name: 'Training',
    features: [
      { key: 'trainerDashboard', label: 'Trainer Dashboard', description: 'Overview for trainers managing learners.', tier: 'professional', dependsOn: [], affects: ['Trainer Portal'] },
      { key: 'reports',          label: 'Reports',           description: 'Exportable training reports.', tier: 'professional', dependsOn: [], affects: ['Trainer Portal'] },
      { key: 'analytics',        label: 'Analytics',         description: 'Engagement and completion analytics.', tier: 'enterprise', dependsOn: ['reports'], affects: ['Trainer Portal'] },
      { key: 'attendance',       label: 'Attendance',        description: 'Session attendance tracking.', tier: 'professional', dependsOn: [], affects: ['Trainer Portal'] },
      { key: 'leaderboard',      label: 'Leaderboard',       description: 'Rank learners by performance.', tier: 'enterprise', dependsOn: ['analytics'], affects: ['Learner Portal'] },
      { key: 'gamification',    label: 'Gamification',      description: 'Badges and points for engagement.', tier: 'enterprise', dependsOn: ['leaderboard'], affects: ['Learner Portal'] },
    ],
  },
  {
    name: 'Administration',
    features: [
      { key: 'companies',   label: 'Companies',   description: 'Manage company records.', tier: 'starter', dependsOn: [], affects: ['Admin'] },
      { key: 'branches',    label: 'Branches',    description: 'Manage branch locations.', tier: 'starter', dependsOn: ['companies'], affects: ['Admin'] },
      { key: 'departments', label: 'Departments', description: 'Manage departments.', tier: 'starter', dependsOn: ['companies'], affects: ['Admin'] },
      { key: 'employees',   label: 'Employees',   description: 'Manage employee records.', tier: 'starter', dependsOn: ['companies'], affects: ['Admin'] },
      { key: 'roles',       label: 'Roles',       description: 'Define organisational roles.', tier: 'professional', dependsOn: ['employees'], affects: ['Admin'] },
      { key: 'permissions', label: 'Permissions', description: 'Fine-grained access control.', tier: 'enterprise', dependsOn: ['roles'], affects: ['Admin'] },
    ],
  },
  {
    name: 'Communication',
    features: [
      { key: 'notifications',    label: 'Notifications',    description: 'In-app notification center.', tier: 'starter', dependsOn: [], affects: ['Admin', 'Learner Portal'] },
      { key: 'email',            label: 'Email',             description: 'Transactional and reminder emails.', tier: 'professional', dependsOn: [], affects: ['Admin'] },
      { key: 'announcements',    label: 'Announcements',     description: 'Broadcast messages to learners.', tier: 'professional', dependsOn: ['notifications'], affects: ['Learner Portal'] },
      { key: 'pushNotifications', label: 'Push Notifications', description: 'Mobile push alerts.', tier: 'enterprise', dependsOn: ['notifications'], affects: ['Mobile App'] },
    ],
  },
  {
    name: 'Commercial',
    features: [
      { key: 'whiteLabel',   label: 'White Label',   description: 'Remove default branding for this company.', tier: 'enterprise', dependsOn: ['branding'], affects: ['Login', 'Dashboard', 'Email'] },
      { key: 'subscription', label: 'Subscription',  description: 'Billing and subscription management.', tier: 'professional', dependsOn: ['license'], affects: ['Admin'] },
      { key: 'license',      label: 'License',       description: 'License and entitlement management.', tier: 'starter', dependsOn: [], affects: ['Admin'] },
      { key: 'apiAccess',    label: 'API Access',    description: 'Programmatic access to platform data.', tier: 'enterprise', dependsOn: [], affects: ['Integrations'] },
      { key: 'storage',      label: 'Storage',       description: 'File and media storage quota.', tier: 'professional', dependsOn: [], affects: ['Admin'] },
      { key: 'branding',     label: 'Branding',      description: 'Custom colors, logos and previews.', tier: 'professional', dependsOn: [], affects: ['Login', 'Dashboard'] },
    ],
  },
  {
    name: 'Security',
    features: [
      { key: 'auditLogs',      label: 'Audit Logs',      description: 'Track administrative actions.', tier: 'enterprise', dependsOn: [], affects: ['Admin'] },
      { key: 'ipRestriction',  label: 'IP Restriction',  description: 'Restrict login by IP range.', tier: 'enterprise', dependsOn: [], affects: ['Authentication'] },
      { key: 'twoFa',          label: '2FA',             description: 'Two-factor authentication.', tier: 'professional', dependsOn: [], affects: ['Authentication'] },
      { key: 'sessionControl', label: 'Session Control', description: 'Limit concurrent sessions.', tier: 'enterprise', dependsOn: [], affects: ['Authentication'] },
    ],
  },
];

const ALL_FEATURES = FEATURE_GROUPS.flatMap((g) => g.features);
const featureByKey = new Map(ALL_FEATURES.map((f) => [f.key, f]));

const TIER_LABEL: Record<Tier, string> = { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' };
const TIER_STYLES: Record<Tier, string> = {
  starter: 'bg-slate-100 text-slate-600',
  professional: 'bg-blue-50 text-blue-700',
  enterprise: 'bg-indigo-50 text-indigo-700',
};

function defaultFeaturesForTier(tier: Tier): Record<string, boolean> {
  const order: Tier[] = ['starter', 'professional', 'enterprise'];
  const maxIndex = order.indexOf(tier);
  const result: Record<string, boolean> = {};
  ALL_FEATURES.forEach((f) => {
    result[f.key] = order.indexOf(f.tier) <= maxIndex;
  });
  return result;
}

interface FeatureToggleState {
  features: Record<string, boolean>;
  preset:   PresetName;
}

function defaultState(): FeatureToggleState {
  return { features: defaultFeaturesForTier('starter'), preset: 'starter' };
}

function detectPreset(features: Record<string, boolean>): PresetName {
  for (const tier of ['starter', 'professional', 'enterprise'] as Tier[]) {
    const candidate = defaultFeaturesForTier(tier);
    const matches = ALL_FEATURES.every((f) => !!features[f.key] === !!candidate[f.key]);
    if (matches) return tier;
  }
  return 'custom';
}

function parseThemeBlob(theme: string): Record<string, unknown> {
  if (!theme) return {};
  try {
    const parsed = JSON.parse(theme);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function readFeatureState(company: Company): FeatureToggleState {
  const blob = parseThemeBlob(company.theme);
  const raw = blob.featureToggles as Partial<FeatureToggleState> | undefined;
  if (!raw || typeof raw !== 'object' || !raw.features) return defaultState();
  const features = { ...defaultFeaturesForTier('starter'), ...raw.features };
  return { features, preset: detectPreset(features) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons + shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
function IconChevronDown({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

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

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition ${on ? 'bg-indigo-600' : 'bg-slate-300'}`}>
      <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white transition ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

function TierBadge({ tier }: { tier: Tier }) {
  return <span className={`inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIER_STYLES[tier]}`}>{TIER_LABEL[tier]}</span>;
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_280px]">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load companies</p>
      <p className="mt-1">{message}</p>
      <SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.752.43.992l1.005.828c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.752-.43-.992l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      </svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main FeatureToggleManagement
// ─────────────────────────────────────────────────────────────────────────────

function FeatureToggleManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [companySearch, setCompanySearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | PresetName>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [activeCompanyId, setActiveCompanyId] = useState('');
  const [draft, setDraft] = useState<FeatureToggleState>(defaultState());
  const [featureSearch, setFeatureSearch] = useState('');
  const [selectedFeatureKey, setSelectedFeatureKey] = useState('courseBuilder');
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(FEATURE_GROUPS.map((g) => g.name)));

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    loadCompanies()
      .then((rows) => {
        setCompanies(rows);
        const firstId = activeCompanyId || rows[0]?.id || '';
        setActiveCompanyId(firstId);
        const found = rows.find((c) => c.id === firstId);
        setDraft(found ? readFeatureState(found) : defaultState());
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load companies.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectCompany(id: string) {
    setActiveCompanyId(id);
    const found = companies.find((c) => c.id === id);
    setDraft(found ? readFeatureState(found) : defaultState());
  }

  function toggleGroupExpanded(name: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  function setFeatures(features: Record<string, boolean>) {
    setDraft({ features, preset: detectPreset(features) });
  }

  function toggleFeature(key: string) {
    setFeatures({ ...draft.features, [key]: !draft.features[key] });
  }

  function handleEnableAll() {
    const all: Record<string, boolean> = {};
    ALL_FEATURES.forEach((f) => { all[f.key] = true; });
    setFeatures(all);
  }

  function handleDisableAll() {
    const all: Record<string, boolean> = {};
    ALL_FEATURES.forEach((f) => { all[f.key] = false; });
    setFeatures(all);
  }

  function handleRestoreDefault() {
    setFeatures(defaultFeaturesForTier('starter'));
    showToast('Restored to Starter defaults');
  }

  function applyPreset(tier: Tier) {
    setFeatures(defaultFeaturesForTier(tier));
    showToast(`Applied ${TIER_LABEL[tier]} preset`);
  }

  async function handleSave() {
    if (!activeCompanyId) return;
    const company = companies.find((c) => c.id === activeCompanyId);
    if (!company) return;
    setSaving(true);
    try {
      const blob = parseThemeBlob(company.theme);
      blob.featureToggles = draft;
      await saveCompany(activeCompanyId, { theme: JSON.stringify(blob) });
      fetchAll();
      showToast('Feature configuration saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const companyStates = useMemo(() => new Map(companies.map((c) => [c.id, readFeatureState(c)])), [companies]);

  const filteredCompanies = useMemo(() => {
    const kw = companySearch.trim().toLowerCase();
    return companies.filter((c) => {
      if (kw && !c.company_name.toLowerCase().includes(kw)) return false;
      if (statusFilter !== 'all' && (statusFilter === 'active') !== c.active) return false;
      if (planFilter !== 'all' && companyStates.get(c.id)?.preset !== planFilter) return false;
      return true;
    });
  }, [companies, companySearch, statusFilter, planFilter, companyStates]);

  const topSummary = useMemo(() => {
    let enabled = 0, disabled = 0, custom = 0;
    companies.forEach((c) => {
      const state = companyStates.get(c.id);
      if (!state) return;
      ALL_FEATURES.forEach((f) => { state.features[f.key] ? (enabled += 1) : (disabled += 1); });
      if (state.preset === 'custom') custom += 1;
    });
    return { total: companies.length, enabled, disabled, custom };
  }, [companies, companyStates]);

  const featureSearchTerm = featureSearch.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    if (!featureSearchTerm) return FEATURE_GROUPS;
    return FEATURE_GROUPS
      .map((g) => ({ ...g, features: g.features.filter((f) => f.label.toLowerCase().includes(featureSearchTerm)) }))
      .filter((g) => g.features.length > 0);
  }, [featureSearchTerm]);

  const selectedFeature = featureByKey.get(selectedFeatureKey) ?? null;
  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">

      {/* TOP SUMMARY */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Companies" value={topSummary.total} accent="border-slate-200" />
        <SummaryCard label="Enabled Features" value={topSummary.enabled} accent="border-emerald-200" />
        <SummaryCard label="Disabled Features" value={topSummary.disabled} accent="border-slate-200" />
        <SummaryCard label="Custom Configurations" value={topSummary.custom} accent="border-indigo-200" />
      </div>

      {/* TOP TOOLBAR */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <input value={featureSearch} onChange={(e) => setFeatureSearch(e.target.value)} placeholder="Search feature…" className="min-w-[200px] flex-1 rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
        <SecondaryButton onClick={handleEnableAll} disabled={!activeCompanyId}>Enable All</SecondaryButton>
        <SecondaryButton onClick={handleDisableAll} disabled={!activeCompanyId}>Disable All</SecondaryButton>
        <SecondaryButton onClick={handleRestoreDefault} disabled={!activeCompanyId}>Restore Default</SecondaryButton>
        <PrimaryButton onClick={handleSave} disabled={!activeCompanyId || saving}>
          {saving ? <IconSpinner className="h-3.5 w-3.5" /> : null} Save
        </PrimaryButton>
      </div>

      {/* PRESETS */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Presets:</span>
        <SecondaryButton onClick={() => applyPreset('starter')} disabled={!activeCompanyId} className={draft.preset === 'starter' ? 'ring-2 ring-indigo-400' : ''}>Starter</SecondaryButton>
        <SecondaryButton onClick={() => applyPreset('professional')} disabled={!activeCompanyId} className={draft.preset === 'professional' ? 'ring-2 ring-indigo-400' : ''}>Professional</SecondaryButton>
        <SecondaryButton onClick={() => applyPreset('enterprise')} disabled={!activeCompanyId} className={draft.preset === 'enterprise' ? 'ring-2 ring-indigo-400' : ''}>Enterprise</SecondaryButton>
        <span className={`ml-1 rounded-full px-2.5 py-1 text-xs font-semibold ${draft.preset === 'custom' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
          Current: {draft.preset === 'custom' ? 'Custom' : TIER_LABEL[draft.preset]}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_280px]">

        {/* LEFT PANEL */}
        <div className="rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <p className="mb-3 text-sm font-bold text-slate-800">Companies</p>
          <input value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} placeholder="Search company…" className="mb-2 w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as 'all' | PresetName)} className="mb-2 w-full rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
            <option value="all">All Plans</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
            <option value="custom">Custom</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')} className="mb-3 w-full rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {filteredCompanies.length === 0 ? (
            <EmptyState message="No companies match these filters." />
          ) : (
            <div className="max-h-[500px] space-y-1 overflow-y-auto">
              {filteredCompanies.map((c) => {
                const state = companyStates.get(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => selectCompany(c.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left transition ${activeCompanyId === c.id ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{c.company_name}</span>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${state?.preset === 'custom' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {state ? (state.preset === 'custom' ? 'Custom' : TIER_LABEL[state.preset]) : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* CENTER — Feature Groups */}
        <div className="space-y-4">
          {!activeCompany ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <EmptyState message="Select a company to configure its features." />
            </div>
          ) : (
            visibleGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.name);
              return (
                <div key={group.name} className="rounded-2xl bg-white shadow-sm">
                  <button onClick={() => toggleGroupExpanded(group.name)} className="flex w-full items-center justify-between px-6 py-4 text-left">
                    <h3 className="text-base font-bold text-slate-900">{group.name}</h3>
                    <IconChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {isExpanded && (
                    <div className="space-y-2 px-6 pb-6">
                      {group.features.map((f) => (
                        <button
                          key={f.key}
                          onClick={() => setSelectedFeatureKey(f.key)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition ${selectedFeatureKey === f.key ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'bg-slate-50 hover:bg-slate-100'}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-slate-800">{f.label}</p>
                              <TierBadge tier={f.tier} />
                            </div>
                            <p className="truncate text-xs text-slate-400">{f.description}</p>
                          </div>
                          <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                            <Toggle on={!!draft.features[f.key]} onChange={() => toggleFeature(f.key)} />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT PANEL — Feature Details */}
        <div className="rounded-2xl bg-white p-6 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Feature Details</h3>
          {!selectedFeature ? (
            <EmptyState message="Select a feature to see its details." />
          ) : (
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-base font-bold text-slate-800">{selectedFeature.label}</p>
                  <TierBadge tier={selectedFeature.tier} />
                </div>
                <p className="text-sm text-slate-500">{selectedFeature.description}</p>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3">
                <span className="text-sm font-medium text-slate-700">Status</span>
                {activeCompanyId && <Toggle on={!!draft.features[selectedFeature.key]} onChange={() => toggleFeature(selectedFeature.key)} />}
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-500">Required License</p>
                <TierBadge tier={selectedFeature.tier} />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-500">Dependencies</p>
                {selectedFeature.dependsOn.length === 0 ? (
                  <p className="text-sm text-slate-400">None</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFeature.dependsOn.map((depKey) => {
                      const dep = featureByKey.get(depKey);
                      const depEnabled = !!draft.features[depKey];
                      return (
                        <span key={depKey} className={`rounded-full px-2.5 py-1 text-xs font-medium ${depEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {dep?.label ?? depKey}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-500">Affected Modules</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedFeature.affects.map((mod) => (
                    <span key={mod} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{mod}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default FeatureToggleManagement;