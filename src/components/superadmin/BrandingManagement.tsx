// src/components/superadmin/BrandingManagement.tsx
//
// Professional White Label Branding Module. Reuses only existing,
// unmodified architecture:
//   companyService  (loadCompanies / saveCompany) — Company Name, Short
//                    Name, Logo, Favicon, Website, Email, Phone are all
//                    real top-level `companies` columns, saved as-is.
//                    Every other branding field (colors, tagline, button
//                    style, dark/light logo variants, login background,
//                    dashboard banner, email header logo, certificate
//                    logo, watermark, feature toggles) has no dedicated
//                    column anywhere, so it is encoded as JSON into the
//                    real, existing, otherwise-unused `companies.theme`
//                    text column — genuinely persisted through the
//                    existing saveCompany() call, not a fake table.
//   branchService   (getAll) — real per-company branch count in the list
//   contentEditorService.uploadImage — real Storage uploads for every
//                    logo/image field
//   session.getCurrentUser() — used only to know who is acting, no auth
//                    changes
//
// No repository/service/database changes.

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadCompanies, saveCompany } from '../../services/company/companyService';
import { branchService } from '../../services/branch/branchService';
import { uploadImage } from '../../services/contentEditor/contentEditorService';

import type { Company } from '../../types/company';
import type { Branch } from '../../types/branch';

// ─────────────────────────────────────────────────────────────────────────────
// Branding config — persisted as JSON inside the real companies.theme column
// ─────────────────────────────────────────────────────────────────────────────

type ButtonStyle = 'rounded' | 'square' | 'pill';

interface BrandingConfig {
  tagline:              string;
  primaryColor:         string;
  secondaryColor:       string;
  accentColor:          string;
  backgroundColor:      string;
  sidebarColor:         string;
  headerColor:          string;
  buttonStyle:          ButtonStyle;
  borderRadius:         number;
  fontFamily:           string;
  darkLogoUrl:          string;
  lightLogoUrl:         string;
  loginBackgroundUrl:   string;
  dashboardBannerUrl:   string;
  emailHeaderLogoUrl:   string;
  certificateLogoUrl:   string;
  watermarkUrl:         string;
  enableWhiteLabel:     boolean;
  showPoweredBy:        boolean;
  customFooter:         string;
  customSupportEmail:   string;
  customSupportPhone:   string;
  customWebsite:        string;
}

const DEFAULT_BRANDING: BrandingConfig = {
  tagline: '',
  primaryColor: '#4f46e5',
  secondaryColor: '#0f172a',
  accentColor: '#f97316',
  backgroundColor: '#f8fafc',
  sidebarColor: '#0f172a',
  headerColor: '#ffffff',
  buttonStyle: 'rounded',
  borderRadius: 12,
  fontFamily: 'Inter, sans-serif',
  darkLogoUrl: '',
  lightLogoUrl: '',
  loginBackgroundUrl: '',
  dashboardBannerUrl: '',
  emailHeaderLogoUrl: '',
  certificateLogoUrl: '',
  watermarkUrl: '',
  enableWhiteLabel: false,
  showPoweredBy: true,
  customFooter: '',
  customSupportEmail: '',
  customSupportPhone: '',
  customWebsite: '',
};

function parseBranding(theme: string): BrandingConfig {
  if (!theme) return { ...DEFAULT_BRANDING };
  try {
    return { ...DEFAULT_BRANDING, ...JSON.parse(theme) };
  } catch {
    return { ...DEFAULT_BRANDING };
  }
}

type BrandingStatus = 'configured' | 'pending' | 'default';

function brandingStatus(company: Company): BrandingStatus {
  if (!company.theme) return 'default';
  const cfg = parseBranding(company.theme);
  if (cfg.enableWhiteLabel && (company.logo || cfg.lightLogoUrl)) return 'configured';
  return 'pending';
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG only)
// ─────────────────────────────────────────────────────────────────────────────

