import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadEnrollments,
  createEnrollment,
  saveEnrollment,
  removeEnrollment,
  toggleActive,
} from "../../services/learningPathEnrollment/learningPathEnrollmentService";
import { loadLearningPaths } from "../../services/learningPath/learningPathService";
import { loadCompanies }      from "../../services/company/companyService";
import { branchService }      from "../../services/branch/branchService";
import { departmentService }  from "../../services/department/departmentService";
import { designationService } from "../../services/designation/designationService";
import { employeeService }    from "../../services/employee/employeeService";

import type {
  LearningPathEnrollment,
  LearningPathEnrollmentForm,
  EnrollmentType,
  EnrollmentStatus,
} from "../../types/learningPathEnrollment";
import type { LearningPath }  from "../../types/learningPath";
import type { Company }       from "../../types/company";
import type { Branch }        from "../../types/branch";
import type { Department }    from "../../types/department";
import type { Designation }   from "../../types/designation";
import type { Employee }      from "../../types/employee";
import { defaultEnrollmentForm } from "../../types/learningPathEnrollment";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

const ENROLLMENT_TYPES: { value: EnrollmentType; label: string }[] = [
  { value: "company",     label: "Company"     },
  { value: "branch",      label: "Branch"      },
  { value: "department",  label: "Department"  },
  { value: "designation", label: "Designation" },
  { value: "employee",    label: "Employee"    },
];

