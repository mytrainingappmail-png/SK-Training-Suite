import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadAssignments,
  createAssignment,
  saveAssignment,
  removeAssignment,
  toggleAssignmentStatus,
} from "../../services/assessmentAssignment/assessmentAssignmentService";
import { loadAssessments } from "../../services/assessment/assessmentService";
import { loadCompanies } from "../../services/company/companyService";
import { branchService } from "../../services/branch/branchService";
import { departmentService } from "../../services/department/departmentService";
import { designationService } from "../../services/designation/designationService";
import { employeeService } from "../../services/employee/employeeService";

import type {
  AssessmentAssignment,
  AssessmentAssignmentForm,
  AssignmentType,
  AssignmentStatus,
} from "../../types/assessmentAssignment";
import type { Assessment } from "../../types/assessment";
import type { Company } from "../../types/company";
import type { Branch } from "../../types/branch";
import type { Department } from "../../types/department";
import type { Designation } from "../../types/designation";
import type { Employee } from "../../types/employee";
import { defaultAssignmentForm } from "../../types/assessmentAssignment";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

const ASSIGNMENT_TYPES: { value: AssignmentType; label: string }[] = [
  { value: "company",     label: "Company"     },
  { value: "branch",      label: "Branch"      },
  { value: "department",  label: "Department"  },
  { value: "designation", label: "Designation" },
  { value: "employee",    label: "Employee"    },
];

