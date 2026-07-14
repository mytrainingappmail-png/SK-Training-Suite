// src/components/admin/settings/SystemSettings.tsx
//
// Premium System Settings Center. There is no system-settings table,
// service, or repository anywhere in this app — confirmed before writing
// anything here. Per instructions, everything with no real backing is
// kept as temporary, session-local state (clearly labelled; nothing fake
// is persisted).
//
// Fields that ARE real, existing `companies` columns are saved through
// the existing, unmodified companyService — nothing invented:
//   General:      Organization Name, Website, Support Email,
//                 Support Phone, Address
//   Organization: Legal Name, GST Number, PAN Number, City, State,
//                 Country, Pincode
//   Localization: Timezone, Language, Currency
//   Branding:     a read-only summary of the real `companies.theme` blob
//                 already written by BrandingManagement.tsx (read-only
//                 here, never written back, so no collision risk)
//
// Everything else (Training App Name, Security, Authentication,
// Password Policy, Session Management, Date Format, Email/SMTP,
// Notification defaults, Storage, Upload Limits, Backup, Performance,
// Maintenance Mode) has no dedicated column anywhere in this schema, so
// it is session-local UI state only.
//
// No repository, service, or database changes.

import { useEffect, useState } from 'react';
import { loadCompanies, saveCompany } from '../../../services/company/companyService';
import type { Company } from '../../../types/company';

// ─────────────────────────────────────────────────────────────────────────────
// Session-local settings — no backend column exists for these yet
// ─────────────────────────────────────────────────────────────────────────────

interface SecuritySettings {
  sessionTimeoutMinutes: number;
  loginAttemptsAllowed:  number;
  autoLogoutEnabled:     boolean;
  twoFactorEnabled:      boolean;
}

interface AuthenticationSettings {
  allowSelfRegistration:   boolean;
  requireEmailVerification: boolean;
  ssoEnabled:              boolean;
}

interface PasswordPolicySettings {
  minimumLength:        number;
  expiryDays:           number;
  forcePasswordChange:  boolean;
  requireUppercase:     boolean;
  requireNumber:        boolean;
  requireSpecialChar:   boolean;
}

interface SessionManagementSettings {
  sessionTimeoutMinutes: number;
  autoLogoutEnabled:     boolean;
  maxConcurrentSessions: number;
}

interface EmailSettings {
  smtpHost:      string;
  smtpPort:      number;
  username:      string;
  password:      string;
  encryption:    'none' | 'ssl' | 'tls';
  senderName:    string;
  senderEmail:   string;
}

interface NotificationDefaults {
  emailEnabled: boolean;
  smsEnabled:   boolean;
  pushEnabled:  boolean;
  digestFrequency: 'realtime' | 'daily' | 'weekly';
}

interface StorageSettings {
  provider:  string;
  quotaGb:   number;
}

interface UploadLimitSettings {
  maxFileSizeMb:        number;
  allowedImageTypes:    string;
  allowedVideoTypes:    string;
  allowedDocumentTypes: string;
}

interface BackupSettings {
  frequency:      'daily' | 'weekly' | 'monthly';
  retentionDays:  number;
  autoBackup:     boolean;
  lastBackupAt:   string;
}

interface PerformanceSettings {
  cacheEnabled:    boolean;
  cacheTtlMinutes: number;
  lazyLoading:     boolean;
}

interface MaintenanceSettings {
  maintenanceMode:    boolean;
  maintenanceMessage: string;
  readOnlyMode:       boolean;
}

interface LocalSystemSettings {
  trainingAppName:  string;
  dateFormat:       string;
  security:         SecuritySettings;
  authentication:   AuthenticationSettings;
  passwordPolicy:   PasswordPolicySettings;
  sessionManagement: SessionManagementSettings;
  email:            EmailSettings;
  notifications:    NotificationDefaults;
  storage:          StorageSettings;
  uploadLimits:     UploadLimitSettings;
  backup:           BackupSettings;
  performance:      PerformanceSettings;
  maintenance:      MaintenanceSettings;
}

