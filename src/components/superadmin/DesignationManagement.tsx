import { useCallback, useEffect, useRef, useState } from "react";

import { designationService } from "../../services/designation/designationService";
import { loadCompanies } from "../../services/company/companyService";
import { branchService } from "../../services/branch/branchService";
import { departmentService } from "../../services/department/departmentService";

import type { Designation, DesignationForm } from "../../types/designation";
import type { Company } from "../../types/company";
import type { Branch } from "../../types/branch";
import type { Department } from "../../types/department";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: DesignationForm = {
  company_id: "",
  branch_id: "",
  department_id: "",
  designation_code: "",
  designation_name: "",
  description: "",
  hierarchy_level: 1,
  active: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCompanyName(companies: Company[], id: string): string {
  return companies.find((c) => c.id === id)?.company_name ?? "—";
}

function getBranchName(branches: Branch[], id: string): string {
  return branches.find((b) => b.id === id)?.branch_name ?? "—";
}

function getDepartmentName(departments: Department[], id: string): string {
  return departments.find((d) => d.id === id)?.department_name ?? "—";
}

// ─── Shared UI Primitives ─────────────────────────────────────────────────────

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
            d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
          />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No designations found" : "No designations yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search
          ? `No results for "${search}". Try a different keyword.`
          : "Add your first designation to get started."}
      </p>
      {!search && (
        <button
          onClick={onAdd}
          className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
        >
          Add Designation
        </button>
      )}
    </div>
  );
}

// ─── Delete Confirmation Dialog ────────────────────────────────────────────────