const STATUS_OPTIONS: { value: AssignmentStatus; label: string }[] = [
  { value: "scheduled",   label: "Scheduled"   },
  { value: "published",   label: "Published"   },
  { value: "in_progress", label: "In Progress" },
  { value: "completed",   label: "Completed"   },
  { value: "expired",     label: "Expired"     },
  { value: "cancelled",   label: "Cancelled"   },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function findName<T extends { id: string }>(
  list: T[],
  id: string,
  key: keyof T
): string {
  if (!id) return "—";
  const m = list.find((x) => x.id === id);
  return m ? String(m[key]) : "—";
}

function statusColour(s: AssignmentStatus): string {
  const map: Record<AssignmentStatus, string> = {
    scheduled:   "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    published:   "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    in_progress: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    completed:   "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    expired:     "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    cancelled:   "bg-red-50 text-red-700 ring-1 ring-red-200",
  };
  return map[s] ?? "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
}

function statusLabel(s: AssignmentStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

function typeLabel(t: AssignmentType): string {
  return ASSIGNMENT_TYPES.find((o) => o.value === t)?.label ?? t;
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

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />
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
    <svg
      className={`h-4 w-4 ${spin ? "animate-spin" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No assignments found" : "No assignments yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search ? `No results for "${search}".` : "Assign your first assessment to get started."}
      </p>
      {!search && (
        <button onClick={onAdd} className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95">
          Add Assignment
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
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !busy) onCancel(); }
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
        <h3 id="dd-title" className="mb-1 text-lg font-semibold text-slate-800">Delete Assignment</h3>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to delete the assignment for <span className="font-semibold text-slate-700">{name}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button ref={ref} onClick={onCancel} disabled={busy} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={busy} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 active:scale-95">
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assignment form modal
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  assessment_id?: string;
  assignment_type?: string;
  target?: string;
  maximum_attempts?: string;
  date_range?: string;
}

function AssignmentModal({
  editing,
  assessments,
  companies,
  branches,
  departments,
  designations,
  employees,
  saving,
  onSave,
  onClose,
}: {
  editing: AssessmentAssignment | null;
  assessments: Assessment[];
  companies: Company[];
  branches: Branch[];
  departments: Department[];
  designations: Designation[];
  employees: Employee[];
  saving: boolean;
  onSave: (data: AssessmentAssignmentForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<AssessmentAssignmentForm>(() =>
    isEdit
      ? {
          assessment_id:       editing.assessment_id,
          company_id:          editing.company_id,
          branch_id:           editing.branch_id,
          department_id:       editing.department_id,
          designation_id:      editing.designation_id,
          employee_id:         editing.employee_id,
          assignment_type:     editing.assignment_type,
          assigned_date:       editing.assigned_date,
          start_date:          editing.start_date,
          end_date:            editing.end_date,
          mandatory:           editing.mandatory,
          allow_retake:        editing.allow_retake,
          maximum_attempts:    editing.maximum_attempts,
          assignment_status:   editing.assignment_status,
          completion_required: editing.completion_required,
          notify_employee:     editing.notify_employee,
          remarks:             editing.remarks,
          active:              editing.active,
        }
      : { ...defaultAssignmentForm }
  );

  const [errs, setErrs] = useState<FormErrs>({});
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !saving) onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  function field<K extends keyof AssessmentAssignmentForm>(
    key: K,
    val: AssessmentAssignmentForm[K]
  ) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined, target: undefined, date_range: undefined }));
  }

  function handleTypeChange(t: AssignmentType) {
    // Clear all target fields when type changes
    setForm((p) => ({
      ...p,
      assignment_type: t,
      company_id:      "",
      branch_id:       "",
      department_id:   "",
      designation_id:  "",
      employee_id:     "",
    }));
    setErrs((p) => ({ ...p, assignment_type: undefined, target: undefined }));
  }

  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.assessment_id)   e.assessment_id   = "Assessment is required.";
    if (!form.assignment_type) e.assignment_type = "Assignment Type is required.";

    // Exactly one target
    const targetMap: Record<AssignmentType, string> = {
      company:     form.company_id,
      branch:      form.branch_id,
      department:  form.department_id,
      designation: form.designation_id,
      employee:    form.employee_id,
    };
    if (form.assignment_type && !targetMap[form.assignment_type]) {
      e.target = `${typeLabel(form.assignment_type)} is required.`;
    }

    if (form.maximum_attempts < 1) {
      e.maximum_attempts = "Maximum Attempts must be at least 1.";
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

  const t = form.assignment_type;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aa-form-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="aa-form-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Assignment" : "Add Assignment"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update assignment details." : "Assign an assessment to a target group."}
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

            {/* ── Assignment Target ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Assignment Target</p>

            {/* Assessment */}
            <FL label="Assessment" required error={errs.assessment_id}>
              <select ref={firstRef} value={form.assessment_id}
                onChange={(e) => field("assessment_id", e.target.value)}
                disabled={saving} className={CLS_SELECT}>
                <option value="">— Select Assessment —</option>
                {assessments.map((a) => (
                  <option key={a.id} value={a.id}>{a.assessment_title}</option>
                ))}
              </select>
            </FL>

            {/* Assignment Type */}
            <FL label="Assignment Type" required error={errs.assignment_type}>
              <select value={form.assignment_type}
                onChange={(e) => handleTypeChange(e.target.value as AssignmentType)}
                disabled={saving} className={CLS_SELECT}>
                {ASSIGNMENT_TYPES.map((at) => (
                  <option key={at.value} value={at.value}>{at.label}</option>
                ))}
              </select>
            </FL>

            {/* Target selector — exactly one shown based on type */}
            {t === "company" && (
              <FL label="Company" required error={errs.target}>
                <select value={form.company_id} onChange={(e) => field("company_id", e.target.value)} disabled={saving} className={CLS_SELECT}>
                  <option value="">— Select Company —</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </FL>
            )}

            {t === "branch" && (
              <FL label="Branch" required error={errs.target}>
                <select value={form.branch_id} onChange={(e) => field("branch_id", e.target.value)} disabled={saving} className={CLS_SELECT}>
                  <option value="">— Select Branch —</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
                </select>
              </FL>
            )}

            {t === "department" && (
              <FL label="Department" required error={errs.target}>
                <select value={form.department_id} onChange={(e) => field("department_id", e.target.value)} disabled={saving} className={CLS_SELECT}>
                  <option value="">— Select Department —</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
                </select>
              </FL>
            )}

            {t === "designation" && (
              <FL label="Designation" required error={errs.target}>
                <select value={form.designation_id} onChange={(e) => field("designation_id", e.target.value)} disabled={saving} className={CLS_SELECT}>
                  <option value="">— Select Designation —</option>
                  {designations.map((d) => <option key={d.id} value={d.id}>{d.designation_name}</option>)}
                </select>
              </FL>
            )}

            {t === "employee" && (
              <FL label="Employee" required error={errs.target}>
                <select value={form.employee_id} onChange={(e) => field("employee_id", e.target.value)} disabled={saving} className={CLS_SELECT}>
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
              <FL label="Assigned Date">
                <input type="date" value={form.assigned_date}
                  onChange={(e) => field("assigned_date", e.target.value)}
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

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Maximum Attempts" error={errs.maximum_attempts}>
                <input type="number" min={1} value={form.maximum_attempts}
                  onChange={(e) => field("maximum_attempts", Math.max(1, parseInt(e.target.value, 10) || 1))}
                  disabled={saving} className={CLS_INPUT} />
              </FL>
              <FL label="Assignment Status">
                <select value={form.assignment_status}
                  onChange={(e) => field("assignment_status", e.target.value as AssignmentStatus)}
                  disabled={saving} className={CLS_SELECT}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </FL>
            </div>

            <div className="flex flex-wrap gap-y-4 gap-x-8 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <ToggleRow label="Mandatory" sub="Learner must complete this assessment"
                on={form.mandatory} onChange={() => field("mandatory", !form.mandatory)} disabled={saving} />
              <ToggleRow label="Allow Retake" sub="Allow learner to retake after completion"
                on={form.allow_retake} onChange={() => field("allow_retake", !form.allow_retake)} disabled={saving} />
              <ToggleRow label="Completion Required" sub="Required for progress tracking"
                on={form.completion_required} onChange={() => field("completion_required", !form.completion_required)} disabled={saving} />
              <ToggleRow label="Notify Employee" sub="Send notification to assigned learner"
                on={form.notify_employee} onChange={() => field("notify_employee", !form.notify_employee)} disabled={saving} />
              <ToggleRow label="Active" sub="Assignment is live"
                on={form.active} onChange={() => field("active", !form.active)} disabled={saving} />
            </div>

            {/* Remarks */}
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
              {saving ? "Saving…" : isEdit ? "Update Assignment" : "Add Assignment"}
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
  | { type: "edit"; assignment: AssessmentAssignment }
  | { type: "delete"; assignment: AssessmentAssignment }
  | null;

export default function AssessmentAssignmentManagement() {

  // ── Single source of truth
  const [assignments,  setAssignments]  = useState<AssessmentAssignment[]>([]);
  const [assessments,  setAssessments]  = useState<Assessment[]>([]);
  const [companies,    setCompanies]    = useState<Company[]>([]);
  const [branches,     setBranches]     = useState<Branch[]>([]);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [employees,    setEmployees]    = useState<Employee[]>([]);

  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);
  const [banner, setBanner] = useState("");
  const [modal,  setModal]  = useState<ModalKind>(null);

  const addBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  // ── Derived
  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return assignments;
    return assignments.filter((a) => {
      const asmTitle = assessments.find((x) => x.id === a.assessment_id)?.assessment_title ?? "";
      return (
        asmTitle.toLowerCase().includes(kw) ||
        a.assignment_type.toLowerCase().includes(kw) ||
        a.assignment_status.toLowerCase().includes(kw)
      );
    });
  }, [assignments, assessments, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PER_PAGE;
  const pageRows   = filtered.slice(pageStart, pageStart + PER_PAGE);

  useEffect(() => { setPage(1); }, [search]);

  // ── Load everything once
  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      const [asgData, asmData, coData, brData, deData, dgData, emData] =
        await Promise.all([
          loadAssignments(),
          loadAssessments(),
          loadCompanies(),
          branchService.getAll(),
          departmentService.getAll(),
          designationService.getAll(),
          employeeService.getAll(),
        ]);
      setAssignments(asgData);
      setAssessments(asmData);
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
    async (data: AssessmentAssignmentForm) => {
      setSaving(true);
      try {
        if (modal?.type === "edit") {
          await saveAssignment(modal.assignment.id, data);
        } else {
          await createAssignment(data);
        }
        await load();
        setBanner("");
        closeModal();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Unable to save assignment.");
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
      await removeAssignment(modal.assignment.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to delete assignment.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle — optimistic
  async function handleToggle(assignment: AssessmentAssignment) {
    setTogglingId(assignment.id);
    try {
      await toggleAssignmentStatus(assignment.id, !assignment.active);
      setAssignments((prev) =>
        prev.map((a) => a.id === assignment.id ? { ...a, active: !assignment.active } : a)
      );
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to update status.");
      await load();
    } finally {
      setTogglingId(null);
    }
  }

  // ── Target display helper
  function getTargetName(a: AssessmentAssignment): string {
    switch (a.assignment_type) {
      case "company":     return findName(companies,    a.company_id,     "company_name");
      case "branch":      return findName(branches,     a.branch_id,      "branch_name");
      case "department":  return findName(departments,  a.department_id,  "department_name");
      case "designation": return findName(designations, a.designation_id, "designation_name");
      case "employee": {
        const emp = employees.find((e) => e.id === a.employee_id);
        return emp
          ? `${[emp.first_name, emp.last_name].filter(Boolean).join(" ")} (${emp.employee_code})`
          : "—";
      }
      default: return "—";
    }
  }

  // ── Render
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Assessment Assignments</h2>
          <p className="mt-0.5 text-sm text-slate-500">Assign assessments to companies, branches, departments, designations or individual employees.</p>
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
            Add Assignment
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-4">
        <div className="relative flex-1 min-w-[240px]">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by assessment, type, status…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-yellow-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/30" />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {!loading && (
          <p className="text-sm text-slate-400">
            {filtered.length} {filtered.length === 1 ? "assignment" : "assignments"}{search && " found"}
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

      {/* Content */}
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
                    { h: "#",           cls: "w-10 text-left" },
                    { h: "Assessment",  cls: "text-left"      },
                    { h: "Type",        cls: "text-left"      },
                    { h: "Target",      cls: "text-left"      },
                    { h: "Start",       cls: "text-left"      },
                    { h: "End",         cls: "text-left"      },
                    { h: "Attempts",    cls: "text-center"    },
                    { h: "Asgmt Status",cls: "text-center"    },
                    { h: "Active",      cls: "text-center"    },
                    { h: "Actions",     cls: "text-right"     },
                  ].map(({ h, cls }) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.map((a, i) => {
                  const busy = togglingId === a.id;
                  return (
                    <tr key={a.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">{pageStart + i + 1}</td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">
                          {findName(assessments, a.assessment_id, "assessment_title")}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                          {typeLabel(a.assignment_type)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">
                        {getTargetName(a)}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {a.start_date || "—"}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {a.end_date || "—"}
                      </td>

                      <td className="px-4 py-3 text-center text-slate-600">
                        {a.maximum_attempts}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColour(a.assignment_status)}`}>
                          {statusLabel(a.assignment_status)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleToggle(a)} disabled={busy}
                          aria-label="Toggle active" className="disabled:cursor-not-allowed disabled:opacity-60">
                          <StatusPill active={a.active} />
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openModal({ type: "edit", assignment: a })} disabled={busy}
                            aria-label="Edit assignment"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button onClick={() => openModal({ type: "delete", assignment: a })} disabled={busy}
                            aria-label="Delete assignment"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40">
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
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* Modals */}
      {(modal?.type === "add" || modal?.type === "edit") && (
        <AssignmentModal
          editing={modal.type === "edit" ? modal.assignment : null}
          assessments={assessments}
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
          name={findName(assessments, modal.assignment.assessment_id, "assessment_title")}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
  );
}
