import { useCallback, useEffect, useRef, useState } from "react";

import { branchService } from "../../services/branch/branchService";
import { loadCompanies } from "../../services/company/companyService";

import type { Branch, BranchForm } from "../../types/branch";
import type { Company } from "../../types/company";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: BranchForm = {
  company_id: "",
  branch_code: "",
  branch_name: "",
  contact_person: "",
  address: "",
  city: "",
  state: "",
  country: "",
  pincode: "",
  phone: "",
  email: "",
  head_office: false,
  active: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCompanyName(companies: Company[], id: string): string {
  return companies.find((c) => c.id === id)?.company_name ?? "—";
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

interface BadgeProps {
  active: boolean;
  label?: [string, string];
}

function StatusBadge({ active, label = ["Active", "Inactive"] }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {active ? label[0] : label[1]}
    </span>
  );
}

interface ToggleProps {
  enabled: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  ariaLabel: string;
}

function Toggle({ enabled, disabled = false, onChange, ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${
        enabled ? "bg-yellow-500" : "bg-slate-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
          enabled ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

function FormField({ label, required, error, children }: FormFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:bg-slate-50";

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-1">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-10 w-8 rounded bg-slate-100" />
          <div className="h-10 flex-1 rounded bg-slate-100" />
          <div className="h-10 w-28 rounded bg-slate-100" />
          <div className="h-10 w-24 rounded bg-slate-100" />
          <div className="h-10 w-24 rounded bg-slate-100" />
          <div className="h-10 w-20 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  search: string;
  onAdd: () => void;
}

function EmptyState({ search, onAdd }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <svg
          className="h-8 w-8 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
          />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No branches found" : "No branches yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search
          ? `No results for "${search}". Try a different keyword.`
          : "Add your first branch to get started."}
      </p>
      {!search && (
        <button
          onClick={onAdd}
          className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
        >
          Add Branch
        </button>
      )}
    </div>
  );
}

// ─── View Details Modal ────────────────────────────────────────────────────────

interface BranchViewModalProps {
  branch: Branch;
  companies: Company[];
  onClose: () => void;
}

function BranchViewModal({ branch, companies, onClose }: BranchViewModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // A single read-only field row used throughout the detail grid
  function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span className="text-sm font-medium text-slate-800">
          {value || <span className="text-slate-400">—</span>}
        </span>
      </div>
    );
  }

  const location = [branch.city, branch.state, branch.country, branch.pincode]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="branch-view-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100">
              <svg
                className="h-5 w-5 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
                />
              </svg>
            </div>
            <div>
              <h2
                id="branch-view-title"
                className="text-lg font-semibold text-slate-800"
              >
                {branch.branch_name}
              </h2>
              <p className="text-sm text-slate-500">{branch.branch_code}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {branch.head_office && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-medium text-yellow-700 ring-1 ring-yellow-200">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Head Office
              </span>
            )}
            <StatusBadge active={branch.active} />
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              className="ml-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-6 p-6">

          {/* Identity */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Identity
            </p>
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">
              <DetailRow label="Branch Name" value={branch.branch_name} />
              <DetailRow label="Branch Code" value={branch.branch_code} />
              <DetailRow
                label="Company"
                value={getCompanyName(companies, branch.company_id)}
              />
              <DetailRow label="Contact Person" value={branch.contact_person} />
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Contact
            </p>
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">
              <DetailRow
                label="Email"
                value={
                  branch.email ? (
                    <a
                      href={`mailto:${branch.email}`}
                      className="text-blue-600 hover:underline"
                    >
                      {branch.email}
                    </a>
                  ) : null
                }
              />
              <DetailRow
                label="Phone"
                value={
                  branch.phone ? (
                    <a
                      href={`tel:${branch.phone}`}
                      className="text-blue-600 hover:underline"
                    >
                      {branch.phone}
                    </a>
                  ) : null
                }
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Location
            </p>
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <DetailRow label="Address" value={branch.address} />
              </div>
              <DetailRow label="City" value={branch.city} />
              <DetailRow label="State" value={branch.state} />
              <DetailRow label="Country" value={branch.country} />
              <DetailRow label="Pincode" value={branch.pincode} />
              {location && (
                <div className="sm:col-span-2">
                  <DetailRow label="Full Location" value={location} />
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Status
            </p>
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">
              <DetailRow
                label="Head Office"
                value={
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      branch.head_office
                        ? "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200"
                        : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        branch.head_office ? "bg-yellow-500" : "bg-slate-400"
                      }`}
                    />
                    {branch.head_office ? "Yes" : "No"}
                  </span>
                }
              />
              <DetailRow
                label="Active Status"
                value={<StatusBadge active={branch.active} />}
              />
            </div>
          </div>

          {/* Audit */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Audit
            </p>
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">
              <DetailRow label="Created At" value={formatDateTime(branch.created_at)} />
              <DetailRow label="Updated At" value={formatDateTime(branch.updated_at)} />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Delete Confirmation Dialog ────────────────────────────────────────────────

interface DeleteDialogProps {
  branch: Branch;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function DeleteDialog({ branch, deleting, onConfirm, onClose }: DeleteDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleting) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleting, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!deleting ? onClose : undefined}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h3
          id="delete-dialog-title"
          className="mb-1 text-lg font-semibold text-slate-800"
        >
          Delete Branch
        </h3>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-slate-700">{branch.branch_name}</span>?
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={deleting}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 active:scale-95"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add / Edit Form Modal ─────────────────────────────────────────────────────

interface BranchFormModalProps {
  branch: Branch | null;
  companies: Company[];
  saving: boolean;
  onSave: (data: BranchForm) => void;
  onClose: () => void;
}

interface FormErrors {
  company_id?: string;
  branch_code?: string;
  branch_name?: string;
  email?: string;
}

function BranchFormModal({
  branch,
  companies,
  saving,
  onSave,
  onClose,
}: BranchFormModalProps) {
  const [form, setForm] = useState<BranchForm>(
    branch
      ? {
          company_id: branch.company_id,
          branch_code: branch.branch_code,
          branch_name: branch.branch_name,
          contact_person: branch.contact_person,
          address: branch.address,
          city: branch.city,
          state: branch.state,
          country: branch.country,
          pincode: branch.pincode,
          phone: branch.phone,
          email: branch.email,
          head_office: branch.head_office,
          active: branch.active,
        }
      : { ...EMPTY_FORM }
  );

  const [errors, setErrors] = useState<FormErrors>({});
  const firstInputRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [saving, onClose]);

  function set<K extends keyof BranchForm>(key: K, value: BranchForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!form.company_id) next.company_id = "Company is required.";
    if (!form.branch_code.trim()) next.branch_code = "Branch Code is required.";
    if (!form.branch_name.trim()) next.branch_name = "Branch Name is required.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email address.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!validate()) return;
    onSave(form);
  }

  const isEdit = branch !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="branch-form-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!saving ? onClose : undefined}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2
              id="branch-form-title"
              className="text-lg font-semibold text-slate-800"
            >
              {isEdit ? "Edit Branch" : "Add Branch"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update branch details." : "Fill in the branch details below."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5 p-6">

            {/* Company */}
            <FormField label="Company" required error={errors.company_id}>
              <select
                ref={firstInputRef}
                value={form.company_id}
                onChange={(e) => set("company_id", e.target.value)}
                disabled={saving}
                className={inputClass}
              >
                <option value="">— Select Company —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Code + Name */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FormField label="Branch Code" required error={errors.branch_code}>
                <input
                  type="text"
                  value={form.branch_code}
                  onChange={(e) => set("branch_code", e.target.value)}
                  placeholder="e.g. BRN-001"
                  maxLength={20}
                  disabled={saving}
                  className={inputClass}
                />
              </FormField>

              <FormField label="Branch Name" required error={errors.branch_name}>
                <input
                  type="text"
                  value={form.branch_name}
                  onChange={(e) => set("branch_name", e.target.value)}
                  placeholder="e.g. Mumbai Head Office"
                  maxLength={150}
                  disabled={saving}
                  className={inputClass}
                />
              </FormField>
            </div>

            {/* Contact Person */}
            <FormField label="Contact Person">
              <input
                type="text"
                value={form.contact_person}
                onChange={(e) => set("contact_person", e.target.value)}
                placeholder="Full name"
                maxLength={150}
                disabled={saving}
                className={inputClass}
              />
            </FormField>

            {/* Phone + Email */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FormField label="Phone">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+91 98765 43210"
                  maxLength={30}
                  disabled={saving}
                  className={inputClass}
                />
              </FormField>

              <FormField label="Email" error={errors.email}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="branch@company.com"
                  maxLength={150}
                  disabled={saving}
                  className={inputClass}
                />
              </FormField>
            </div>

            {/* Address */}
            <FormField label="Address">
              <textarea
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Street address"
                rows={2}
                disabled={saving}
                className={`${inputClass} resize-none`}
              />
            </FormField>

            {/* City / State / Country / Pincode */}
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <FormField label="City">
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="City"
                  maxLength={100}
                  disabled={saving}
                  className={inputClass}
                />
              </FormField>

              <FormField label="State">
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                  placeholder="State"
                  maxLength={100}
                  disabled={saving}
                  className={inputClass}
                />
              </FormField>

              <FormField label="Country">
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => set("country", e.target.value)}
                  placeholder="Country"
                  maxLength={100}
                  disabled={saving}
                  className={inputClass}
                />
              </FormField>

              <FormField label="Pincode">
                <input
                  type="text"
                  value={form.pincode}
                  onChange={(e) => set("pincode", e.target.value)}
                  placeholder="400001"
                  maxLength={20}
                  disabled={saving}
                  className={inputClass}
                />
              </FormField>
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <Toggle
                  enabled={form.head_office}
                  disabled={saving}
                  onChange={(v) => set("head_office", v)}
                  ariaLabel="Head Office"
                />
                <div>
                  <p className="text-sm font-medium text-slate-700">Head Office</p>
                  <p className="text-xs text-slate-500">Mark as the primary office</p>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3">
                <Toggle
                  enabled={form.active}
                  disabled={saving}
                  onChange={(v) => set("active", v)}
                  ariaLabel="Active Status"
                />
                <div>
                  <p className="text-sm font-medium text-slate-700">Active</p>
                  <p className="text-xs text-slate-500">Branch is operational</p>
                </div>
              </label>
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:opacity-50 active:scale-95"
            >
              {saving ? "Saving…" : isEdit ? "Update Branch" : "Add Branch"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

// ─── Branch Table ──────────────────────────────────────────────────────────────

interface BranchTableProps {
  branches: Branch[];
  companies: Company[];
  togglingId: string | null;
  onView: (branch: Branch) => void;
  onEdit: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
  onToggleStatus: (branch: Branch) => void;
  onToggleHeadOffice: (branch: Branch) => void;
}

function BranchTable({
  branches,
  companies,
  togglingId,
  onView,
  onEdit,
  onDelete,
  onToggleStatus,
  onToggleHeadOffice,
}: BranchTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Branch
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Company
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Location
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
              Head Office
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {branches.map((branch, index) => {
            const isToggling = togglingId === branch.id;
            const rowBusy = isToggling;

            return (
              <tr key={branch.id} className="transition hover:bg-slate-50/60">
                <td className="px-4 py-3 text-slate-400">{index + 1}</td>

                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{branch.branch_name}</p>
                  <p className="text-xs text-slate-400">{branch.branch_code}</p>
                  {branch.contact_person && (
                    <p className="text-xs text-slate-400">{branch.contact_person}</p>
                  )}
                </td>

                <td className="px-4 py-3">
                  <span className="text-slate-600">
                    {getCompanyName(companies, branch.company_id)}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <p className="text-slate-700">
                    {[branch.city, branch.state, branch.country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                  {branch.phone && (
                    <p className="text-xs text-slate-400">{branch.phone}</p>
                  )}
                </td>

                <td className="px-4 py-3 text-center">
                  <Toggle
                    enabled={branch.head_office}
                    disabled={isToggling}
                    onChange={() => onToggleHeadOffice(branch)}
                    ariaLabel="Toggle head office"
                  />
                </td>

                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onToggleStatus(branch)}
                    disabled={isToggling}
                    className="disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Toggle status"
                  >
                    <StatusBadge active={branch.active} />
                  </button>
                </td>

                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">

                    {/* View Details */}
                    <button
                      onClick={() => onView(branch)}
                      disabled={rowBusy}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="View branch details"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                        />
                      </svg>
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => onEdit(branch)}
                      disabled={rowBusy}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Edit branch"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                        />
                      </svg>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => onDelete(branch)}
                      disabled={rowBusy}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Delete branch"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </button>

                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

type ModalState =
  | { type: "view"; branch: Branch }
  | { type: "form"; branch: Branch | null }
  | { type: "delete"; branch: Branch }
  | null;

function BranchManagement() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filteredBranches, setFilteredBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState<ModalState>(null);

  // Focus restoration: capture the active element when a modal opens
  // so closeModal() can return focus to it after unmount.
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const modalOpenerRef = useRef<Element | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [branchData, companyData] = await Promise.all([
        branchService.getAll(),
        loadCompanies(),
      ]);

      setBranches(branchData);
      setCompanies(companyData);
    } catch (err) {
      console.error(err);
      setError("Failed to load branch data. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Search filter — sole source of truth for filteredBranches ─────────────

  useEffect(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      setFilteredBranches(branches);
      return;
    }

    setFilteredBranches(
      branches.filter(
        (b) =>
          b.branch_name.toLowerCase().includes(keyword) ||
          b.branch_code.toLowerCase().includes(keyword) ||
          b.city.toLowerCase().includes(keyword) ||
          b.state.toLowerCase().includes(keyword) ||
          b.email.toLowerCase().includes(keyword)
      )
    );
  }, [search, branches]);

  // ── Close modal + restore focus ───────────────────────────────────────────

  function closeModal() {
    setModal(null);
    setTimeout(() => {
      const opener = modalOpenerRef.current;
      modalOpenerRef.current = null;
      if (opener instanceof HTMLElement) {
        opener.focus();
      } else {
        addBtnRef.current?.focus();
      }
    }, 0);
  }

  function openModal(next: ModalState) {
    modalOpenerRef.current = document.activeElement;
    setModal(next);
  }

  // ── Save (create / update) ────────────────────────────────────────────────

  async function handleSave(data: BranchForm) {
    setSaving(true);

    try {
      const editingBranch = modal?.type === "form" ? modal.branch : null;

      if (editingBranch) {
        await branchService.update(editingBranch.id, data);
      } else {
        await branchService.create(data);
      }

      await loadData();
      setError("");
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save branch.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (modal?.type !== "delete") return;

    setDeleting(true);

    try {
      await branchService.delete(modal.branch.id);
      await loadData();
      setError("");
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete branch.";
      setError(message);
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle Status ─────────────────────────────────────────────────────────

  async function handleToggleStatus(branch: Branch) {
    setTogglingId(branch.id);

    try {
      await branchService.setStatus(branch.id, !branch.active);

      setBranches((prev) =>
        prev.map((b) =>
          b.id === branch.id ? { ...b, active: !branch.active } : b
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update status.";
      setError(message);
    } finally {
      setTogglingId(null);
    }
  }

  // ── Toggle Head Office ────────────────────────────────────────────────────

  async function handleToggleHeadOffice(branch: Branch) {
    setTogglingId(branch.id);

    const nextValue = !branch.head_office;

    try {
      await branchService.setHeadOffice(branch.id, nextValue);

      if (nextValue) {
        await loadData();
      } else {
        setBranches((prev) =>
          prev.map((b) =>
            b.id === branch.id ? { ...b, head_office: false } : b
          )
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to update head office.";
      setError(message);
    } finally {
      setTogglingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Branch Management</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage all company branches across locations.
          </p>
        </div>

        <button
          ref={addBtnRef}
          onClick={() => openModal({ type: "form", branch: null })}
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Branch
        </button>
      </div>

      {/* Search + Summary */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-4">
        <div className="relative flex-1 min-w-[240px]">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, city, email…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-yellow-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {!loading && (
          <p className="text-sm text-slate-400">
            {filteredBranches.length}{" "}
            {filteredBranches.length === 1 ? "branch" : "branches"}
            {search && " found"}
          </p>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
          <div className="flex-1">
            <p>{error}</p>
          </div>
          <button
            onClick={() => setError("")}
            className="text-red-400 hover:text-red-600"
            aria-label="Dismiss error"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Content */}
      <div className="px-6 pb-6">
        {loading ? (
          <TableSkeleton />
        ) : filteredBranches.length === 0 ? (
          <EmptyState
            search={search}
            onAdd={() => openModal({ type: "form", branch: null })}
          />
        ) : (
          <BranchTable
            branches={filteredBranches}
            companies={companies}
            togglingId={togglingId}
            onView={(branch) => openModal({ type: "view", branch })}
            onEdit={(branch) => openModal({ type: "form", branch })}
            onDelete={(branch) => openModal({ type: "delete", branch })}
            onToggleStatus={handleToggleStatus}
            onToggleHeadOffice={handleToggleHeadOffice}
          />
        )}
      </div>

      {/* View Details Modal */}
      {modal?.type === "view" && (
        <BranchViewModal
          branch={modal.branch}
          companies={companies}
          onClose={closeModal}
        />
      )}

      {/* Add / Edit Modal */}
      {modal?.type === "form" && (
        <BranchFormModal
          branch={modal.branch}
          companies={companies}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {/* Delete Confirmation */}
      {modal?.type === "delete" && (
        <DeleteDialog
          branch={modal.branch}
          deleting={deleting}
          onConfirm={handleDelete}
          onClose={closeModal}
        />
      )}

    </div>
  );
}

export default BranchManagement;

// FILE COMPLETE