interface DeleteDialogProps {
  designation: Designation;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function DeleteDialog({
  designation,
  deleting,
  onConfirm,
  onClose,
}: DeleteDialogProps) {
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
          Delete Designation
        </h3>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-slate-700">
            {designation.designation_name}
          </span>
          ? This action cannot be undone.
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

interface DesignationFormModalProps {
  designation: Designation | null;
  companies: Company[];
  branches: Branch[];
  departments: Department[];
  saving: boolean;
  onSave: (data: DesignationForm) => void;
  onClose: () => void;
}

interface FormErrors {
  company_id?: string;
  branch_id?: string;
  department_id?: string;
  designation_code?: string;
  designation_name?: string;
  hierarchy_level?: string;
}

function DesignationFormModal({
  designation,
  companies,
  branches,
  departments,
  saving,
  onSave,
  onClose,
}: DesignationFormModalProps) {
  const [form, setForm] = useState<DesignationForm>(
    designation
      ? {
          company_id: designation.company_id,
          branch_id: designation.branch_id,
          department_id: designation.department_id,
          designation_code: designation.designation_code,
          designation_name: designation.designation_name,
          description: designation.description,
          hierarchy_level: designation.hierarchy_level,
          active: designation.active,
        }
      : { ...EMPTY_FORM }
  );

  const [errors, setErrors] = useState<FormErrors>({});
  const firstInputRef = useRef<HTMLSelectElement>(null);

  // Cascading filtered lists
  const filteredBranches = branches.filter(
    (b) => b.company_id === form.company_id
  );
  const filteredDepartments = departments.filter(
    (d) => d.branch_id === form.branch_id
  );

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

  function set<K extends keyof DesignationForm>(
    key: K,
    value: DesignationForm[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleCompanyChange(value: string) {
    setForm((prev) => ({
      ...prev,
      company_id: value,
      branch_id: "",
      department_id: "",
    }));
    setErrors((prev) => ({
      ...prev,
      company_id: undefined,
      branch_id: undefined,
      department_id: undefined,
    }));
  }

  function handleBranchChange(value: string) {
    setForm((prev) => ({ ...prev, branch_id: value, department_id: "" }));
    setErrors((prev) => ({
      ...prev,
      branch_id: undefined,
      department_id: undefined,
    }));
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!form.company_id) next.company_id = "Company is required.";
    if (!form.branch_id) next.branch_id = "Branch is required.";
    if (!form.department_id) next.department_id = "Department is required.";
    if (!form.designation_code.trim())
      next.designation_code = "Designation Code is required.";
    if (!form.designation_name.trim())
      next.designation_name = "Designation Name is required.";
    if (
      form.hierarchy_level === undefined ||
      form.hierarchy_level === null ||
      isNaN(Number(form.hierarchy_level))
    ) {
      next.hierarchy_level = "Hierarchy Level is required.";
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

  const isEdit = designation !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="desig-form-title"
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
              id="desig-form-title"
              className="text-lg font-semibold text-slate-800"
            >
              {isEdit ? "Edit Designation" : "Add Designation"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit
                ? "Update designation details."
                : "Fill in the designation details below."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
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
                onChange={(e) => handleCompanyChange(e.target.value)}
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

            {/* Branch */}
            <FormField label="Branch" required error={errors.branch_id}>
              <select
                value={form.branch_id}
                onChange={(e) => handleBranchChange(e.target.value)}
                disabled={saving || !form.company_id}
                className={inputClass}
              >
                <option value="">
                  {form.company_id
                    ? "— Select Branch —"
                    : "— Select Company first —"}
                </option>
                {filteredBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.branch_name}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Department */}
            <FormField label="Department" required error={errors.department_id}>
              <select
                value={form.department_id}
                onChange={(e) => set("department_id", e.target.value)}
                disabled={saving || !form.branch_id}
                className={inputClass}
              >
                <option value="">
                  {form.branch_id
                    ? "— Select Department —"
                    : "— Select Branch first —"}
                </option>
                {filteredDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.department_name}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Code + Name */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FormField
                label="Designation Code"
                required
                error={errors.designation_code}
              >
                <input
                  type="text"
                  value={form.designation_code}
                  onChange={(e) => set("designation_code", e.target.value)}
                  placeholder="e.g. DSG-001"
                  maxLength={20}
                  disabled={saving}
                  className={inputClass}
                />
              </FormField>

              <FormField
                label="Designation Name"
                required
                error={errors.designation_name}
              >
                <input
                  type="text"
                  value={form.designation_name}
                  onChange={(e) => set("designation_name", e.target.value)}
                  placeholder="e.g. Senior Manager"
                  maxLength={150}
                  disabled={saving}
                  className={inputClass}
                />
              </FormField>
            </div>

            {/* Hierarchy Level */}
            <FormField
              label="Hierarchy Level"
              required
              error={errors.hierarchy_level}
            >
              <input
                type="number"
                min={1}
                value={form.hierarchy_level}
                onChange={(e) =>
                  set("hierarchy_level", Number(e.target.value) || 1)
                }
                placeholder="e.g. 1"
                disabled={saving}
                className={inputClass}
              />
            </FormField>

            {/* Description */}
            <FormField label="Description">
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Optional description"
                rows={3}
                disabled={saving}
                className={`${inputClass} resize-none`}
              />
            </FormField>

            {/* Active Toggle */}
            <div className="flex flex-wrap gap-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.active}
                  aria-label="Active Status"
                  disabled={saving}
                  onClick={() => set("active", !form.active)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${
                    form.active ? "bg-yellow-500" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                      form.active ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <div>
                  <p className="text-sm font-medium text-slate-700">Active</p>
                  <p className="text-xs text-slate-500">
                    Designation is operational
                  </p>
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
              {saving
                ? "Saving…"
                : isEdit
                ? "Update Designation"
                : "Add Designation"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

// ─── Designation Table ─────────────────────────────────────────────────────────

interface DesignationTableProps {
  designations: Designation[];
  companies: Company[];
  branches: Branch[];
  departments: Department[];
  togglingId: string | null;
  onEdit: (designation: Designation) => void;
  onDelete: (designation: Designation) => void;
  onToggleStatus: (designation: Designation) => void;
}

function DesignationTable({
  designations,
  companies,
  branches,
  departments,
  togglingId,
  onEdit,
  onDelete,
  onToggleStatus,
}: DesignationTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Designation
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Company
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Branch
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Department
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
              Level
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
          {designations.map((desig, index) => {
            const isToggling = togglingId === desig.id;

            return (
              <tr key={desig.id} className="transition hover:bg-slate-50/60">
                <td className="px-4 py-3 text-slate-400">{index + 1}</td>

                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">
                    {desig.designation_name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {desig.designation_code}
                  </p>
                  {desig.description && (
                    <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                      {desig.description}
                    </p>
                  )}
                </td>

                <td className="px-4 py-3">
                  <span className="text-slate-600">
                    {getCompanyName(companies, desig.company_id)}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span className="text-slate-600">
                    {getBranchName(branches, desig.branch_id)}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span className="text-slate-600">
                    {getDepartmentName(departments, desig.department_id)}
                  </span>
                </td>

                <td className="px-4 py-3 text-center">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {desig.hierarchy_level}
                  </span>
                </td>

                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onToggleStatus(desig)}
                    disabled={isToggling}
                    className="disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Toggle status"
                  >
                    <StatusBadge active={desig.active} />
                  </button>
                </td>

                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(desig)}
                      disabled={isToggling}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Edit designation"
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
                    <button
                      onClick={() => onDelete(desig)}
                      disabled={isToggling}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Delete designation"
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
  | { type: "form"; designation: Designation | null }
  | { type: "delete"; designation: Designation }
  | null;

function DesignationManagement() {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [filteredDesignations, setFilteredDesignations] = useState<Designation[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState<ModalState>(null);

  const addBtnRef = useRef<HTMLButtonElement>(null);
  const modalOpenerRef = useRef<Element | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [desigData, companyData, branchData, deptData] = await Promise.all([
        designationService.getAll(),
        loadCompanies(),
        branchService.getAll(),
        departmentService.getAll(),
      ]);

      setDesignations(desigData);
      setCompanies(companyData);
      setBranches(branchData);
      setDepartments(deptData);
    } catch (err) {
      console.error(err);
      setError(
        "Failed to load designation data. Please refresh and try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Search filter — sole source of truth for filteredDesignations ─────────

  useEffect(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      setFilteredDesignations(designations);
      return;
    }

    setFilteredDesignations(
      designations.filter(
        (d) =>
          d.designation_name.toLowerCase().includes(keyword) ||
          d.designation_code.toLowerCase().includes(keyword) ||
          (d.description ?? "").toLowerCase().includes(keyword)
      )
    );
  }, [search, designations]);

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

  async function handleSave(data: DesignationForm) {
    setSaving(true);

    try {
      const editing =
        modal?.type === "form" ? modal.designation : null;

      if (editing) {
        await designationService.update(editing.id, data);
      } else {
        await designationService.create(data);
      }

      await loadData();
      setError("");
      closeModal();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to save designation.";
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
      await designationService.delete(modal.designation.id);
      await loadData();
      setError("");
      closeModal();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to delete designation.";
      setError(message);
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle Status ─────────────────────────────────────────────────────────

  async function handleToggleStatus(desig: Designation) {
    setTogglingId(desig.id);

    try {
      await designationService.setStatus(desig.id, !desig.active);

      await loadData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to update status.";
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
          <h2 className="text-xl font-bold text-slate-800">
            Designation Management
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage all designations across departments.
          </p>
        </div>

        <button
          ref={addBtnRef}
          onClick={() => openModal({ type: "form", designation: null })}
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Add Designation
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
            placeholder="Search by name, code, description…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-yellow-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
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
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {!loading && (
          <p className="text-sm text-slate-400">
            {filteredDesignations.length}{" "}
            {filteredDesignations.length === 1
              ? "designation"
              : "designations"}
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
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Content */}
      <div className="px-6 pb-6">
        {loading ? (
          <TableSkeleton />
        ) : filteredDesignations.length === 0 ? (
          <EmptyState
            search={search}
            onAdd={() => openModal({ type: "form", designation: null })}
          />
        ) : (
          <DesignationTable
            designations={filteredDesignations}
            companies={companies}
            branches={branches}
            departments={departments}
            togglingId={togglingId}
            onEdit={(desig) =>
              openModal({ type: "form", designation: desig })
            }
            onDelete={(desig) =>
              openModal({ type: "delete", designation: desig })
            }
            onToggleStatus={handleToggleStatus}
          />
        )}
      </div>

      {/* Add / Edit Modal */}
      {modal?.type === "form" && (
        <DesignationFormModal
          designation={modal.designation}
          companies={companies}
          branches={branches}
          departments={departments}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {/* Delete Confirmation */}
      {modal?.type === "delete" && (
        <DeleteDialog
          designation={modal.designation}
          deleting={deleting}
          onConfirm={handleDelete}
          onClose={closeModal}
        />
      )}

    </div>
  );
}

export default DesignationManagement;

// FILE COMPLETE
