import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadProgress,
  createProgress,
  saveProgress,
  removeProgress,
  toggleActive,
} from "../../services/learningPathProgress/learningPathProgressService";
import { loadLearningPaths } from "../../services/learningPath/learningPathService";
import { loadCourses }       from "../../services/course/courseService";
import { employeeService }   from "../../services/employee/employeeService";

import type {
  LearningPathProgress,
  LearningPathProgressForm,
  ProgressStatus,
} from "../../types/learningPathProgress";
import type { LearningPath } from "../../types/learningPath";
import type { Course }       from "../../types/course";
import type { Employee }     from "../../types/employee";
import { defaultProgressForm } from "../../types/learningPathProgress";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

const STATUS_OPTIONS: { value: ProgressStatus; label: string }[] = [
  { value: "not_started", label: "Not Started" },
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

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

function statusCls(s: ProgressStatus): string {
  const map: Record<ProgressStatus, string> = {
    not_started: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    in_progress: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    completed:   "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    cancelled:   "bg-red-50 text-red-700 ring-1 ring-red-200",
  };
  return map[s] ?? "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
}

function progressBarCls(pct: number): string {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 50)  return "bg-amber-400";
  return "bg-yellow-500";
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No progress records found" : "No progress records yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search ? `No results for "${search}".` : "Add a progress record to track learning journey."}
      </p>
      {!search && (
        <button onClick={onAdd} className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95">
          Add Progress Record
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
        <h3 id="dd-title" className="mb-1 text-lg font-semibold text-slate-800">Delete Progress Record</h3>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to delete the progress record for <span className="font-semibold text-slate-700">{name}</span>? This cannot be undone.
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
// Progress form modal
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  enrollment_id?: string;
  learning_path_id?: string;
  employee_id?: string;
  progress_percentage?: string;
  completed_courses?: string;
  status?: string;
}

function ProgressModal({
  editing,
  learningPaths,
  courses,
  employees,
  saving,
  onSave,
  onClose,
}: {
  editing: LearningPathProgress | null;
  learningPaths: LearningPath[];
  courses: Course[];
  employees: Employee[];
  saving: boolean;
  onSave: (data: LearningPathProgressForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<LearningPathProgressForm>(() =>
    isEdit
      ? {
          enrollment_id:         editing.enrollment_id,
          learning_path_id:      editing.learning_path_id,
          employee_id:           editing.employee_id,
          current_course_id:     editing.current_course_id,
          completed_courses:     editing.completed_courses,
          total_courses:         editing.total_courses,
          progress_percentage:   editing.progress_percentage,
          started_at:            editing.started_at,
          last_accessed_at:      editing.last_accessed_at,
          completed_at:          editing.completed_at,
          status:                editing.status,
          certificate_generated: editing.certificate_generated,
          active:                editing.active,
          remarks:               editing.remarks,
        }
      : { ...defaultProgressForm }
  );

  const [errs, setErrs] = useState<FormErrs>({});
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  function field<K extends keyof LearningPathProgressForm>(
    key: K,
    val: LearningPathProgressForm[K]
  ) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.enrollment_id.trim())  e.enrollment_id   = "Enrollment ID is required.";
    if (!form.learning_path_id)      e.learning_path_id = "Learning Path is required.";
    if (!form.employee_id)           e.employee_id      = "Employee is required.";

    if (form.progress_percentage < 0 || form.progress_percentage > 100) {
      e.progress_percentage = "Progress Percentage must be between 0 and 100.";
    }

    if (form.total_courses > 0 && form.completed_courses > form.total_courses) {
      e.completed_courses = "Completed Courses cannot exceed Total Courses.";
    }

    const allowed: ProgressStatus[] = ["not_started", "in_progress", "completed", "cancelled"];
    if (!allowed.includes(form.status)) {
      e.status = "Invalid status.";
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
      aria-labelledby="lpp-form-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="lpp-form-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Progress Record" : "Add Progress Record"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update progress details." : "Record learning path progress for an employee."}
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

            {/* ── Identity ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Identity</p>

            <FL label="Enrollment ID" required error={errs.enrollment_id}>
              <input
                ref={firstRef}
                type="text"
                value={form.enrollment_id}
                onChange={(e) => field("enrollment_id", e.target.value)}
                placeholder="UUID of the enrollment record"
                disabled={saving}
                className={CLS_INPUT}
              />
            </FL>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Learning Path" required error={errs.learning_path_id}>
                <select value={form.learning_path_id}
                  onChange={(e) => field("learning_path_id", e.target.value)}
                  disabled={saving} className={CLS_SELECT}>
                  <option value="">— Select Learning Path —</option>
                  {learningPaths.map((lp) => (
                    <option key={lp.id} value={lp.id}>{lp.path_code} — {lp.path_name}</option>
                  ))}
                </select>
              </FL>

              <FL label="Employee" required error={errs.employee_id}>
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
            </div>

            <FL label="Current Course">
              <select value={form.current_course_id}
                onChange={(e) => field("current_course_id", e.target.value)}
                disabled={saving} className={CLS_SELECT}>
                <option value="">— None —</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.course_name}</option>
                ))}
              </select>
            </FL>

            {/* ── Progress ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Progress</p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <FL label="Completed Courses" error={errs.completed_courses}>
                <input type="number" min={0} value={form.completed_courses}
                  onChange={(e) =>
                    field("completed_courses", Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  disabled={saving} className={CLS_INPUT} />
              </FL>

              <FL label="Total Courses">
                <input type="number" min={0} value={form.total_courses}
                  onChange={(e) =>
                    field("total_courses", Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  disabled={saving} className={CLS_INPUT} />
              </FL>

              <FL label="Progress %" required error={errs.progress_percentage}>
                <input type="number" min={0} max={100} step={0.1} value={form.progress_percentage}
                  onChange={(e) =>
                    field(
                      "progress_percentage",
                      Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                    )
                  }
                  disabled={saving} className={CLS_INPUT} />
              </FL>
            </div>

            <FL label="Status" required error={errs.status}>
              <select value={form.status}
                onChange={(e) => field("status", e.target.value as ProgressStatus)}
                disabled={saving} className={CLS_SELECT}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </FL>

            {/* ── Timestamps ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Timestamps</p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <FL label="Started At">
                <input type="datetime-local"
                  value={form.started_at ? form.started_at.slice(0, 16) : ""}
                  onChange={(e) => field("started_at", e.target.value || null)}
                  disabled={saving} className={CLS_INPUT} />
              </FL>
              <FL label="Last Accessed At">
                <input type="datetime-local"
                  value={form.last_accessed_at ? form.last_accessed_at.slice(0, 16) : ""}
                  onChange={(e) => field("last_accessed_at", e.target.value || null)}
                  disabled={saving} className={CLS_INPUT} />
              </FL>
              <FL label="Completed At">
                <input type="datetime-local"
                  value={form.completed_at ? form.completed_at.slice(0, 16) : ""}
                  onChange={(e) => field("completed_at", e.target.value || null)}
                  disabled={saving} className={CLS_INPUT} />
              </FL>
            </div>

            {/* ── Status flags ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Flags</p>

            <div className="flex flex-wrap gap-y-4 gap-x-8 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <ToggleRow
                label="Certificate Generated"
                sub="Certificate has been issued for this path"
                on={form.certificate_generated}
                onChange={() => field("certificate_generated", !form.certificate_generated)}
                disabled={saving}
              />
              <ToggleRow
                label="Active"
                sub="Progress record is current"
                on={form.active}
                onChange={() => field("active", !form.active)}
                disabled={saving}
              />
            </div>

            <FL label="Remarks">
              <textarea value={form.remarks}
                onChange={(e) => field("remarks", e.target.value)}
                placeholder="Optional notes"
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
              {saving ? "Saving…" : isEdit ? "Update Progress" : "Add Progress"}
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
  | { type: "edit"; progress: LearningPathProgress }
  | { type: "delete"; progress: LearningPathProgress }
  | null;

export default function LearningPathProgressManagement() {

  const [progressList,  setProgressList]  = useState<LearningPathProgress[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [courses,       setCourses]       = useState<Course[]>([]);
  const [employees,     setEmployees]     = useState<Employee[]>([]);

  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [search,       setSearch]       = useState("");
  const [pathFilter,   setPathFilter]   = useState("");
  const [empFilter,    setEmpFilter]    = useState("");
  const [statusFilter, setStatusFilter] = useState<ProgressStatus | "">("");
  const [page,         setPage]         = useState(1);
  const [banner,       setBanner]       = useState("");
  const [modal,        setModal]        = useState<ModalKind>(null);

  const addBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  // ── Derived
  const filtered = useMemo(() => {
    let rows = progressList;
    if (pathFilter)   rows = rows.filter((r) => r.learning_path_id === pathFilter);
    if (empFilter)    rows = rows.filter((r) => r.employee_id       === empFilter);
    if (statusFilter) rows = rows.filter((r) => r.status            === statusFilter);
    const kw = search.trim().toLowerCase();
    if (kw) {
      rows = rows.filter((r) => {
        const lpName = findName(learningPaths, r.learning_path_id, "path_name");
        const en     = empName(employees, r.employee_id);
        return (
          lpName.toLowerCase().includes(kw) ||
          en.toLowerCase().includes(kw) ||
          r.status.toLowerCase().includes(kw) ||
          (r.remarks ?? "").toLowerCase().includes(kw)
        );
      });
    }
    return rows;
  }, [progressList, learningPaths, employees, search, pathFilter, empFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PER_PAGE;
  const pageRows   = filtered.slice(pageStart, pageStart + PER_PAGE);

  useEffect(() => { setPage(1); }, [search, pathFilter, empFilter, statusFilter]);

  // ── Load
  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      const [pgData, lpData, cData, emData] = await Promise.all([
        loadProgress(),
        loadLearningPaths(),
        loadCourses(),
        employeeService.getAll(),
      ]);
      setProgressList(pgData);
      setLearningPaths(lpData);
      setCourses(cData);
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
    async (data: LearningPathProgressForm) => {
      setSaving(true);
      try {
        if (modal?.type === "edit") {
          await saveProgress(modal.progress.id, data);
        } else {
          await createProgress(data);
        }
        await load();
        setBanner("");
        closeModal();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Unable to save progress record.");
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
      await removeProgress(modal.progress.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to delete progress record.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle active — optimistic
  async function handleToggle(progress: LearningPathProgress) {
    setTogglingId(progress.id);
    try {
      await toggleActive(progress.id, !progress.active);
      setProgressList((prev) =>
        prev.map((r) => r.id === progress.id ? { ...r, active: !progress.active } : r)
      );
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to update status.");
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
          <h2 className="text-xl font-bold text-slate-800">Learning Path Progress</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Track and manage employee progress through learning paths.
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
            Add Progress Record
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 border-b border-slate-100 px-6 py-4">
        <div className="relative min-w-[200px] flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by path, employee, status…"
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

        <select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30">
          <option value="">All Employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {[e.first_name, e.last_name].filter(Boolean).join(" ")} — {e.employee_code}
            </option>
          ))}
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ProgressStatus | "")}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {!loading && (
          <p className="self-center text-sm text-slate-400">
            {filtered.length} {filtered.length === 1 ? "record" : "records"}
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
                    { h: "Employee",     cls: "text-left"      },
                    { h: "Learning Path",cls: "text-left"      },
                    { h: "Progress",     cls: "text-left w-36" },
                    { h: "Courses",      cls: "text-center"    },
                    { h: "Status",       cls: "text-center"    },
                    { h: "Last Accessed",cls: "text-left"      },
                    { h: "Completed",    cls: "text-left"      },
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
                {pageRows.map((prog, i) => {
                  const busy = togglingId === prog.id;
                  const pct  = Math.round(prog.progress_percentage);
                  return (
                    <tr key={prog.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">{pageStart + i + 1}</td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{empName(employees, prog.employee_id)}</p>
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        <p>{findName(learningPaths, prog.learning_path_id, "path_name")}</p>
                        <p className="text-xs text-slate-400">{findName(learningPaths, prog.learning_path_id, "path_code")}</p>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all ${progressBarCls(pct)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-600">{pct}%</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center text-slate-600">
                        {prog.completed_courses}/{prog.total_courses}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCls(prog.status)}`}>
                          {STATUS_OPTIONS.find((s) => s.value === prog.status)?.label ?? prog.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-500">
                        {fmtDate(prog.last_accessed_at)}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-500">
                        {fmtDate(prog.completed_at)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggle(prog)}
                          disabled={busy}
                          aria-label="Toggle active"
                          className="disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            prog.active
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${prog.active ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {prog.active ? "Active" : "Inactive"}
                          </span>
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal({ type: "edit", progress: prog })}
                            disabled={busy}
                            aria-label="Edit progress"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openModal({ type: "delete", progress: prog })}
                            disabled={busy}
                            aria-label="Delete progress"
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
        <ProgressModal
          editing={modal.type === "edit" ? modal.progress : null}
          learningPaths={learningPaths}
          courses={courses}
          employees={employees}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {modal?.type === "delete" && (
        <DeleteDialog
          name={empName(employees, modal.progress.employee_id)}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
  );
}