const STATUS_OPTIONS: { value: EnrollmentStatus; label: string }[] = [
  { value: "assigned",    label: "Assigned"    },
  { value: "in_progress", label: "In Progress" },
  { value: "completed",   label: "Completed"   },
  { value: "cancelled",   label: "Cancelled"   },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function empName(employees: Employee[], id: string): string {
  if (!id) return "—";
  const e = employees.find((x) => x.id === id);
  if (!e) return "—";
  return [e.first_name, e.last_name].filter(Boolean).join(" ") || e.employee_code;
}

function findName<T extends { id: string }>(
  list: T[],
  id: string,
  key: keyof T
): string {
  if (!id) return "—";
  const m = list.find((x) => x.id === id);
  return m ? String(m[key]) : "—";
}

function typeLabel(t: EnrollmentType): string {
  return ENROLLMENT_TYPES.find((x) => x.value === t)?.label ?? t;
}

function statusCls(s: EnrollmentStatus): string {
  const map: Record<EnrollmentStatus, string> = {
    assigned:    "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    in_progress: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    completed:   "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    cancelled:   "bg-red-50 text-red-700 ring-1 ring-red-200",
  };
  return map[s] ?? "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

const CLS_INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:bg-slate-50";

const CLS_SELECT =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:bg-slate-50";

const CLS_TEXTAREA =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:bg-slate-50 resize-none";

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

function ToggleRow({
  label,
  sub,
  on,
  onChange,
  disabled,
}: {
  label: string;
  sub: string;
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <Toggle on={on} onChange={onChange} disabled={disabled} />
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
    </label>
  );
}

function Spinner({ spin }: { spin: boolean }) {
  return (
    <svg className={`h-4 w-4 ${spin ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton / Empty / Delete dialog
// ─────────────────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
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

function EmptyState({ search, onAdd }: { search: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No enrollments found" : "No enrollments yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search ? `No results for "${search}".` : "Add an enrollment to get started."}
      </p>
      {!search && (
        <button onClick={onAdd} className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95">
          Add Enrollment
        </button>
      )}
    </div>
  );
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="dd-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!busy ? onCancel : undefined} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h3 id="dd-title" className="mb-1 text-lg font-semibold text-slate-800">Delete Enrollment</h3>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to delete the enrollment for <span className="font-semibold text-slate-700">{name}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button ref={cancelRef} onClick={onCancel} disabled={busy}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 active:scale-95">
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrollment form modal
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  learning_path_id?: string;
  enrollment_type?: string;
  target?: string;
  status?: string;
  date_range?: string;
}

function EnrollmentModal({
  editing,
  learningPaths,
  companies,
  branches,
  departments,
  designations,
  employees,
  saving,
  onSave,
  onClose,
}: {
  editing: LearningPathEnrollment | null;
  learningPaths: LearningPath[];
  companies: Company[];
  branches: Branch[];
  departments: Department[];
  designations: Designation[];
  employees: Employee[];
  saving: boolean;
  onSave: (data: LearningPathEnrollmentForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<LearningPathEnrollmentForm>(() =>
    isEdit
      ? {
          learning_path_id:    editing.learning_path_id,
          company_id:          editing.company_id,
          branch_id:           editing.branch_id,
          department_id:       editing.department_id,
          designation_id:      editing.designation_id,
          employee_id:         editing.employee_id,
          enrollment_type:     editing.enrollment_type,
          enrolled_date:       editing.enrolled_date,
          start_date:          editing.start_date,
          end_date:            editing.end_date,
          mandatory:           editing.mandatory,
          active:              editing.active,
          completion_required: editing.completion_required,
          status:              editing.status,
          remarks:             editing.remarks,
        }
      : { ...defaultEnrollmentForm }
  );

  const [errs, setErrs] = useState<FormErrs>({});
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  function field<K extends keyof LearningPathEnrollmentForm>(
    key: K,
    val: LearningPathEnrollmentForm[K]
  ) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined, target: undefined, date_range: undefined }));
  }

  function handleTypeChange(t: EnrollmentType) {
    setForm((p) => ({
      ...p,
      enrollment_type: t,
      company_id:      "",
      branch_id:       "",
      department_id:   "",
      designation_id:  "",
      employee_id:     "",
    }));
    setErrs((p) => ({ ...p, enrollment_type: undefined, target: undefined }));
  }

  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.learning_path_id) e.learning_path_id = "Learning Path is required.";
    if (!form.enrollment_type)  e.enrollment_type  = "Enrollment Type is required.";

    const targetMap: Record<EnrollmentType, string> = {
      company:     form.company_id,
      branch:      form.branch_id,
      department:  form.department_id,
      designation: form.designation_id,
      employee:    form.employee_id,
    };
    if (form.enrollment_type && !targetMap[form.enrollment_type]) {
      e.target = `${typeLabel(form.enrollment_type)} is required.`;
    }

    if (form.start_date && form.end_date && form.start_date > form.end_date) {
      e.date_range = "Start Date cannot be after End Date.";
    }

    setErrs(e);
    return Object.keys(e).length === 0;
  }

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!validate()) return;
    onSave(form);
  }

  const t = form.enrollment_type;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lpe-form-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="lpe-form-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Enrollment" : "Add Enrollment"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update enrollment details." : "Enroll a target into a learning path."}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="space-y-5 p-6">

            {/* ── Target ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Enrollment Target</p>

            <FL label="Learning Path" required error={errs.learning_path_id}>
              <select ref={firstRef} value={form.learning_path_id}
                onChange={(e) => field("learning_path_id", e.target.value)}
                disabled={saving} className={CLS_SELECT}>
                <option value="">— Select Learning Path —</option>
                {learningPaths.map((lp) => (
                  <option key={lp.id} value={lp.id}>{lp.path_code} — {lp.path_name}</option>
                ))}
              </select>
            </FL>

            <FL label="Enrollment Type" required error={errs.enrollment_type}>
              <select value={form.enrollment_type}
                onChange={(e) => handleTypeChange(e.target.value as EnrollmentType)}
                disabled={saving} className={CLS_SELECT}>
                {ENROLLMENT_TYPES.map((et) => (
                  <option key={et.value} value={et.value}>{et.label}</option>
                ))}
              </select>
            </FL>

            {t === "company" && (
              <FL label="Company" required error={errs.target}>
                <select value={form.company_id}
                  onChange={(e) => field("company_id", e.target.value)}
                  disabled={saving} className={CLS_SELECT}>
                  <option value="">— Select Company —</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </FL>
            )}

            {t === "branch" && (
              <FL label="Branch" required error={errs.target}>
                <select value={form.branch_id}
                  onChange={(e) => field("branch_id", e.target.value)}
                  disabled={saving} className={CLS_SELECT}>
                  <option value="">— Select Branch —</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                </select>
              </FL>
            )}

            {t === "department" && (
              <FL label="Department" required error={errs.target}>
                <select value={form.department_id}
                  onChange={(e) => field("department_id", e.target.value)}
                  disabled={saving} className={CLS_SELECT}>
                  <option value="">— Select Department —</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
                </select>
              </FL>
            )}

            {t === "designation" && (
              <FL label="Designation" required error={errs.target}>
                <select value={form.designation_id}
                  onChange={(e) => field("designation_id", e.target.value)}
                  disabled={saving} className={CLS_SELECT}>
                  <option value="">— Select Designation —</option>
                  {designations.map((d) => <option key={d.id} value={d.id}>{d.designation_name}</option>)}
                </select>
              </FL>
            )}

            {t === "employee" && (
              <FL label="Employee" required error={errs.target}>
                <select value={form.employee_id}
                  onChange={(e) => field("employee_id", e.target.value)}
                  disabled={saving} className={CLS_SELECT}>
                  <option value="">— Select Employee —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {[e.first_name, e.last_name].filter(Boolean).join(" ")} — {e.employee_code}
                    </option>
                  ))}
                </select>
              </FL>
            )}

            {/* ── Schedule ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Schedule</p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <FL label="Enrolled Date">
                <input type="date" value={form.enrolled_date}
                  onChange={(e) => field("enrolled_date", e.target.value)}
                  disabled={saving} className={CLS_INPUT} />
              </FL>
              <FL label="Start Date" error={errs.date_range}>
                <input type="date" value={form.start_date}
                  onChange={(e) => field("start_date", e.target.value)}
                  disabled={saving} className={CLS_INPUT} />
              </FL>
              <FL label="End Date">
                <input type="date" value={form.end_date}
                  onChange={(e) => field("end_date", e.target.value)}
                  disabled={saving} className={CLS_INPUT} />
              </FL>
            </div>
            {errs.date_range && (
              <p className="-mt-3 text-xs text-red-500">{errs.date_range}</p>
            )}

            {/* ── Settings ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Settings</p>

            <FL label="Status">
              <select value={form.status}
                onChange={(e) => field("status", e.target.value as EnrollmentStatus)}
                disabled={saving} className={CLS_SELECT}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </FL>

            <div className="flex flex-wrap gap-y-4 gap-x-8 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <ToggleRow
                label="Mandatory"
                sub="Learner must complete this path"
                on={form.mandatory}
                onChange={() => field("mandatory", !form.mandatory)}
                disabled={saving}
              />
              <ToggleRow
                label="Completion Required"
                sub="Required for progress tracking"
                on={form.completion_required}
                onChange={() => field("completion_required", !form.completion_required)}
                disabled={saving}
              />
              <ToggleRow
                label="Active"
                sub="Enrollment is currently active"
                on={form.active}
                onChange={() => field("active", !form.active)}
                disabled={saving}
              />
            </div>

            <FL label="Remarks">
              <textarea value={form.remarks}
                onChange={(e) => field("remarks", e.target.value)}
                placeholder="Optional internal notes"
                rows={2} disabled={saving} className={CLS_TEXTAREA} />
            </FL>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:opacity-50 active:scale-95">
              {saving ? "Saving…" : isEdit ? "Update Enrollment" : "Add Enrollment"}
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
  | { type: "edit"; enrollment: LearningPathEnrollment }
  | { type: "delete"; enrollment: LearningPathEnrollment }
  | null;

export default function LearningPathEnrollmentManagement() {

  const [enrollments,  setEnrollments]  = useState<LearningPathEnrollment[]>([]);
  const [learningPaths,setLearningPaths]= useState<LearningPath[]>([]);
  const [companies,    setCompanies]    = useState<Company[]>([]);
  const [branches,     setBranches]     = useState<Branch[]>([]);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [employees,    setEmployees]    = useState<Employee[]>([]);

  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [search,      setSearch]      = useState("");
  const [pathFilter,  setPathFilter]  = useState("");
  const [statusFilter,setStatusFilter]= useState<EnrollmentStatus | "">("");
  const [page,        setPage]        = useState(1);
  const [banner,      setBanner]      = useState("");
  const [modal,       setModal]       = useState<ModalKind>(null);

  const addBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  // ── Derived
  const filtered = useMemo(() => {
    let rows = enrollments;
    if (pathFilter)   rows = rows.filter((r) => r.learning_path_id === pathFilter);
    if (statusFilter) rows = rows.filter((r) => r.status           === statusFilter);
    const kw = search.trim().toLowerCase();
    if (kw) {
      rows = rows.filter((r) => {
        const lpName = findName(learningPaths, r.learning_path_id, "path_name");
        const en     = r.enrollment_type.toLowerCase();
        const target = r.employee_id
          ? empName(employees, r.employee_id)
          : "";
        return (
          lpName.toLowerCase().includes(kw) ||
          en.includes(kw) ||
          target.toLowerCase().includes(kw) ||
          (r.remarks ?? "").toLowerCase().includes(kw)
        );
      });
    }
    return rows;
  }, [enrollments, learningPaths, employees, search, pathFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PER_PAGE;
  const pageRows   = filtered.slice(pageStart, pageStart + PER_PAGE);

  useEffect(() => { setPage(1); }, [search, pathFilter, statusFilter]);

  // ── Load
  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      const [enData, lpData, coData, brData, deData, dgData, emData] =
        await Promise.all([
          loadEnrollments(),
          loadLearningPaths(),
          loadCompanies(),
          branchService.getAll(),
          departmentService.getAll(),
          designationService.getAll(),
          employeeService.getAll(),
        ]);
      setEnrollments(enData);
      setLearningPaths(lpData);
      setCompanies(coData);
      setBranches(brData);
      setDepartments(deData);
      setDesignations(dgData);
      setEmployees(emData);
    } catch (err) {
      console.error(err);
      setBanner("Failed to load data. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Modal helpers
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

  // ── Save
  const handleSave = useCallback(
    async (data: LearningPathEnrollmentForm) => {
      setSaving(true);
      try {
        if (modal?.type === "edit") {
          await saveEnrollment(modal.enrollment.id, data);
        } else {
          await createEnrollment(data);
        }
        await load();
        setBanner("");
        closeModal();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Unable to save enrollment.");
      } finally {
        setSaving(false);
      }
    },
    [modal, load]
  );

  // ── Delete
  async function handleDelete() {
    if (modal?.type !== "delete") return;
    setDeleting(true);
    try {
      await removeEnrollment(modal.enrollment.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to delete enrollment.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle active — optimistic
  async function handleToggle(enrollment: LearningPathEnrollment) {
    setTogglingId(enrollment.id);
    try {
      await toggleActive(enrollment.id, !enrollment.active);
      setEnrollments((prev) =>
        prev.map((e) => e.id === enrollment.id ? { ...e, active: !enrollment.active } : e)
      );
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to update status.");
      await load();
    } finally {
      setTogglingId(null);
    }
  }

  // ── Target display
  function getTargetLabel(en: LearningPathEnrollment): string {
    switch (en.enrollment_type) {
      case "company":     return findName(companies,    en.company_id,     "company_name");
      case "branch":      return findName(branches,     en.branch_id,      "branch_name");
      case "department":  return findName(departments,  en.department_id,  "department_name");
      case "designation": return findName(designations, en.designation_id, "designation_name");
      case "employee":    return empName(employees, en.employee_id);
      default:            return "—";
    }
  }

  // ── Render
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Learning Path Enrollments</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Assign employees and groups to learning paths.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => load()} disabled={loading} aria-label="Refresh"
            className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50">
            <Spinner spin={loading} />
          </button>
          <button ref={addBtnRef} onClick={() => openModal({ type: "add" })}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Enrollment
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 border-b border-slate-100 px-6 py-4">
        <div className="relative min-w-[220px] flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by path, type, target, remarks…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-yellow-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/30" />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <select value={pathFilter} onChange={(e) => setPathFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30">
          <option value="">All Learning Paths</option>
          {learningPaths.map((lp) => (
            <option key={lp.id} value={lp.id}>{lp.path_code} — {lp.path_name}</option>
          ))}
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as EnrollmentStatus | "")}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {!loading && (
          <p className="self-center text-sm text-slate-400">
            {filtered.length} {filtered.length === 1 ? "enrollment" : "enrollments"}
          </p>
        )}
      </div>

      {/* Error banner */}
      {banner && (
        <div className="mx-6 mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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

      {/* Content */}
      <div className="px-6 py-4">
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
                    { h: "#",            cls: "w-10 text-left" },
                    { h: "Learning Path",cls: "text-left"      },
                    { h: "Type",         cls: "text-left"      },
                    { h: "Target",       cls: "text-left"      },
                    { h: "Start",        cls: "text-left"      },
                    { h: "End",          cls: "text-left"      },
                    { h: "Status",       cls: "text-center"    },
                    { h: "Mandatory",    cls: "text-center"    },
                    { h: "Active",       cls: "text-center"    },
                    { h: "Actions",      cls: "text-right"     },
                  ].map(({ h, cls }) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.map((en, i) => {
                  const busy = togglingId === en.id;
                  return (
                    <tr key={en.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">{pageStart + i + 1}</td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">
                          {findName(learningPaths, en.learning_path_id, "path_name")}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {findName(learningPaths, en.learning_path_id, "path_code")}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                          {typeLabel(en.enrollment_type)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">
                        {getTargetLabel(en)}
                      </td>

                      <td className="px-4 py-3 text-slate-600">{en.start_date || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{en.end_date   || "—"}</td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCls(en.status)}`}>
                          {STATUS_OPTIONS.find((s) => s.value === en.status)?.label ?? en.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          en.mandatory
                            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                            : "bg-slate-100 text-slate-400 ring-1 ring-slate-200"
                        }`}>
                          {en.mandatory ? "Yes" : "No"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggle(en)}
                          disabled={busy}
                          aria-label="Toggle active"
                          className="disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            en.active
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${en.active ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {en.active ? "Active" : "Inactive"}
                          </span>
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal({ type: "edit", enrollment: en })}
                            disabled={busy}
                            aria-label="Edit enrollment"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openModal({ type: "delete", enrollment: en })}
                            disabled={busy}
                            aria-label="Delete enrollment"
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
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
              Previous
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {(modal?.type === "add" || modal?.type === "edit") && (
        <EnrollmentModal
          editing={modal.type === "edit" ? modal.enrollment : null}
          learningPaths={learningPaths}
          companies={companies}
          branches={branches}
          departments={departments}
          designations={designations}
          employees={employees}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {modal?.type === "delete" && (
        <DeleteDialog
          name={getTargetLabel(modal.enrollment)}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
   );
}