function defaultSettings(): LocalSystemSettings {
  return {
    trainingAppName: 'SK Training Suite',
    dateFormat: 'DD/MM/YYYY',
    security: { sessionTimeoutMinutes: 30, loginAttemptsAllowed: 5, autoLogoutEnabled: true, twoFactorEnabled: false },
    authentication: { allowSelfRegistration: false, requireEmailVerification: true, ssoEnabled: false },
    passwordPolicy: { minimumLength: 8, expiryDays: 90, forcePasswordChange: false, requireUppercase: true, requireNumber: true, requireSpecialChar: false },
    sessionManagement: { sessionTimeoutMinutes: 30, autoLogoutEnabled: true, maxConcurrentSessions: 3 },
    email: { smtpHost: '', smtpPort: 587, username: '', password: '', encryption: 'tls', senderName: '', senderEmail: '' },
    notifications: { emailEnabled: true, smsEnabled: false, pushEnabled: false, digestFrequency: 'realtime' },
    storage: { provider: 'Supabase Storage', quotaGb: 50 },
    uploadLimits: { maxFileSizeMb: 25, allowedImageTypes: '.jpg,.jpeg,.png,.webp,.gif', allowedVideoTypes: '.mp4', allowedDocumentTypes: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx' },
    backup: { frequency: 'daily', retentionDays: 30, autoBackup: true, lastBackupAt: '' },
    performance: { cacheEnabled: true, cacheTtlMinutes: 15, lazyLoading: true },
    maintenance: { maintenanceMode: false, maintenanceMessage: 'We are performing scheduled maintenance. Please check back soon.', readOnlyMode: false },
  };
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

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
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
function ToggleRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
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

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      {description && <p className="mt-0.5 mb-4 text-xs text-slate-400">{description}</p>}
      <div className={description ? 'space-y-4' : 'mt-4 space-y-4'}>{children}</div>
    </div>
  );
}

function LocalStateNotice() {
  return (
    <p className="mb-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
      Not backed by a dedicated table yet — kept for this session only.
    </p>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
      <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load organization data</p>
      <p className="mt-1">{message}</p>
      <SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SystemSettings
// ─────────────────────────────────────────────────────────────────────────────

type TabKey =
  | 'general' | 'organization' | 'security' | 'authentication' | 'passwordPolicy' | 'sessionManagement'
  | 'branding' | 'localization' | 'email' | 'notifications' | 'storage' | 'uploadLimits'
  | 'backup' | 'performance' | 'maintenance';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'organization', label: 'Organization' },
  { key: 'security', label: 'Security' },
  { key: 'authentication', label: 'Authentication' },
  { key: 'passwordPolicy', label: 'Password Policy' },
  { key: 'sessionManagement', label: 'Session Management' },
  { key: 'branding', label: 'Branding' },
  { key: 'localization', label: 'Localization' },
  { key: 'email', label: 'Email Settings' },
  { key: 'notifications', label: 'Notification Settings' },
  { key: 'storage', label: 'Storage Settings' },
  { key: 'uploadLimits', label: 'Upload Limits' },
  { key: 'backup', label: 'Backup Settings' },
  { key: 'performance', label: 'Performance Settings' },
  { key: 'maintenance', label: 'Maintenance Mode' },
];

