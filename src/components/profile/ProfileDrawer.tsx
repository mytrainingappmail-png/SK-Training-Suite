import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuthorization }  from '../../hooks/useAuthorization';
import { loadCompanies }      from '../../services/company/companyService';
import { branchService }      from '../../services/branch/branchService';
import { departmentService }  from '../../services/department/departmentService';
import { designationService } from '../../services/designation/designationService';
import { loadRoles }          from '../../services/role/roleService';
import { updateEmployee }     from '../../repositories/employee/employeeRepository';
import { supabase }           from '../../lib/supabase';

import type { Company }     from '../../types/company';
import type { Branch }      from '../../types/branch';
import type { Department }  from '../../types/department';
import type { Designation } from '../../types/designation';
import type { Role }        from '../../types/role';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfileDrawerProps {
  open:    boolean;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

const CLS_INPUT =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:bg-slate-50';

const CLS_READONLY =
  'w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 cursor-default';

function FL({
  label,
  required,
  error,
  children,
}: {
  label:     string;
  required?: boolean;
  error?:    string;
  children:  React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
      {title}
    </p>
  );
}

function Divider() {
  return <div className="my-6 border-t border-slate-100" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfileDrawer
// ─────────────────────────────────────────────────────────────────────────────

function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const { user } = useAuthorization();

  // ── Profile form ──────────────────────────────────────────────────────────
  const [firstName,    setFirstName]    = useState('');
  const [lastName,     setLastName]     = useState('');
  const [email,        setEmail]        = useState('');
  const [mobile,       setMobile]       = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [profileErrors, setProfileErrors] = useState<{
    firstName?: string;
    lastName?:  string;
    email?:     string;
    mobile?:    string;
  }>({});

  // ── Password form ─────────────────────────────────────────────────────────
  const [currentPassword,  setCurrentPassword]  = useState('');
  const [newPassword,      setNewPassword]       = useState('');
  const [confirmPassword,  setConfirmPassword]   = useState('');
  const [showCurrent,      setShowCurrent]       = useState(false);
  const [showNew,          setShowNew]           = useState(false);
  const [showConfirm,      setShowConfirm]       = useState(false);

  const [passwordErrors, setPasswordErrors] = useState<{
    currentPassword?:  string;
    newPassword?:      string;
    confirmPassword?:  string;
  }>({});

  const [profileBanner,  setProfileBanner]  = useState<string | null>(null);
  const [passwordBanner, setPasswordBanner] = useState<string | null>(null);

  // ── Lookup data ───────────────────────────────────────────────────────────
  const [companies,    setCompanies]    = useState<Company[]>([]);
  const [branches,     setBranches]     = useState<Branch[]>([]);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [roles,        setRoles]        = useState<Role[]>([]);

  // ── Load lookups once ─────────────────────────────────────────────────────
  const loadLookups = useCallback(async () => {
    try {
      const [co, br, de, di, ro] = await Promise.all([
        loadCompanies(),
        branchService.getAll(),
        departmentService.getAll(),
        designationService.getAll(),
        loadRoles(),
      ]);
      setCompanies(co);
      setBranches(br);
      setDepartments(de);
      setDesignations(di);
      setRoles(ro);
    } catch (err) {
      console.error('[ProfileDrawer] loadLookups:', err);
    }
  }, []);


  // ── Seed form from session user ───────────────────────────────────────────
  useEffect(() => {
    if (open && user) {
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName  ?? '');
      setEmail(user.email        ?? '');
      setMobile(user.mobile      ?? '');
      setPhotoPreview(user.profileImage || null);
      setProfileErrors({});
      setPasswordErrors({});
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setProfileBanner(null);
      setPasswordBanner(null);
      loadLookups();
    }
  }, [open, user, loadLookups]);

  // ── Scroll lock ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // ── ESC to close ──────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // ── Photo upload ──────────────────────────────────────────────────────────
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  // ── Validate profile ──────────────────────────────────────────────────────
  function validateProfile(): boolean {
    const errs: typeof profileErrors = {};
    if (!firstName.trim())  errs.firstName = 'First Name is required.';
    if (!lastName.trim())   errs.lastName  = 'Last Name is required.';
    if (!email.trim()) {
      errs.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Enter a valid email address.';
    }
    if (mobile.trim() && mobile.trim().length < 7) {
      errs.mobile = 'Mobile number must be at least 7 digits.';
    }
    setProfileErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Validate password ─────────────────────────────────────────────────────
  function validatePassword(): boolean {
    const errs: typeof passwordErrors = {};
    if (!currentPassword) errs.currentPassword = 'Current password is required.';
    if (!newPassword)     errs.newPassword      = 'New password is required.';
    else if (newPassword.length < 8) errs.newPassword = 'Password must be at least 8 characters.';
    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your new password.';
    } else if (newPassword !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }
    setPasswordErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleSave() {
    setProfileBanner(null);
    if (!validateProfile()) return;
    if (!user) return;

    try {
      await updateEmployee(user.id, {
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        email:      email.trim(),
        mobile:     mobile.trim(),
      });
      setProfileBanner('Profile updated successfully.');
    } catch (err) {
      setProfileBanner(
        err instanceof Error ? err.message : 'Failed to update profile.'
      );
    } finally {
      }
  }
  async function handleChangePassword() {
    setPasswordBanner(null);

if (!validatePassword()) return;

if (!user) return;
    setPasswordBanner(null);
    if (!user) return;

    // Client-side validation
   
    try {
      // Fetch current password from DB
      const { data: emp, error: fetchErr } = await supabase
        .from('employees')
        .select('password')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchErr || !emp) {
        setPasswordBanner('Failed to verify current password.');
        return;
      }
      if (emp.password !== currentPassword) {
        setPasswordErrors({ currentPassword: 'Current password is incorrect.' });
        return;
      }
      if (currentPassword === newPassword) {
        setPasswordErrors({ newPassword: 'New password must differ from current password.' });
        return;
      }

      // Update password and timestamp
      const { error: updateErr } = await supabase
        .from('employees')
        .update({
          password:             newPassword,
          password_changed_at:  new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateErr) {
        setPasswordBanner('Failed to change password. Please try again.');
        return;
      }

      setPasswordBanner('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordBanner(
        err instanceof Error ? err.message : 'An unexpected error occurred.'
      );
    } finally {
      }
  }

  // ── Read-only display values (resolved from lookup arrays) ──────────────────
  const employeeCode   = user?.employeeId ?? '—';
  const companyId      = companies   .find(c => c.id === user?.companyId)     ?.company_name      ?? user?.companyId      ?? '—';
  const branchId       = branches    .find(b => b.id === user?.branchId)      ?.branch_name       ?? user?.branchId       ?? '—';
  const departmentId   = departments .find(d => d.id === user?.departmentId)  ?.department_name   ?? user?.departmentId   ?? '—';
  const designationId  = designations.find(d => d.id === user?.designationId) ?.designation_name  ?? user?.designationId  ?? '—';
  const roleId         = roles       .find(r => r.id === user?.roleId)        ?.role_name         ?? user?.roleId         ?? '—';

  const initials =
    [(user?.firstName?.[0] ?? ''), (user?.lastName?.[0] ?? '')]
      .filter(Boolean).join('').toUpperCase() || 'U';

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="User Profile"
        className={`fixed right-0 top-0 z-50 flex h-full w-[480px] max-w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >

        {/* ── Drawer header ── */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">User Profile</h2>
            <p className="text-sm text-slate-500">View and update your account details</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close profile drawer"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* ── Section 1: Profile photo ── */}
          <SectionTitle title="Profile Photo" />
          <div className="flex items-center gap-5">
            <div className="relative">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Profile"
                  className="h-20 w-20 rounded-2xl object-cover ring-2 ring-slate-200"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900 text-xl font-bold text-white ring-2 ring-slate-200 select-none">
                  {initials}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-95"
              >
                Upload Photo
              </button>
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => { setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = ''; }}
                  className="text-xs text-red-500 hover:underline text-left"
                >
                  Remove
                </button>
              )}
              <p className="text-xs text-slate-400">JPG, PNG or GIF — max 2 MB</p>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          <Divider />

          {/* ── Section 2: Editable fields ── */}
          <SectionTitle title="Personal Information" />

          {profileBanner && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {profileBanner}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FL label="First Name" required error={profileErrors.firstName}>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setProfileErrors((p) => ({ ...p, firstName: undefined })); }}
                  placeholder="First name"
                  className={CLS_INPUT}
                />
              </FL>
              <FL label="Last Name" required error={profileErrors.lastName}>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); setProfileErrors((p) => ({ ...p, lastName: undefined })); }}
                  placeholder="Last name"
                  className={CLS_INPUT}
                />
              </FL>
            </div>
            <FL label="Email" required error={profileErrors.email}>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setProfileErrors((p) => ({ ...p, email: undefined })); }}
                placeholder="email@example.com"
                className={CLS_INPUT}
              />
            </FL>
            <FL label="Mobile" error={profileErrors.mobile}>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => { setMobile(e.target.value); setProfileErrors((p) => ({ ...p, mobile: undefined })); }}
                placeholder="+91 9876543210"
                className={CLS_INPUT}
              />
            </FL>
          </div>

          <Divider />

          {/* ── Section 3: Read-only identity ── */}
          <SectionTitle title="Account Information" />
          <div className="space-y-3">
            {[
              { label: 'Employee Code', value: employeeCode },
              { label: 'Company',       value: companyId    },
              { label: 'Branch',        value: branchId     },
              { label: 'Department',    value: departmentId },
              { label: 'Designation',   value: designationId },
              { label: 'Role',          value: roleId       },
              { label: 'Joining Date', value: '—' },
            ].map(({ label, value }) => (
              <div key={label} className="grid grid-cols-[160px_1fr] items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
                <div className={CLS_READONLY}>{value}</div>
              </div>
            ))}
          </div>

          <Divider />

          {/* ── Section 4: Change password ── */}
          <SectionTitle title="Change Password" />

          {passwordBanner && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {passwordBanner}
            </div>
          )}

          <div className="space-y-4">
            {/* Current password */}
            <FL label="Current Password" required error={passwordErrors.currentPassword}>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); setPasswordErrors((p) => ({ ...p, currentPassword: undefined })); }}
                  placeholder="Current password"
                  autoComplete="current-password"
                  className={`${CLS_INPUT} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  aria-label={showCurrent ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                >
                  <EyeIcon open={showCurrent} />
                </button>
              </div>
            </FL>

            {/* New password */}
            <FL label="New Password" required error={passwordErrors.newPassword}>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPasswordErrors((p) => ({ ...p, newPassword: undefined })); }}
                  placeholder="New password (min. 8 characters)"
                  autoComplete="new-password"
                  className={`${CLS_INPUT} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                >
                  <EyeIcon open={showNew} />
                </button>
              </div>
            </FL>

            {/* Confirm password */}
            <FL label="Confirm New Password" required error={passwordErrors.confirmPassword}>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPasswordErrors((p) => ({ ...p, confirmPassword: undefined })); }}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className={`${CLS_INPUT} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </FL>
          </div>

        </div>

        {/* ── Sticky footer ── */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-95"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleChangePassword}
              className="rounded-xl border border-slate-800 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 active:scale-95"
            >
              Change Password
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(to right, #D4AF37, #D4AF37CC)' }}
            >
              Save Profile
            </button>
          </div>
        </div>

      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Eye icon sub-component
// ─────────────────────────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 9.966 7.5a10.45 10.45 0 0 0 4.293-.917m3.243-2.158a10.45 10.45 0 0 0 2.564-3.425c-1.292-4.338-5.31-7.5-9.966-7.5a10.45 10.45 0 0 0-4.293.917m7.853 7.853a3 3 0 1 0-4.243-4.243m4.243 4.243L19 19m-7.853-7.853L3 3" />
    </svg>
  ) : (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

export default ProfileDrawer;