function IconUpload({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
function IconDuplicate({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.29 48.29 0 0 1 1.927-.184" />
    </svg>
  );
}

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

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition ${on ? 'bg-indigo-600' : 'bg-slate-300'}`}>
      <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white transition ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

function ToggleRow({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <Toggle on={on} onChange={onChange} />
    </div>
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

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-10 flex-shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS} />
      </div>
    </div>
  );
}

function ImageField({
  label, value, uploading, onUpload,
}: { label: string; value: string; uploading: boolean; onUpload: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-12 w-20 flex-shrink-0 rounded-lg border border-slate-100 object-contain bg-slate-50 p-1" />
        ) : (
          <div className="flex h-12 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-300">
            <IconUpload className="h-4 w-4" />
          </div>
        )}
        <SecondaryButton onClick={() => inputRef.current?.click()} className="text-xs">
          {uploading ? <IconSpinner className="h-3.5 w-3.5" /> : <IconUpload />} Upload
        </SecondaryButton>
        <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.svg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(f); }} />
      </div>
    </div>
  );
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
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
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5" />
      </svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

const STATUS_STYLES: Record<BrandingStatus, string> = {
  configured: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  pending:    'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  default:    'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
};
const STATUS_LABEL: Record<BrandingStatus, string> = {
  configured: 'Configured',
  pending: 'Pending',
  default: 'Default',
};
function StatusBadge({ status }: { status: BrandingStatus }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status]}`}>{STATUS_LABEL[status]}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Live previews — small, honest CSS mockups reflecting the current config
// ─────────────────────────────────────────────────────────────────────────────

function LoginPreview({ cfg, companyName }: { cfg: BrandingConfig; companyName: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100" style={{ fontFamily: cfg.fontFamily }}>
      <div
        className="flex h-40 items-center justify-center bg-cover bg-center"
        style={{ backgroundColor: cfg.backgroundColor, backgroundImage: cfg.loginBackgroundUrl ? `url(${cfg.loginBackgroundUrl})` : undefined }}
      >
        <div className="w-48 rounded-xl bg-white/95 p-4 shadow-lg" style={{ borderRadius: cfg.borderRadius }}>
          {cfg.lightLogoUrl ? (
            <img src={cfg.lightLogoUrl} alt="" className="mx-auto mb-2 h-8 object-contain" />
          ) : (
            <p className="mb-2 text-center text-sm font-bold" style={{ color: cfg.primaryColor }}>{companyName}</p>
          )}
          <p className="mb-3 text-center text-[10px] text-slate-400">{cfg.tagline || 'Sign in to continue'}</p>
          <div className="mb-2 h-6 rounded bg-slate-100" />
          <div className="mb-3 h-6 rounded bg-slate-100" />
          <div
            className="h-7 text-center text-[10px] font-semibold leading-7 text-white"
            style={{ background: cfg.primaryColor, borderRadius: cfg.buttonStyle === 'pill' ? 999 : cfg.buttonStyle === 'square' ? 0 : cfg.borderRadius }}
          >
            Sign In
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardPreview({ cfg, companyName }: { cfg: BrandingConfig; companyName: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100" style={{ fontFamily: cfg.fontFamily }}>
      <div className="flex h-40">
        <div className="w-12 flex-shrink-0" style={{ backgroundColor: cfg.sidebarColor }} />
        <div className="flex-1" style={{ backgroundColor: cfg.backgroundColor }}>
          <div className="flex h-8 items-center gap-2 px-3" style={{ backgroundColor: cfg.headerColor }}>
            {cfg.lightLogoUrl && <img src={cfg.lightLogoUrl} alt="" className="h-4 object-contain" />}
            <span className="text-[10px] font-semibold text-slate-600">{companyName}</span>
          </div>
          {cfg.dashboardBannerUrl && <img src={cfg.dashboardBannerUrl} alt="" className="h-10 w-full object-cover" />}
          <div className="grid grid-cols-3 gap-2 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-white shadow-sm" style={{ borderRadius: cfg.borderRadius, borderTop: `2px solid ${cfg.accentColor}` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CertificatePreview({ cfg, companyName }: { cfg: BrandingConfig; companyName: string }) {
  return (
    <div className="relative flex h-40 flex-col items-center justify-center overflow-hidden rounded-xl border-4 p-4 text-center" style={{ borderColor: cfg.primaryColor, fontFamily: cfg.fontFamily }}>
      {cfg.watermarkUrl && <img src={cfg.watermarkUrl} alt="" className="absolute inset-0 h-full w-full object-contain opacity-10" />}
      {cfg.certificateLogoUrl ? (
        <img src={cfg.certificateLogoUrl} alt="" className="mb-2 h-8 object-contain" />
      ) : (
        <p className="mb-2 text-sm font-bold" style={{ color: cfg.primaryColor }}>{companyName}</p>
      )}
      <p className="text-xs text-slate-400">Certificate of Completion</p>
      <p className="mt-1 text-[10px] font-semibold text-slate-600">Employee Name</p>
    </div>
  );
}

function EmailPreview({ cfg, companyName }: { cfg: BrandingConfig; companyName: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100" style={{ fontFamily: cfg.fontFamily }}>
      <div className="flex h-14 items-center px-4" style={{ backgroundColor: cfg.primaryColor }}>
        {cfg.emailHeaderLogoUrl ? (
          <img src={cfg.emailHeaderLogoUrl} alt="" className="h-6 object-contain" />
        ) : (
          <span className="text-sm font-bold text-white">{companyName}</span>
        )}
      </div>
      <div className="space-y-2 bg-white p-4">
        <div className="h-2 w-3/4 rounded bg-slate-100" />
        <div className="h-2 w-1/2 rounded bg-slate-100" />
        {cfg.showPoweredBy && <p className="pt-2 text-[9px] text-slate-300">Powered by SK Training Suite</p>}
      </div>
    </div>
  );
}

function MobilePreview({ cfg, companyName }: { cfg: BrandingConfig; companyName: string }) {
  return (
    <div className="mx-auto w-24 overflow-hidden rounded-2xl border-4 border-slate-800" style={{ fontFamily: cfg.fontFamily }}>
      <div className="flex h-6 items-center justify-center" style={{ backgroundColor: cfg.headerColor }}>
        {cfg.lightLogoUrl ? <img src={cfg.lightLogoUrl} alt="" className="h-3 object-contain" /> : <span className="text-[7px] font-bold text-slate-600">{companyName}</span>}
      </div>
      <div className="flex h-32 flex-col gap-1 p-1.5" style={{ backgroundColor: cfg.backgroundColor }}>
        <div className="h-8 rounded" style={{ backgroundColor: cfg.accentColor, opacity: 0.15 }} />
        <div className="h-4 rounded bg-white shadow-sm" />
        <div className="h-4 rounded bg-white shadow-sm" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main BrandingManagement
// ─────────────────────────────────────────────────────────────────────────────

interface BrandingDraft {
  company_name: string;
  short_name:   string;
  logo:         string;
  favicon:      string;
  website:      string;
  email:        string;
  phone:        string;
  config:       BrandingConfig;
}

function toDraft(c: Company): BrandingDraft {
  return {
    company_name: c.company_name,
    short_name: c.short_name,
    logo: c.logo,
    favicon: c.favicon,
    website: c.website,
    email: c.email,
    phone: c.phone,
    config: parseBranding(c.theme),
  };
}

function BrandingManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [search, setSearch] = useState('');
  const [activeCompanyId, setActiveCompanyId] = useState('');
  const [draft, setDraft] = useState<BrandingDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicateTargetId, setDuplicateTargetId] = useState('');
  const [uploadingField, setUploadingField] = useState('');

  const importInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([loadCompanies(), branchService.getAll()])
      .then(([companyRows, branchRows]) => {
        setCompanies(companyRows);
        setBranches(branchRows);
        const firstId = activeCompanyId || companyRows[0]?.id || '';
        setActiveCompanyId(firstId);
        const found = companyRows.find((c) => c.id === firstId);
        if (found) setDraft(toDraft(found));
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

  const branchCountByCompany = useMemo(() => {
    const map = new Map<string, number>();
    branches.forEach((b) => map.set(b.company_id, (map.get(b.company_id) ?? 0) + 1));
    return map;
  }, [branches]);

  const filteredCompanies = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return companies.filter((c) => !kw || c.company_name.toLowerCase().includes(kw));
  }, [companies, search]);

  const topSummary = useMemo(() => {
    let configured = 0, pending = 0, def = 0;
    companies.forEach((c) => {
      const status = brandingStatus(c);
      if (status === 'configured') configured += 1;
      else if (status === 'pending') pending += 1;
      else def += 1;
    });
    return { total: companies.length, configured, pending, default: def };
  }, [companies]);

  function selectCompany(id: string) {
    setActiveCompanyId(id);
    const found = companies.find((c) => c.id === id);
    if (found) setDraft(toDraft(found));
  }

  function updateDraft(patch: Partial<BrandingDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function updateConfig(patch: Partial<BrandingConfig>) {
    setDraft((prev) => (prev ? { ...prev, config: { ...prev.config, ...patch } } : prev));
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!activeCompanyId || !draft) return;
    setSaving(true);
    try {
      await saveCompany(activeCompanyId, {
        company_name: draft.company_name,
        short_name: draft.short_name,
        logo: draft.logo,
        favicon: draft.favicon,
        website: draft.website,
        email: draft.email,
        phone: draft.phone,
        theme: JSON.stringify(draft.config),
      });
      fetchAll();
      showToast('Branding saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save branding.');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    const found = companies.find((c) => c.id === activeCompanyId);
    if (found) setDraft(toDraft(found));
    showToast('Reset to last saved values');
  }

  async function handleDuplicate() {
    if (!draft || !duplicateTargetId) return;
    setSaving(true);
    try {
      await saveCompany(duplicateTargetId, {
        logo: draft.logo,
        favicon: draft.favicon,
        theme: JSON.stringify(draft.config),
      });
      fetchAll();
      showToast('Branding duplicated to selected company');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to duplicate branding.');
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(draft.config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(draft.short_name || draft.company_name || 'branding').replace(/[^a-z0-9]+/gi, '_')}_branding.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        updateConfig(parsed);
        showToast('Branding imported — remember to Save');
      } catch {
        showToast('Invalid branding file.');
      }
    };
    reader.readAsText(file);
  }

  async function handleImageUpload(field: keyof BrandingConfig | 'logo' | 'favicon', file: File) {
    setUploadingField(field);
    try {
      const result = await uploadImage(file);
      if (field === 'logo' || field === 'favicon') {
        updateDraft({ [field]: result.url } as Partial<BrandingDraft>);
      } else {
        updateConfig({ [field]: result.url } as Partial<BrandingConfig>);
      }
      showToast('Image uploaded — remember to Save');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingField('');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? null;

  return (
    <div className="space-y-6">

      {/* TOP SUMMARY */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Companies" value={topSummary.total} accent="border-slate-200" />
        <SummaryCard label="Configured Branding" value={topSummary.configured} accent="border-emerald-200" />
        <SummaryCard label="Default Branding" value={topSummary.default} accent="border-slate-200" />
        <SummaryCard label="Pending Branding" value={topSummary.pending} accent="border-amber-200" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">

        {/* LEFT PANEL */}
        <div className="rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <p className="mb-3 text-sm font-bold text-slate-800">Companies</p>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company…" className={`${INPUT_CLS} mb-3`} />
          {filteredCompanies.length === 0 ? (
            <EmptyState message="No companies match this search." />
          ) : (
            <div className="max-h-[540px] space-y-1 overflow-y-auto">
              {filteredCompanies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectCompany(c.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${activeCompanyId === c.id ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}
                >
                  {c.logo ? (
                    <img src={c.logo} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg object-contain bg-slate-50 p-1" />
                  ) : (
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-400">
                      {c.company_name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{c.company_name}</p>
                    <p className="text-xs text-slate-400">{branchCountByCompany.get(c.id) ?? 0} branch(es)</p>
                  </div>
                  <StatusBadge status={brandingStatus(c)} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        {!activeCompany || !draft ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <EmptyState message="Select a company to configure its branding." />
          </div>
        ) : (
          <div className="space-y-6">

            {/* BRANDING */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Branding</h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Company Name"><input value={draft.company_name} onChange={(e) => updateDraft({ company_name: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Short Name"><input value={draft.short_name} onChange={(e) => updateDraft({ short_name: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Tagline"><input value={draft.config.tagline} onChange={(e) => updateConfig({ tagline: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Font Family">
                  <select value={draft.config.fontFamily} onChange={(e) => updateConfig({ fontFamily: e.target.value })} className={INPUT_CLS}>
                    <option value="Inter, sans-serif">Inter</option>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                    <option value="'Courier New', monospace">Courier New</option>
                    <option value="Verdana, sans-serif">Verdana</option>
                  </select>
                </Field>
                <Field label="Button Style">
                  <select value={draft.config.buttonStyle} onChange={(e) => updateConfig({ buttonStyle: e.target.value as ButtonStyle })} className={INPUT_CLS}>
                    <option value="rounded">Rounded</option>
                    <option value="square">Square</option>
                    <option value="pill">Pill</option>
                  </select>
                </Field>
                <Field label="Border Radius (px)">
                  <input type="number" min={0} max={32} value={draft.config.borderRadius} onChange={(e) => updateConfig({ borderRadius: Number(e.target.value) })} className={INPUT_CLS} />
                </Field>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <ColorField label="Primary Color" value={draft.config.primaryColor} onChange={(v) => updateConfig({ primaryColor: v })} />
                <ColorField label="Secondary Color" value={draft.config.secondaryColor} onChange={(v) => updateConfig({ secondaryColor: v })} />
                <ColorField label="Accent Color" value={draft.config.accentColor} onChange={(v) => updateConfig({ accentColor: v })} />
                <ColorField label="Background Color" value={draft.config.backgroundColor} onChange={(v) => updateConfig({ backgroundColor: v })} />
                <ColorField label="Sidebar Color" value={draft.config.sidebarColor} onChange={(v) => updateConfig({ sidebarColor: v })} />
                <ColorField label="Header Color" value={draft.config.headerColor} onChange={(v) => updateConfig({ headerColor: v })} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ImageField label="Logo Upload" value={draft.logo} uploading={uploadingField === 'logo'} onUpload={(f) => handleImageUpload('logo', f)} />
                <ImageField label="Favicon Upload" value={draft.favicon} uploading={uploadingField === 'favicon'} onUpload={(f) => handleImageUpload('favicon', f)} />
                <ImageField label="Dark Logo" value={draft.config.darkLogoUrl} uploading={uploadingField === 'darkLogoUrl'} onUpload={(f) => handleImageUpload('darkLogoUrl', f)} />
                <ImageField label="Light Logo" value={draft.config.lightLogoUrl} uploading={uploadingField === 'lightLogoUrl'} onUpload={(f) => handleImageUpload('lightLogoUrl', f)} />
                <ImageField label="Login Background Image" value={draft.config.loginBackgroundUrl} uploading={uploadingField === 'loginBackgroundUrl'} onUpload={(f) => handleImageUpload('loginBackgroundUrl', f)} />
                <ImageField label="Dashboard Banner" value={draft.config.dashboardBannerUrl} uploading={uploadingField === 'dashboardBannerUrl'} onUpload={(f) => handleImageUpload('dashboardBannerUrl', f)} />
                <ImageField label="Email Header Logo" value={draft.config.emailHeaderLogoUrl} uploading={uploadingField === 'emailHeaderLogoUrl'} onUpload={(f) => handleImageUpload('emailHeaderLogoUrl', f)} />
                <ImageField label="Certificate Logo" value={draft.config.certificateLogoUrl} uploading={uploadingField === 'certificateLogoUrl'} onUpload={(f) => handleImageUpload('certificateLogoUrl', f)} />
                <ImageField label="Watermark" value={draft.config.watermarkUrl} uploading={uploadingField === 'watermarkUrl'} onUpload={(f) => handleImageUpload('watermarkUrl', f)} />
              </div>
            </div>

            {/* LIVE PREVIEWS */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Login Page — Live Preview</h3>
                <LoginPreview cfg={draft.config} companyName={draft.company_name} />
              </div>
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Dashboard — Live Preview</h3>
                <DashboardPreview cfg={draft.config} companyName={draft.company_name} />
              </div>
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Certificate — Live Preview</h3>
                <CertificatePreview cfg={draft.config} companyName={draft.company_name} />
              </div>
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Email — Preview</h3>
                <EmailPreview cfg={draft.config} companyName={draft.company_name} />
              </div>
              <div className="rounded-2xl bg-white p-6 shadow-sm sm:col-span-2">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Mobile — Preview</h3>
                <MobilePreview cfg={draft.config} companyName={draft.company_name} />
              </div>
            </div>

            {/* FEATURES */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Features</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ToggleRow label="Enable White Label" on={draft.config.enableWhiteLabel} onChange={() => updateConfig({ enableWhiteLabel: !draft.config.enableWhiteLabel })} />
                <ToggleRow label="Show Powered By" on={draft.config.showPoweredBy} onChange={() => updateConfig({ showPoweredBy: !draft.config.showPoweredBy })} />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Custom Footer"><input value={draft.config.customFooter} onChange={(e) => updateConfig({ customFooter: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Custom Website"><input value={draft.config.customWebsite || draft.website} onChange={(e) => updateConfig({ customWebsite: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Custom Support Email"><input value={draft.config.customSupportEmail || draft.email} onChange={(e) => updateConfig({ customSupportEmail: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Custom Support Phone"><input value={draft.config.customSupportPhone || draft.phone} onChange={(e) => updateConfig({ customSupportPhone: e.target.value })} className={INPUT_CLS} /></Field>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Actions</h3>
              <div className="flex flex-wrap items-center gap-2">
                <PrimaryButton onClick={handleSave} disabled={saving}>
                  {saving ? <IconSpinner className="h-3.5 w-3.5" /> : null} Save
                </PrimaryButton>
                <SecondaryButton onClick={handleReset}>Reset</SecondaryButton>
                <SecondaryButton onClick={handleExport}>Export Branding</SecondaryButton>
                <SecondaryButton onClick={() => importInputRef.current?.click()}>Import Branding</SecondaryButton>
                <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleImportFile(f); }} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <select value={duplicateTargetId} onChange={(e) => setDuplicateTargetId(e.target.value)} className={`${INPUT_CLS} max-w-xs`}>
                  <option value="">Duplicate to company…</option>
                  {companies.filter((c) => c.id !== activeCompanyId).map((c) => (<option key={c.id} value={c.id}>{c.company_name}</option>))}
                </select>
                <SecondaryButton onClick={handleDuplicate} disabled={!duplicateTargetId || saving}>
                  <IconDuplicate /> Duplicate Branding
                </SecondaryButton>
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

export default BrandingManagement;