function SystemSettings() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [savingField, setSavingField] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [local, setLocal] = useState<LocalSystemSettings>(defaultSettings());
  const [backingUp, setBackingUp] = useState(false);

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
        setSelectedCompanyId((prev) => prev || rows[0]?.id || '');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load organization data.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) ?? null;
  const brandingSummary = selectedCompany ? parseThemeBlob(selectedCompany.theme) : {};

  async function updateCompanyField(patch: Partial<Company>) {
    if (!selectedCompany) return;
    setSavingField(true);
    try {
      await saveCompany(selectedCompany.id, patch);
      fetchAll();
      showToast('Saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSavingField(false);
    }
  }

  function updateLocal<K extends keyof LocalSystemSettings>(key: K, patch: Partial<LocalSystemSettings[K]>) {
    setLocal((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...patch } }));
  }

  function handleManualBackup() {
    setBackingUp(true);
    setTimeout(() => {
      setLocal((prev) => ({ ...prev, backup: { ...prev.backup, lastBackupAt: new Date().toISOString() } }));
      setBackingUp(false);
      showToast('Backup recorded for this session — no backup service is connected yet.');
    }, 600);
  }

  function handleRestore() {
    showToast('Restore requires a connected backup service, which is not available yet.');
  }

  function handleTestConnection() {
    if (!local.email.smtpHost) {
      showToast('Enter an SMTP host first.');
      return;
    }
    showToast('No live SMTP service is connected yet — settings are saved for this session only.');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">

      {/* SIDEBAR */}
      <aside className="rounded-2xl bg-white p-3 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] lg:sticky lg:top-6 lg:h-fit">
        <div className="space-y-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`block w-full rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition ${
                activeTab === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </aside>

      {/* CONTENT */}
      <div className="space-y-6">
        {companies.length > 1 && (activeTab === 'general' || activeTab === 'organization' || activeTab === 'localization' || activeTab === 'branding') && (
          <div className="flex items-center gap-2 rounded-2xl bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Organization</span>
            <select value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
              {companies.map((c) => (<option key={c.id} value={c.id}>{c.company_name}</option>))}
            </select>
            {savingField && <span className="flex items-center gap-1.5 text-xs text-slate-400"><IconSpinner className="h-3.5 w-3.5" /> Saving…</span>}
          </div>
        )}

        {activeTab === 'general' && (
          <SectionCard title="General" description="Core identity of the training platform.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Training App Name">
                <input value={local.trainingAppName} onChange={(e) => setLocal((p) => ({ ...p, trainingAppName: e.target.value }))} className={INPUT_CLS} />
              </Field>
              {selectedCompany && (
                <>
                  <Field label="Organization Name">
                    <input key={`${selectedCompany.id}-name`} defaultValue={selectedCompany.company_name} onBlur={(e) => updateCompanyField({ company_name: e.target.value })} className={INPUT_CLS} />
                  </Field>
                  <Field label="Website">
                    <input key={`${selectedCompany.id}-web`} defaultValue={selectedCompany.website} onBlur={(e) => updateCompanyField({ website: e.target.value })} className={INPUT_CLS} />
                  </Field>
                  <Field label="Support Email">
                    <input key={`${selectedCompany.id}-email`} defaultValue={selectedCompany.email} onBlur={(e) => updateCompanyField({ email: e.target.value })} className={INPUT_CLS} />
                  </Field>
                  <Field label="Support Phone">
                    <input key={`${selectedCompany.id}-phone`} defaultValue={selectedCompany.phone} onBlur={(e) => updateCompanyField({ phone: e.target.value })} className={INPUT_CLS} />
                  </Field>
                </>
              )}
            </div>
            {selectedCompany && (
              <Field label="Address">
                <textarea key={`${selectedCompany.id}-addr`} defaultValue={selectedCompany.address} onBlur={(e) => updateCompanyField({ address: e.target.value })} rows={2} className={`${INPUT_CLS} resize-none`} />
              </Field>
            )}
          </SectionCard>
        )}

        {activeTab === 'organization' && selectedCompany && (
          <SectionCard title="Organization" description="Legal and registration details.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Legal Name">
                <input key={`${selectedCompany.id}-legal`} defaultValue={selectedCompany.legal_name} onBlur={(e) => updateCompanyField({ legal_name: e.target.value })} className={INPUT_CLS} />
              </Field>
              <Field label="GST Number">
                <input key={`${selectedCompany.id}-gst`} defaultValue={selectedCompany.gst_number} onBlur={(e) => updateCompanyField({ gst_number: e.target.value })} className={INPUT_CLS} />
              </Field>
              <Field label="PAN Number">
                <input key={`${selectedCompany.id}-pan`} defaultValue={selectedCompany.pan_number} onBlur={(e) => updateCompanyField({ pan_number: e.target.value })} className={INPUT_CLS} />
              </Field>
              <Field label="City">
                <input key={`${selectedCompany.id}-city`} defaultValue={selectedCompany.city} onBlur={(e) => updateCompanyField({ city: e.target.value })} className={INPUT_CLS} />
              </Field>
              <Field label="State">
                <input key={`${selectedCompany.id}-state`} defaultValue={selectedCompany.state} onBlur={(e) => updateCompanyField({ state: e.target.value })} className={INPUT_CLS} />
              </Field>
              <Field label="Country">
                <input key={`${selectedCompany.id}-country`} defaultValue={selectedCompany.country} onBlur={(e) => updateCompanyField({ country: e.target.value })} className={INPUT_CLS} />
              </Field>
              <Field label="Pincode">
                <input key={`${selectedCompany.id}-pin`} defaultValue={selectedCompany.pincode} onBlur={(e) => updateCompanyField({ pincode: e.target.value })} className={INPUT_CLS} />
              </Field>
            </div>
          </SectionCard>
        )}

        {activeTab === 'security' && (
          <SectionCard title="Security">
            <LocalStateNotice />
            <ToggleRow label="Two-Factor Authentication" on={local.security.twoFactorEnabled} onChange={() => updateLocal('security', { twoFactorEnabled: !local.security.twoFactorEnabled })} />
            <ToggleRow label="Auto Logout" on={local.security.autoLogoutEnabled} onChange={() => updateLocal('security', { autoLogoutEnabled: !local.security.autoLogoutEnabled })} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Session Timeout (minutes)">
                <input type="number" min={1} value={local.security.sessionTimeoutMinutes} onChange={(e) => updateLocal('security', { sessionTimeoutMinutes: Number(e.target.value) })} className={INPUT_CLS} />
              </Field>
              <Field label="Login Attempts Allowed">
                <input type="number" min={1} value={local.security.loginAttemptsAllowed} onChange={(e) => updateLocal('security', { loginAttemptsAllowed: Number(e.target.value) })} className={INPUT_CLS} />
              </Field>
            </div>
          </SectionCard>
        )}

        {activeTab === 'authentication' && (
          <SectionCard title="Authentication">
            <LocalStateNotice />
            <ToggleRow label="Allow Self Registration" on={local.authentication.allowSelfRegistration} onChange={() => updateLocal('authentication', { allowSelfRegistration: !local.authentication.allowSelfRegistration })} />
            <ToggleRow label="Require Email Verification" on={local.authentication.requireEmailVerification} onChange={() => updateLocal('authentication', { requireEmailVerification: !local.authentication.requireEmailVerification })} />
            <ToggleRow label="Single Sign-On (SSO)" on={local.authentication.ssoEnabled} onChange={() => updateLocal('authentication', { ssoEnabled: !local.authentication.ssoEnabled })} />
          </SectionCard>
        )}

        {activeTab === 'passwordPolicy' && (
          <SectionCard title="Password Policy">
            <LocalStateNotice />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Password Length (minimum)">
                <input type="number" min={4} value={local.passwordPolicy.minimumLength} onChange={(e) => updateLocal('passwordPolicy', { minimumLength: Number(e.target.value) })} className={INPUT_CLS} />
              </Field>
              <Field label="Password Expiry (days)">
                <input type="number" min={0} value={local.passwordPolicy.expiryDays} onChange={(e) => updateLocal('passwordPolicy', { expiryDays: Number(e.target.value) })} className={INPUT_CLS} />
              </Field>
            </div>
            <ToggleRow label="Force Password Change" hint="Require a new password on next login." on={local.passwordPolicy.forcePasswordChange} onChange={() => updateLocal('passwordPolicy', { forcePasswordChange: !local.passwordPolicy.forcePasswordChange })} />
            <ToggleRow label="Require Uppercase Letter" on={local.passwordPolicy.requireUppercase} onChange={() => updateLocal('passwordPolicy', { requireUppercase: !local.passwordPolicy.requireUppercase })} />
            <ToggleRow label="Require Number" on={local.passwordPolicy.requireNumber} onChange={() => updateLocal('passwordPolicy', { requireNumber: !local.passwordPolicy.requireNumber })} />
            <ToggleRow label="Require Special Character" on={local.passwordPolicy.requireSpecialChar} onChange={() => updateLocal('passwordPolicy', { requireSpecialChar: !local.passwordPolicy.requireSpecialChar })} />
          </SectionCard>
        )}

        {activeTab === 'sessionManagement' && (
          <SectionCard title="Session Management">
            <LocalStateNotice />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Session Timeout (minutes)">
                <input type="number" min={1} value={local.sessionManagement.sessionTimeoutMinutes} onChange={(e) => updateLocal('sessionManagement', { sessionTimeoutMinutes: Number(e.target.value) })} className={INPUT_CLS} />
              </Field>
              <Field label="Max Concurrent Sessions">
                <input type="number" min={1} value={local.sessionManagement.maxConcurrentSessions} onChange={(e) => updateLocal('sessionManagement', { maxConcurrentSessions: Number(e.target.value) })} className={INPUT_CLS} />
              </Field>
            </div>
            <ToggleRow label="Auto Logout on Timeout" on={local.sessionManagement.autoLogoutEnabled} onChange={() => updateLocal('sessionManagement', { autoLogoutEnabled: !local.sessionManagement.autoLogoutEnabled })} />
          </SectionCard>
        )}

        {activeTab === 'branding' && (
          <SectionCard title="Branding" description="Read-only summary — full branding configuration lives in Branding Management.">
            {!selectedCompany ? (
              <p className="text-sm text-slate-400">Select an organization to view its branding.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                {(selectedCompany.logo || typeof brandingSummary.lightLogoUrl === 'string') ? (
                  <img src={selectedCompany.logo || (brandingSummary.lightLogoUrl as string)} alt="" className="h-12 w-20 rounded-lg border border-slate-100 object-contain bg-slate-50 p-1" />
                ) : (
                  <div className="flex h-12 w-20 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-400">
                    {selectedCompany.company_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span
                    className="h-6 w-6 rounded-lg border border-slate-100"
                    style={{ backgroundColor: typeof brandingSummary.primaryColor === 'string' ? brandingSummary.primaryColor : '#4f46e5' }}
                  />
                  <span className="text-xs text-slate-400">Primary Color</span>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${brandingSummary.enableWhiteLabel ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {brandingSummary.enableWhiteLabel ? 'White Label Enabled' : 'Default Branding'}
                </span>
              </div>
            )}
          </SectionCard>
        )}

        {activeTab === 'localization' && (
          <SectionCard title="Localization">
            {selectedCompany && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Timezone">
                  <input key={`${selectedCompany.id}-tz`} defaultValue={selectedCompany.timezone} onBlur={(e) => updateCompanyField({ timezone: e.target.value })} placeholder="e.g. Asia/Kolkata" className={INPUT_CLS} />
                </Field>
                <Field label="Language">
                  <input key={`${selectedCompany.id}-lang`} defaultValue={selectedCompany.language} onBlur={(e) => updateCompanyField({ language: e.target.value })} placeholder="e.g. en" className={INPUT_CLS} />
                </Field>
                <Field label="Currency">
                  <input key={`${selectedCompany.id}-cur`} defaultValue={selectedCompany.currency} onBlur={(e) => updateCompanyField({ currency: e.target.value })} placeholder="e.g. INR" className={INPUT_CLS} />
                </Field>
              </div>
            )}
            <LocalStateNotice />
            <Field label="Date Format">
              <select value={local.dateFormat} onChange={(e) => setLocal((p) => ({ ...p, dateFormat: e.target.value }))} className={INPUT_CLS}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </Field>
          </SectionCard>
        )}

        {activeTab === 'email' && (
          <SectionCard title="Email Settings">
            <LocalStateNotice />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="SMTP Host">
                <input value={local.email.smtpHost} onChange={(e) => updateLocal('email', { smtpHost: e.target.value })} placeholder="smtp.example.com" className={INPUT_CLS} />
              </Field>
              <Field label="SMTP Port">
                <input type="number" value={local.email.smtpPort} onChange={(e) => updateLocal('email', { smtpPort: Number(e.target.value) })} className={INPUT_CLS} />
              </Field>
              <Field label="Username">
                <input value={local.email.username} onChange={(e) => updateLocal('email', { username: e.target.value })} className={INPUT_CLS} />
              </Field>
              <Field label="Password">
                <input type="password" value={local.email.password} onChange={(e) => updateLocal('email', { password: e.target.value })} className={INPUT_CLS} />
              </Field>
              <Field label="Encryption">
                <select value={local.email.encryption} onChange={(e) => updateLocal('email', { encryption: e.target.value as EmailSettings['encryption'] })} className={INPUT_CLS}>
                  <option value="none">None</option>
                  <option value="ssl">SSL</option>
                  <option value="tls">TLS</option>
                </select>
              </Field>
              <Field label="Sender Name">
                <input value={local.email.senderName} onChange={(e) => updateLocal('email', { senderName: e.target.value })} className={INPUT_CLS} />
              </Field>
              <Field label="Sender Email">
                <input value={local.email.senderEmail} onChange={(e) => updateLocal('email', { senderEmail: e.target.value })} className={INPUT_CLS} />
              </Field>
            </div>
            <SecondaryButton onClick={handleTestConnection}>Test Connection</SecondaryButton>
          </SectionCard>
        )}

        {activeTab === 'notifications' && (
          <SectionCard title="Notification Settings" description="System-wide defaults for outgoing notification channels.">
            <LocalStateNotice />
            <ToggleRow label="Email Notifications" on={local.notifications.emailEnabled} onChange={() => updateLocal('notifications', { emailEnabled: !local.notifications.emailEnabled })} />
            <ToggleRow label="SMS Notifications" on={local.notifications.smsEnabled} onChange={() => updateLocal('notifications', { smsEnabled: !local.notifications.smsEnabled })} />
            <ToggleRow label="Push Notifications" on={local.notifications.pushEnabled} onChange={() => updateLocal('notifications', { pushEnabled: !local.notifications.pushEnabled })} />
            <Field label="Digest Frequency">
              <select value={local.notifications.digestFrequency} onChange={(e) => updateLocal('notifications', { digestFrequency: e.target.value as NotificationDefaults['digestFrequency'] })} className={INPUT_CLS}>
                <option value="realtime">Real-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </Field>
          </SectionCard>
        )}

        {activeTab === 'storage' && (
          <SectionCard title="Storage Settings">
            <LocalStateNotice />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Storage Provider">
                <input value={local.storage.provider} onChange={(e) => setLocal((p) => ({ ...p, storage: { ...p.storage, provider: e.target.value } }))} className={INPUT_CLS} />
              </Field>
              <Field label="Storage Quota (GB)">
                <input type="number" min={1} value={local.storage.quotaGb} onChange={(e) => setLocal((p) => ({ ...p, storage: { ...p.storage, quotaGb: Number(e.target.value) } }))} className={INPUT_CLS} />
              </Field>
            </div>
          </SectionCard>
        )}

        {activeTab === 'uploadLimits' && (
          <SectionCard title="Upload Limits">
            <LocalStateNotice />
            <Field label="Max File Size (MB)">
              <input type="number" min={1} value={local.uploadLimits.maxFileSizeMb} onChange={(e) => updateLocal('uploadLimits', { maxFileSizeMb: Number(e.target.value) })} className={INPUT_CLS} />
            </Field>
            <Field label="Allowed Image Types">
              <input value={local.uploadLimits.allowedImageTypes} onChange={(e) => updateLocal('uploadLimits', { allowedImageTypes: e.target.value })} className={INPUT_CLS} />
            </Field>
            <Field label="Allowed Video Types">
              <input value={local.uploadLimits.allowedVideoTypes} onChange={(e) => updateLocal('uploadLimits', { allowedVideoTypes: e.target.value })} className={INPUT_CLS} />
            </Field>
            <Field label="Allowed Document Types">
              <input value={local.uploadLimits.allowedDocumentTypes} onChange={(e) => updateLocal('uploadLimits', { allowedDocumentTypes: e.target.value })} className={INPUT_CLS} />
            </Field>
          </SectionCard>
        )}

        {activeTab === 'backup' && (
          <SectionCard title="Backup Settings">
            <LocalStateNotice />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Backup Frequency">
                <select value={local.backup.frequency} onChange={(e) => updateLocal('backup', { frequency: e.target.value as BackupSettings['frequency'] })} className={INPUT_CLS}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </Field>
              <Field label="Retention Days">
                <input type="number" min={1} value={local.backup.retentionDays} onChange={(e) => updateLocal('backup', { retentionDays: Number(e.target.value) })} className={INPUT_CLS} />
              </Field>
            </div>
            <ToggleRow label="Auto Backup" on={local.backup.autoBackup} onChange={() => updateLocal('backup', { autoBackup: !local.backup.autoBackup })} />
            <p className="text-xs text-slate-400">
              {local.backup.lastBackupAt ? `Last backup: ${new Date(local.backup.lastBackupAt).toLocaleString()}` : 'No backup recorded this session.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton onClick={handleManualBackup} disabled={backingUp}>
                {backingUp ? <IconSpinner className="h-3.5 w-3.5" /> : null} Manual Backup
              </PrimaryButton>
              <DangerButton onClick={handleRestore}>Restore</DangerButton>
            </div>
          </SectionCard>
        )}

        {activeTab === 'performance' && (
          <SectionCard title="Performance Settings">
            <LocalStateNotice />
            <ToggleRow label="Enable Caching" on={local.performance.cacheEnabled} onChange={() => updateLocal('performance', { cacheEnabled: !local.performance.cacheEnabled })} />
            <Field label="Cache TTL (minutes)">
              <input type="number" min={1} value={local.performance.cacheTtlMinutes} onChange={(e) => updateLocal('performance', { cacheTtlMinutes: Number(e.target.value) })} className={INPUT_CLS} />
            </Field>
            <ToggleRow label="Lazy Loading" on={local.performance.lazyLoading} onChange={() => updateLocal('performance', { lazyLoading: !local.performance.lazyLoading })} />
          </SectionCard>
        )}

        {activeTab === 'maintenance' && (
          <SectionCard title="Maintenance Mode">
            <LocalStateNotice />
            <ToggleRow label="Maintenance Mode" hint="Learners see a maintenance page instead of the app." on={local.maintenance.maintenanceMode} onChange={() => updateLocal('maintenance', { maintenanceMode: !local.maintenance.maintenanceMode })} />
            <ToggleRow label="Read Only Mode" hint="Disables all write actions across the app." on={local.maintenance.readOnlyMode} onChange={() => updateLocal('maintenance', { readOnlyMode: !local.maintenance.readOnlyMode })} />
            <Field label="Maintenance Message">
              <textarea value={local.maintenance.maintenanceMessage} onChange={(e) => updateLocal('maintenance', { maintenanceMessage: e.target.value })} rows={3} className={`${INPUT_CLS} resize-none`} />
            </Field>
          </SectionCard>
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

export default SystemSettings;