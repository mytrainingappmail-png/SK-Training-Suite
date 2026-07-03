import { useCallback, useEffect, useRef, useState } from "react";

import { employeeService } from "../../services/employee/employeeService";
import { loadCompanies } from "../../services/company/companyService";
import { branchService } from "../../services/branch/branchService";
import { departmentService } from "../../services/department/departmentService";
import { designationService } from "../../services/designation/designationService";

import type { Employee, EmployeeForm } from "../../types/employee";
import type { Company } from "../../types/company";
import type { Branch } from "../../types/branch";
import type { Department } from "../../types/department";
import type { Designation } from "../../types/designation";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

const BLANK: EmployeeForm = {
  company_id: "",
  branch_id: "",
  department_id: "",
  designation_id: "",
  employee_code: "",
  first_name: "",
  last_name: "",
  mobile: "",
  email: "",
  joining_date: "",
  reporting_manager: null,
  active: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers  (no React, no side-effects)
// ─────────────────────────────────────────────────────────────────────────────

function displayName(first: string, last: string): string {
  return [first, last].filter(Boolean).join(" ") || "—";
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function findName<T extends { id: string }>(
  list: T[],
  id: string,
  key: keyof T
): string {
  if (!id) return "—";
  const match = list.find((x) => x.id === id);
  return match ? String(match[key]) : "—";
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

const CLS_INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:bg-slate-50";

const CLS_SELECT =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:bg-slate-50";

function FL({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
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

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "bg-yellow-500" : "bg-slate-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function Spinner({ spin }: { spin: boolean }) {
  return (
    <svg
      className={`h-4 w-4 ${spin ? "animate-spin" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-10 w-8 rounded bg-slate-100" />
          <div className="h-10 flex-1 rounded bg-slate-100" />
          <div className="h-10 w-32 rounded bg-slate-100" />
          <div className="h-10 w-24 rounded bg-slate-100" />
          <div className="h-10 w-20 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  search,
  onAdd,
}: {
  search: string;
  onAdd: () => void;
}) {
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
            d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
          />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No employees found" : "No employees yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search
          ? `No results for "${search}". Try a different keyword.`
          : "Add your first employee to get started."}
      </p>
      {!search && (
        <button
          onClick={onAdd}
          className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
        >
          Add Employee
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete confirmation dialog
// ─────────────────────────────────────────────────────────────────────────────

function DeleteDialog({
  name,
  busy,
  onConfirm,
  onCancel,
}: {
  name: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dd-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!busy ? onCancel : undefined}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h3 id="dd-title" className="mb-1 text-lg font-semibold text-slate-800">Delete Employee</h3>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-slate-700">{name}</span>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 active:scale-95"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Employee form modal
//
// KEY DESIGN DECISION:
// filteredBranches / filteredDepartments / filteredDesignations are computed
// INLINE during render from allBranches/allDepartments/allDesignations props
// + the current form state.  There is NO state, NO useEffect, NO sync for
// these lists.  Selecting Company immediately filters Branches because the
// next render recalculates from the updated form.company_id.
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  company_id?: string;
  branch_id?: string;
  department_id?: string;
  designation_id?: string;
  employee_code?: string;
  first_name?: string;
  joining_date?: string;
  email?: string;
  mobile?: string;
}

function EmployeeModal({
  editing,
  companies,
  allBranches,
  allDepartments,
  allDesignations,
  managers,
  usedCodes,
  saving,
  onSave,
  onClose,
}: {
  editing: Employee | null;
  companies: Company[];
  allBranches: Branch[];
  allDepartments: Department[];
  allDesignations: Designation[];
  managers: Employee[];
  usedCodes: string[];
  saving: boolean;
  onSave: (data: EmployeeForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<EmployeeForm>(() =>
    isEdit
      ? {
          company_id: editing.company_id,
          branch_id: editing.branch_id,
          department_id: editing.department_id,
          designation_id: editing.designation_id,
          employee_code: editing.employee_code,
          first_name: editing.first_name,
          last_name: editing.last_name,
          mobile: editing.mobile,
          email: editing.email,
          joining_date: editing.joining_date,
          reporting_manager: editing.reporting_manager,
          active: editing.active,
        }
      : { ...BLANK }
  );

  const [errs, setErrs] = useState<FormErrs>({});
  const firstRef = useRef<HTMLSelectElement>(null);

  // ── Cascading dropdown lists — derived from props + form state during render
  // No state. No useEffect. No sync bugs.
  const filteredBranches = allBranches.filter(
    (b) => b.company_id === form.company_id
  );
  const filteredDepartments = allDepartments.filter(
    (d) => d.branch_id === form.branch_id
  );
  const filteredDesignations = allDesignations.filter(
    (d) => d.department_id === form.department_id
  );

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [saving, onClose]);

  // ── Generic field setter
  function set<K extends keyof EmployeeForm>(key: K, val: EmployeeForm[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
    setErrs((prev) => ({ ...prev, [key]: undefined }));
  }

  // ── Cascade reset on company change
  function onCompanyChange(val: string) {
    setForm((prev) => ({
      ...prev,
      company_id: val,
      branch_id: "",
      department_id: "",
      designation_id: "",
    }));
    setErrs((prev) => ({
      ...prev,
      company_id: undefined,
      branch_id: undefined,
      department_id: undefined,
      designation_id: undefined,
    }));
  }

  // ── Cascade reset on branch change
  function onBranchChange(val: string) {
    setForm((prev) => ({
      ...prev,
      branch_id: val,
      department_id: "",
      designation_id: "",
    }));
    setErrs((prev) => ({
      ...prev,
      branch_id: undefined,
      department_id: undefined,
      designation_id: undefined,
    }));
  }

  // ── Cascade reset on department change
  function onDeptChange(val: string) {
    setForm((prev) => ({
      ...prev,
      department_id: val,
      designation_id: "",
    }));
    setErrs((prev) => ({
      ...prev,
      department_id: undefined,
      designation_id: undefined,
    }));
  }

  // ── Validation
  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.company_id)    e.company_id    = "Company is required.";
    if (!form.branch_id)     e.branch_id     = "Branch is required.";
    if (!form.department_id) e.department_id = "Department is required.";
    if (!form.designation_id)e.designation_id= "Designation is required.";

    const code = form.employee_code.trim();
    if (!code) {
      e.employee_code = "Employee Code is required.";
    } else if (
      usedCodes.includes(code.toLowerCase()) &&
      (!isEdit || code.toLowerCase() !== editing.employee_code.trim().toLowerCase())
    ) {
      e.employee_code = "Employee Code already exists.";
    }

    if (!form.first_name.trim()) e.first_name   = "First Name is required.";
    if (!form.joining_date)      e.joining_date = "Joining Date is required.";

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address.";

    if (form.mobile && !/^[+]?[\d\s\-().]{7,20}$/.test(form.mobile))
      e.mobile = "Enter a valid mobile number.";

    setErrs(e);
    return Object.keys(e).length === 0;
  }

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!validate()) return;
    onSave(form);
  }

  // ── Render
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="em-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!saving ? onClose : undefined}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* ── Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="em-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Employee" : "Add Employee"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update employee details." : "Fill in the employee details below."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Form body */}
        <form onSubmit={onSubmit} noValidate>
          <div className="space-y-5 p-6">

            {/* Company */}
            <FL label="Company" required error={errs.company_id}>
              <select
                ref={firstRef}
                value={form.company_id}
                onChange={(e) => onCompanyChange(e.target.value)}
                disabled={saving}
                className={CLS_SELECT}
              >
                <option value="">— Select Company —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </FL>

            {/* Branch — filtered inline from filteredBranches */}
            <FL label="Branch" required error={errs.branch_id}>
              <select
                value={form.branch_id}
                onChange={(e) => onBranchChange(e.target.value)}
                disabled={saving || !form.company_id}
                className={CLS_SELECT}
              >
                <option value="">
                  {!form.company_id
                    ? "— Select Company first —"
                    : filteredBranches.length === 0
                    ? "— No branches for this company —"
                    : "— Select Branch —"}
                </option>
                {filteredBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.branch_name}</option>
                ))}
              </select>
            </FL>

            {/* Department — filtered inline from filteredDepartments */}
            <FL label="Department" required error={errs.department_id}>
              <select
                value={form.department_id}
                onChange={(e) => onDeptChange(e.target.value)}
                disabled={saving || !form.branch_id}
                className={CLS_SELECT}
              >
                <option value="">
                  {!form.branch_id
                    ? "— Select Branch first —"
                    : filteredDepartments.length === 0
                    ? "— No departments for this branch —"
                    : "— Select Department —"}
                </option>
                {filteredDepartments.map((d) => (
                  <option key={d.id} value={d.id}>{d.department_name}</option>
                ))}
              </select>
            </FL>

            {/* Designation — filtered inline from filteredDesignations */}
            <FL label="Designation" required error={errs.designation_id}>
              <select
                value={form.designation_id}
                onChange={(e) => set("designation_id", e.target.value)}
                disabled={saving || !form.department_id}
                className={CLS_SELECT}
              >
                <option value="">
                  {!form.department_id
                    ? "— Select Department first —"
                    : filteredDesignations.length === 0
                    ? "— No designations for this department —"
                    : "— Select Designation —"}
                </option>
                {filteredDesignations.map((d) => (
                  <option key={d.id} value={d.id}>{d.designation_name}</option>
                ))}
              </select>
            </FL>

            {/* Employee Code */}
            <FL label="Employee Code" required error={errs.employee_code}>
              <input
                type="text"
                value={form.employee_code}
                onChange={(e) => set("employee_code", e.target.value)}
                placeholder="e.g. EMP-001"
                maxLength={20}
                disabled={saving}
                className={CLS_INPUT}
              />
            </FL>

            {/* Name */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="First Name" required error={errs.first_name}>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => set("first_name", e.target.value)}
                  placeholder="First name"
                  maxLength={100}
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
              <FL label="Last Name">
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => set("last_name", e.target.value)}
                  placeholder="Last name"
                  maxLength={100}
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Mobile" error={errs.mobile}>
                <input
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => set("mobile", e.target.value)}
                  placeholder="+91 98765 43210"
                  maxLength={20}
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
              <FL label="Email" error={errs.email}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="employee@company.com"
                  maxLength={150}
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
            </div>

            {/* Joining Date */}
            <FL label="Joining Date" required error={errs.joining_date}>
              <input
                type="date"
                value={form.joining_date}
                onChange={(e) => set("joining_date", e.target.value)}
                disabled={saving}
                className={CLS_INPUT}
              />
            </FL>

            {/* Reporting Manager — nullable field */}
            <FL label="Reporting Manager">
              <select
                value={form.reporting_manager ?? ""}
                onChange={(e) =>
                  set("reporting_manager", e.target.value === "" ? null : e.target.value)
                }
                disabled={saving}
                className={CLS_SELECT}
              >
                <option value="">— No Reporting Manager —</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {displayName(m.first_name, m.last_name)} — {m.employee_code}
                  </option>
                ))}
              </select>
            </FL>

            {/* Active */}
            <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <Toggle
                on={form.active}
                onChange={() => set("active", !form.active)}
                disabled={saving}
              />
              <div>
                <p className="text-sm font-medium text-slate-700">Active</p>
                <p className="text-xs text-slate-500">Employee is active</p>
              </div>
            </div>

          </div>

          {/* ── Footer */}
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
              {saving ? "Saving…" : isEdit ? "Update Employee" : "Add Employee"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

type ModalKind =
  | { type: "add" }
  | { type: "edit"; emp: Employee }
  | { type: "delete"; emp: Employee }
  | null;

export default function EmployeeManagement() {

  // ── Single source of truth — loaded once, never duplicated
  const [employees,    setEmployees]    = useState<Employee[]>([]);
  const [companies,    setCompanies]    = useState<Company[]>([]);
  const [branches,     setBranches]     = useState<Branch[]>([]);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);

  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);
  const [banner, setBanner] = useState("");
  const [modal,  setModal]  = useState<ModalKind>(null);

  const addBtnRef  = useRef<HTMLButtonElement>(null);
  const openerRef  = useRef<Element | null>(null);

  // ── Derived — computed inline, no secondary state ─────────────────────────

  const kw = search.trim().toLowerCase();

  const filtered = kw
    ? employees.filter(
        (e) =>
          e.employee_code.toLowerCase().includes(kw) ||
          e.first_name.toLowerCase().includes(kw) ||
          (e.last_name  ?? "").toLowerCase().includes(kw) ||
          (e.mobile     ?? "").toLowerCase().includes(kw) ||
          (e.email      ?? "").toLowerCase().includes(kw)
      )
    : employees;

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage    = Math.min(page, totalPages);
  const pageStart   = (safePage - 1) * PER_PAGE;
  const pageRows    = filtered.slice(pageStart, pageStart + PER_PAGE);

  const activeManagers = employees.filter((e) => e.active);
  const usedCodes      = employees.map((e) => e.employee_code.trim().toLowerCase());

  // Reset to page 1 whenever search changes
  useEffect(() => { setPage(1); }, [search]);

  // ── Load — runs once on mount ─────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      const [emp, co, br, de, ds] = await Promise.all([
        employeeService.getAll(),
        loadCompanies(),
        branchService.getAll(),
        departmentService.getAll(),
        designationService.getAll(),
      ]);
      setEmployees(emp);
      setCompanies(co);
      setBranches(br);
      setDepartments(de);
      setDesignations(ds);
    } catch (err) {
      console.error(err);
      setBanner("Failed to load data. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openModal(m: ModalKind) {
    openerRef.current = document.activeElement;
    setModal(m);
  }

  function closeModal() {
    setModal(null);
    setTimeout(() => {
      const el = openerRef.current;
      openerRef.current = null;
      if (el instanceof HTMLElement) el.focus();
      else addBtnRef.current?.focus();
    }, 0);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave(data: EmployeeForm) {
    setSaving(true);
    try {
      if (modal?.type === "edit") {
        await employeeService.update(modal.emp.id, data);
      } else {
        await employeeService.create(data);
      }
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to save employee.");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (modal?.type !== "delete") return;
    setDeleting(true);
    try {
      await employeeService.delete(modal.emp.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to delete employee.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle status ─────────────────────────────────────────────────────────

  async function handleToggle(emp: Employee) {
    setTogglingId(emp.id);
    try {
      await employeeService.setStatus(emp.id, !emp.active);
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to update status.");
    } finally {
      setTogglingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Employee Management</h2>
          <p className="mt-0.5 text-sm text-slate-500">Manage all employees across the organisation.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => load()}
            disabled={loading}
            aria-label="Refresh"
            className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Spinner spin={loading} />
          </button>
          <button
            ref={addBtnRef}
            onClick={() => openModal({ type: "add" })}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Employee
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-4">
        <div className="relative flex-1 min-w-[240px]">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, name, mobile, email…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-yellow-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {!loading && (
          <p className="text-sm text-slate-400">
            {filtered.length} {filtered.length === 1 ? "employee" : "employees"}
            {search && " found"}
          </p>
        )}
      </div>

      {/* Error banner */}
      {banner && (
        <div className="mx-6 mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="flex-1">{banner}</p>
          <button onClick={() => setBanner("")} aria-label="Dismiss" className="text-red-400 hover:text-red-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Table / skeleton / empty */}
      <div className="px-6 pb-4">
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState search={search} onAdd={() => openModal({ type: "add" })} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    { h: "#",           w: "w-10  text-left"   },
                    { h: "Code",        w: "text-left"         },
                    { h: "Employee",    w: "text-left"         },
                    { h: "Company",     w: "text-left"         },
                    { h: "Branch",      w: "text-left"         },
                    { h: "Department",  w: "text-left"         },
                    { h: "Designation", w: "text-left"         },
                    { h: "Joining",     w: "text-left"         },
                    { h: "Manager",     w: "text-left"         },
                    { h: "Status",      w: "text-center"       },
                    { h: "Actions",     w: "text-right"        },
                  ].map(({ h, w }) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${w}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.map((emp, i) => {
                  const busy = togglingId === emp.id;
                  const manager = employees.find((e) => e.id === emp.reporting_manager);
                  return (
                    <tr key={emp.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">
                        {pageStart + i + 1}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                        {emp.employee_code}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{displayName(emp.first_name, emp.last_name)}</p>
                        {emp.mobile && <p className="text-xs text-slate-400">{emp.mobile}</p>}
                        {emp.email  && <p className="text-xs text-slate-400">{emp.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {findName(companies,    emp.company_id,     "company_name")}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {findName(branches,     emp.branch_id,      "branch_name")}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {findName(departments,  emp.department_id,  "department_name")}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {findName(designations, emp.designation_id, "designation_name")}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(emp.joining_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {manager ? displayName(manager.first_name, manager.last_name) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggle(emp)}
                          disabled={busy}
                          aria-label="Toggle status"
                          className="disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <StatusPill active={emp.active} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal({ type: "edit", emp })}
                            disabled={busy}
                            aria-label="Edit employee"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openModal({ type: "delete", emp })}
                            disabled={busy}
                            aria-label="Delete employee"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
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
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <p className="text-sm text-slate-500">Page {safePage} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {(modal?.type === "add" || modal?.type === "edit") && (
        <EmployeeModal
          editing={modal.type === "edit" ? modal.emp : null}
          companies={companies}
          allBranches={branches}
          allDepartments={departments}
          allDesignations={designations}
          managers={activeManagers}
          usedCodes={usedCodes}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {modal?.type === "delete" && (
        <DeleteDialog
          name={displayName(modal.emp.first_name, modal.emp.last_name)}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
  );
}

// FILE COMPLETE
