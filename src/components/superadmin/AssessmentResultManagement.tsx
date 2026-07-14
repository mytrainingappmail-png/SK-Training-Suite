import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadResults,
  createResult,
  saveResult,
  removeResult,
  togglePublished,
} from "../../services/assessmentResult/assessmentResultService";
import { loadAssessments } from "../../services/assessment/assessmentService";
import { employeeService } from "../../services/employee/employeeService";

import type { AssessmentResult, AssessmentResultForm } from "../../types/assessmentResult";
import type { Assessment } from "../../types/assessment";
import type { Employee } from "../../types/employee";
import { defaultAssessmentResultForm } from "../../types/assessmentResult";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

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

function employeeFullName(employees: Employee[], id: string): string {
  if (!id) return "—";
  const emp = employees.find((e) => e.id === id);
  if (!emp) return "—";
  return [emp.first_name, emp.last_name].filter(Boolean).join(" ") || emp.employee_code;
}

function gradeColour(grade: string): string {
  if (!grade) return "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
  const g = grade.trim().toUpperCase();
  if (g === "A+" || g === "A") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (g === "B")               return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
  if (g === "C")               return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  if (g === "D")               return "bg-orange-50 text-orange-700 ring-1 ring-orange-200";
  return "bg-red-50 text-red-700 ring-1 ring-red-200";
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

function PassBadge({ passed }: { passed: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        passed
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-red-50 text-red-700 ring-1 ring-red-200"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${passed ? "bg-emerald-500" : "bg-red-500"}`} />
      {passed ? "Pass" : "Fail"}
    </span>
  );
}

function PublishedPill({ published }: { published: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        published
          ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
          : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${published ? "bg-blue-500" : "bg-slate-400"}`} />
      {published ? "Published" : "Draft"}
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
          <div className="h-10 w-28 rounded bg-slate-100" />
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

function EmptyState({ search, onAdd }: { search: string; onAdd: () => void }) {
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
            d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75"
          />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No results found" : "No assessment results yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search
          ? `No results for "${search}".`
          : "Add assessment results to track employee performance."}
      </p>
      {!search && (
        <button
          onClick={onAdd}
          className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
        >
          Add Result
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
        <h3 id="dd-title" className="mb-1 text-lg font-semibold text-slate-800">
          Delete Result
        </h3>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to delete the result for{" "}
          <span className="font-semibold text-slate-700">{name}</span>? This cannot be undone.
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
// Result form modal
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  assessment_id?: string;
  employee_id?: string;
  attempt_id?: string;
  percentage?: string;
  obtained_marks?: string;
  rank?: string;
}

function ResultModal({
  editing,
  assessments,
  employees,
  saving,
  onSave,
  onClose,
}: {
  editing: AssessmentResult | null;
  assessments: Assessment[];
  employees: Employee[];
  saving: boolean;
  onSave: (data: AssessmentResultForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<AssessmentResultForm>(() =>
    isEdit
      ? {
          attempt_id:            editing.attempt_id,
          assessment_id:         editing.assessment_id,
          employee_id:           editing.employee_id,
          total_marks:           editing.total_marks,
          obtained_marks:        editing.obtained_marks,
          percentage:            editing.percentage,
          passed:                editing.passed,
          grade:                 editing.grade,
          rank:                  editing.rank,
          certificate_generated: editing.certificate_generated,
          evaluated_at:          editing.evaluated_at,
          published:             editing.published,
          remarks:               editing.remarks,
        }
      : { ...defaultAssessmentResultForm }
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

  function field<K extends keyof AssessmentResultForm>(
    key: K,
    val: AssessmentResultForm[K]
  ) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.assessment_id) e.assessment_id = "Assessment is required.";
    if (!form.employee_id)   e.employee_id   = "Employee is required.";
    if (!form.attempt_id.trim()) e.attempt_id = "Attempt ID is required.";

    if (form.percentage < 0 || form.percentage > 100) {
      e.percentage = "Percentage must be between 0 and 100.";
    }

    if (form.obtained_marks > form.total_marks) {
      e.obtained_marks = "Obtained Marks cannot exceed Total Marks.";
    }

    if (form.rank < 1) {
      e.rank = "Rank must be greater than zero.";
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ar-form-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!saving ? onClose : undefined}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="ar-form-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Result" : "Add Result"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update result details." : "Enter assessment result details."}
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

        <form onSubmit={onSubmit} noValidate>
          <div className="space-y-5 p-6">

            {/* ── Identity ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Identity</p>

            <FL label="Assessment" required error={errs.assessment_id}>
              <select
                ref={firstRef}
                value={form.assessment_id}
                onChange={(e) => field("assessment_id", e.target.value)}
                disabled={saving}
                className={CLS_SELECT}
              >
                <option value="">— Select Assessment —</option>
                {assessments.map((a) => (
                  <option key={a.id} value={a.id}>{a.assessment_title}</option>
                ))}
              </select>
            </FL>

            <FL label="Employee" required error={errs.employee_id}>
              <select
                value={form.employee_id}
                onChange={(e) => field("employee_id", e.target.value)}
                disabled={saving}
                className={CLS_SELECT}
              >
                <option value="">— Select Employee —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {[e.first_name, e.last_name].filter(Boolean).join(" ")} — {e.employee_code}
                  </option>
                ))}
              </select>
            </FL>

            <FL label="Attempt ID" required error={errs.attempt_id}>
              <input
                type="text"
                value={form.attempt_id}
                onChange={(e) => field("attempt_id", e.target.value)}
                placeholder="UUID of the assessment attempt"
                disabled={saving}
                className={CLS_INPUT}
              />
            </FL>

            {/* ── Scores ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Scores</p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <FL label="Total Marks">
                <input
                  type="number"
                  min={0}
                  value={form.total_marks}
                  onChange={(e) =>
                    field("total_marks", Math.max(0, parseFloat(e.target.value) || 0))
                  }
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>

              <FL label="Obtained Marks" error={errs.obtained_marks}>
                <input
                  type="number"
                  min={0}
                  value={form.obtained_marks}
                  onChange={(e) =>
                    field("obtained_marks", Math.max(0, parseFloat(e.target.value) || 0))
                  }
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>

              <FL label="Percentage (%)" required error={errs.percentage}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.percentage}
                  onChange={(e) =>
                    field(
                      "percentage",
                      Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                    )
                  }
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Grade">
                <input
                  type="text"
                  value={form.grade}
                  onChange={(e) => field("grade", e.target.value)}
                  placeholder="e.g. A, B+, C"
                  maxLength={10}
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>

              <FL label="Rank" error={errs.rank}>
                <input
                  type="number"
                  min={1}
                  value={form.rank}
                  onChange={(e) =>
                    field("rank", Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
            </div>

            <FL label="Evaluated At">
              <input
                type="datetime-local"
                value={form.evaluated_at ? form.evaluated_at.slice(0, 16) : ""}
                onChange={(e) => field("evaluated_at", e.target.value)}
                disabled={saving}
                className={CLS_INPUT}
              />
            </FL>

            {/* ── Status ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status</p>

            <div className="flex flex-wrap gap-y-4 gap-x-8 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <ToggleRow
                label="Passed"
                sub="Employee met the passing threshold"
                on={form.passed}
                onChange={() => field("passed", !form.passed)}
                disabled={saving}
              />
              <ToggleRow
                label="Certificate Generated"
                sub="Certificate has been issued"
                on={form.certificate_generated}
                onChange={() => field("certificate_generated", !form.certificate_generated)}
                disabled={saving}
              />
              <ToggleRow
                label="Published"
                sub="Result is visible to the employee"
                on={form.published}
                onChange={() => field("published", !form.published)}
                disabled={saving}
              />
            </div>

            {/* ── Remarks ── */}
            <FL label="Remarks">
              <textarea
                value={form.remarks}
                onChange={(e) => field("remarks", e.target.value)}
                placeholder="Optional internal notes"
                rows={2}
                disabled={saving}
                className={CLS_TEXTAREA}
              />
            </FL>

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
              {saving ? "Saving…" : isEdit ? "Update Result" : "Add Result"}
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
  | { type: "edit"; result: AssessmentResult }
  | { type: "delete"; result: AssessmentResult }
  | null;

export default function AssessmentResultManagement() {

  const [results,     setResults]     = useState<AssessmentResult[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [employees,   setEmployees]   = useState<Employee[]>([]);

  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [search,             setSearch]             = useState("");
  const [assessmentFilter,   setAssessmentFilter]   = useState("");
  const [employeeFilter,     setEmployeeFilter]      = useState("");
  const [page,               setPage]               = useState(1);
  const [banner,             setBanner]             = useState("");
  const [modal,              setModal]              = useState<ModalKind>(null);

  const addBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  // ── Derived
  const filtered = useMemo(() => {
    let rows = results;

    if (assessmentFilter) {
      rows = rows.filter((r) => r.assessment_id === assessmentFilter);
    }

    if (employeeFilter) {
      rows = rows.filter((r) => r.employee_id === employeeFilter);
    }

    const kw = search.trim().toLowerCase();
    if (kw) {
      rows = rows.filter((r) => {
        const aName = assessments.find((a) => a.id === r.assessment_id)?.assessment_title ?? "";
        const eName = employeeFullName(employees, r.employee_id);
        return (
          aName.toLowerCase().includes(kw) ||
          eName.toLowerCase().includes(kw) ||
          (r.grade ?? "").toLowerCase().includes(kw) ||
          (r.remarks ?? "").toLowerCase().includes(kw)
        );
      });
    }

    return rows;
  }, [results, assessments, employees, search, assessmentFilter, employeeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PER_PAGE;
  const pageRows   = filtered.slice(pageStart, pageStart + PER_PAGE);

  useEffect(() => { setPage(1); }, [search, assessmentFilter, employeeFilter]);

  // ── Load
  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      const [resultData, assessmentData, employeeData] = await Promise.all([
        loadResults(),
        loadAssessments(),
        employeeService.getAll(),
      ]);
      setResults(resultData);
      setAssessments(assessmentData);
      setEmployees(employeeData);
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
    async (data: AssessmentResultForm) => {
      setSaving(true);
      try {
        if (modal?.type === "edit") {
          await saveResult(modal.result.id, data);
        } else {
          await createResult(data);
        }
        await load();
        setBanner("");
        closeModal();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Unable to save result.");
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
      await removeResult(modal.result.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to delete result.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle published — optimistic
  async function handleTogglePublished(result: AssessmentResult) {
    setTogglingId(result.id);
    try {
      await togglePublished(result.id, !result.published);
      setResults((prev) =>
        prev.map((r) => r.id === result.id ? { ...r, published: !result.published } : r)
      );
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to update published status.");
      await load();
    } finally {
      setTogglingId(null);
    }
  }

  // ── Render
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Assessment Results</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            View and manage employee assessment results.
          </p>
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
            Add Result
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 border-b border-slate-100 px-6 py-4">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, grade, remarks…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-yellow-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Assessment filter */}
        <select
          value={assessmentFilter}
          onChange={(e) => setAssessmentFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
        >
          <option value="">All Assessments</option>
          {assessments.map((a) => (
            <option key={a.id} value={a.id}>{a.assessment_title}</option>
          ))}
        </select>

        {/* Employee filter */}
        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
        >
          <option value="">All Employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {[e.first_name, e.last_name].filter(Boolean).join(" ")} — {e.employee_code}
            </option>
          ))}
        </select>

        {!loading && (
          <p className="self-center text-sm text-slate-400">
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
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
                    { h: "#",           cls: "w-10 text-left" },
                    { h: "Employee",    cls: "text-left"      },
                    { h: "Assessment",  cls: "text-left"      },
                    { h: "%",           cls: "text-center"    },
                    { h: "Marks",       cls: "text-center"    },
                    { h: "Grade",       cls: "text-center"    },
                    { h: "Rank",        cls: "text-center"    },
                    { h: "Result",      cls: "text-center"    },
                    { h: "Cert",        cls: "text-center"    },
                    { h: "Published",   cls: "text-center"    },
                    { h: "Actions",     cls: "text-right"     },
                  ].map(({ h, cls }) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${cls}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.map((result, i) => {
                  const busy = togglingId === result.id;
                  return (
                    <tr key={result.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">{pageStart + i + 1}</td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">
                          {employeeFullName(employees, result.employee_id)}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {findName(assessments, result.assessment_id, "assessment_title")}
                      </td>

                      <td className="px-4 py-3 text-center font-semibold text-slate-700">
                        {result.percentage.toFixed(1)}%
                      </td>

                      <td className="px-4 py-3 text-center text-slate-600">
                        {result.obtained_marks} / {result.total_marks}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {result.grade ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${gradeColour(result.grade)}`}>
                            {result.grade}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center text-slate-600">
                        {result.rank > 0 ? `#${result.rank}` : "—"}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <PassBadge passed={result.passed} />
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            result.certificate_generated
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-slate-100 text-slate-400 ring-1 ring-slate-200"
                          }`}
                        >
                          {result.certificate_generated ? "Yes" : "No"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleTogglePublished(result)}
                          disabled={busy}
                          aria-label="Toggle published"
                          className="disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <PublishedPill published={result.published} />
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal({ type: "edit", result })}
                            disabled={busy}
                            aria-label="Edit result"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openModal({ type: "delete", result })}
                            disabled={busy}
                            aria-label="Delete result"
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
        <ResultModal
          editing={modal.type === "edit" ? modal.result : null}
          assessments={assessments}
          employees={employees}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {modal?.type === "delete" && (
        <DeleteDialog
          name={employeeFullName(employees, modal.result.employee_id)}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
  );
}
