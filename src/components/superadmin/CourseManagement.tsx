import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadCourses,
  createCourse,
  saveCourse,
  removeCourse,
  toggleCourseStatus,
} from "../../services/course/courseService";
import { loadCompanies } from "../../services/company/companyService";
import { loadCategories } from "../../services/category/categoryService";

import type { Course, CourseForm, CourseLevel } from "../../types/course";
import type { Company } from "../../types/company";
import type { Category } from "../../types/category";
import { defaultCourseForm } from "../../types/course";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

const LEVELS: CourseLevel[] = ["beginner", "intermediate", "advanced"];

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function findName<T extends { id: string }>(
  list: T[],
  id: string,
  key: keyof T
): string {
  if (!id) return "—";
  const match = list.find((x) => x.id === id);
  return match ? String(match[key]) : "—";
}

function capitalize(str: string): string {
  if (!str) return "—";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives  (identical to CategoryManagement / EmployeeManagement)
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
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function CertBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        enabled
          ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
          : "bg-slate-100 text-slate-400 ring-1 ring-slate-200"
      }`}
    >
      {enabled ? "Yes" : "No"}
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
// Thumbnail with broken-image fallback
// ─────────────────────────────────────────────────────────────────────────────

function Thumbnail({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div className="flex h-10 w-16 items-center justify-center rounded-lg bg-slate-100">
        <svg
          className="h-5 w-5 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
          />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      className="h-10 w-16 rounded-lg object-cover"
    />
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
          <div className="h-10 w-16 rounded bg-slate-100" />
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
            d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
          />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No courses found" : "No courses yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search
          ? `No results for "${search}". Try a different keyword.`
          : "Add your first course to get started."}
      </p>
      {!search && (
        <button
          onClick={onAdd}
          className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
        >
          Add Course
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
          Delete Course
        </h3>
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
// Course form modal
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  company_id?: string;
  category_id?: string;
  course_code?: string;
  course_name?: string;
  thumbnail?: string;
  passing_percentage?: string;
  duration_days?: string;
  duration_hours?: string;
}

function CourseModal({
  editing,
  companies,
  categories,
  usedCodes,
  saving,
  onSave,
  onClose,
}: {
  editing: Course | null;
  companies: Company[];
  categories: Category[];
  usedCodes: string[];
  saving: boolean;
  onSave: (data: CourseForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<CourseForm>(() =>
    isEdit
      ? {
          company_id:          editing.company_id,
          category_id:         editing.category_id,
          course_code:         editing.course_code,
          course_name:         editing.course_name,
          short_description:   editing.short_description,
          full_description:    editing.full_description,
          thumbnail:           editing.thumbnail,
          level:               editing.level,
          duration_days:       editing.duration_days,
          duration_hours:      editing.duration_hours,
          passing_percentage:  editing.passing_percentage,
          certificate_enabled: editing.certificate_enabled,
          active:              editing.active,
          created_by:          editing.created_by,
        }
      : { ...defaultCourseForm }
  );

  const [errs, setErrs] = useState<FormErrs>({});
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  function field<K extends keyof CourseForm>(key: K, val: CourseForm[K]) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.company_id)         e.company_id        = "Company is required.";
    if (!form.category_id)        e.category_id       = "Category is required.";
    if (!form.course_code.trim()) e.course_code       = "Course Code is required.";
    if (!form.course_name.trim()) e.course_name       = "Course Name is required.";
    if (!form.thumbnail.trim())   e.thumbnail         = "Thumbnail URL is required.";

    if (form.passing_percentage < 0 || form.passing_percentage > 100) {
      e.passing_percentage = "Passing Percentage must be between 0 and 100.";
    }
    if (form.duration_days < 0) {
      e.duration_days = "Duration days cannot be negative.";
    }
    if (form.duration_hours < 0) {
      e.duration_hours = "Duration hours cannot be negative.";
    }

    const code = form.course_code.trim().toLowerCase();
    if (
      code &&
      usedCodes.includes(code) &&
      (!isEdit || code !== editing.course_code.trim().toLowerCase())
    ) {
      e.course_code = "Course Code already exists.";
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
      aria-labelledby="cm-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!saving ? onClose : undefined}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="cm-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Course" : "Add Course"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update course details." : "Fill in the course details below."}
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

        {/* Form body */}
        <form onSubmit={onSubmit} noValidate>
          <div className="space-y-5 p-6">

            {/* Company */}
            <FL label="Company" required error={errs.company_id}>
              <select
                ref={firstRef}
                value={form.company_id}
                onChange={(e) => field("company_id", e.target.value)}
                disabled={saving}
                className={CLS_SELECT}
              >
                <option value="">— Select Company —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </FL>

            {/* Category */}
            <FL label="Category" required error={errs.category_id}>
              <select
                value={form.category_id}
                onChange={(e) => field("category_id", e.target.value)}
                disabled={saving}
                className={CLS_SELECT}
              >
                <option value="">— Select Category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.category_name}</option>
                ))}
              </select>
            </FL>

            {/* Code + Name */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Course Code" required error={errs.course_code}>
                <input
                  type="text"
                  value={form.course_code}
                  onChange={(e) => field("course_code", e.target.value)}
                  placeholder="e.g. CRS-001"
                  maxLength={30}
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
              <FL label="Course Name" required error={errs.course_name}>
                <input
                  type="text"
                  value={form.course_name}
                  onChange={(e) => field("course_name", e.target.value)}
                  placeholder="e.g. Real Estate Foundation"
                  maxLength={150}
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
            </div>

            {/* Short Description */}
            <FL label="Short Description">
              <textarea
                value={form.short_description}
                onChange={(e) => field("short_description", e.target.value)}
                placeholder="Brief overview of the course"
                rows={2}
                disabled={saving}
                className={CLS_TEXTAREA}
              />
            </FL>

            {/* Full Description */}
            <FL label="Full Description">
              <textarea
                value={form.full_description}
                onChange={(e) => field("full_description", e.target.value)}
                placeholder="Detailed course description"
                rows={4}
                disabled={saving}
                className={CLS_TEXTAREA}
              />
            </FL>

            {/* Thumbnail URL + inline preview */}
            <FL label="Thumbnail URL" required error={errs.thumbnail}>
              <input
                type="url"
                value={form.thumbnail}
                onChange={(e) => field("thumbnail", e.target.value)}
                placeholder="https://example.com/image.jpg"
                disabled={saving}
                className={CLS_INPUT}
              />
              {form.thumbnail && (
                <div className="mt-2">
                  <Thumbnail src={form.thumbnail} alt="Thumbnail preview" />
                </div>
              )}
            </FL>

            {/* Level */}
            <FL label="Level" required>
              <select
                value={form.level}
                onChange={(e) => field("level", e.target.value as CourseLevel)}
                disabled={saving}
                className={CLS_SELECT}
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{capitalize(l)}</option>
                ))}
              </select>
            </FL>

            {/* Duration */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Duration (Days)" error={errs.duration_days}>
                <input
                  type="number"
                  min={0}
                  value={form.duration_days}
                  onChange={(e) =>
                    field("duration_days", Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
              <FL label="Duration (Hours)" error={errs.duration_hours}>
                <input
                  type="number"
                  min={0}
                  value={form.duration_hours}
                  onChange={(e) =>
                    field("duration_hours", Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
            </div>

            {/* Passing Percentage */}
            <FL label="Passing Percentage (%)" required error={errs.passing_percentage}>
              <input
                type="number"
                min={0}
                max={100}
                value={form.passing_percentage}
                onChange={(e) =>
                  field(
                    "passing_percentage",
                    Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0))
                  )
                }
                disabled={saving}
                className={CLS_INPUT}
              />
            </FL>

            {/* Certificate Enabled + Active */}
            <div className="flex flex-wrap gap-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <Toggle
                  on={form.certificate_enabled}
                  onChange={() => field("certificate_enabled", !form.certificate_enabled)}
                  disabled={saving}
                />
                <div>
                  <p className="text-sm font-medium text-slate-700">Certificate Enabled</p>
                  <p className="text-xs text-slate-500">Issue certificate on completion</p>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3">
                <Toggle
                  on={form.active}
                  onChange={() => field("active", !form.active)}
                  disabled={saving}
                />
                <div>
                  <p className="text-sm font-medium text-slate-700">Active</p>
                  <p className="text-xs text-slate-500">Course is published and available</p>
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
              {saving ? "Saving…" : isEdit ? "Update Course" : "Add Course"}
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
  | { type: "edit"; course: Course }
  | { type: "delete"; course: Course }
  | null;

export default function CourseManagement() {

  // ── Single source of truth — loaded once, never duplicated
  const [courses,    setCourses]    = useState<Course[]>([]);
  const [companies,  setCompanies]  = useState<Company[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

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

  // ── Derived — no secondary state
  const usedCodes = useMemo(
    () => courses.map((c) => c.course_code.trim().toLowerCase()),
    [courses]
  );

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return courses;
    return courses.filter(
      (c) =>
        c.course_code.toLowerCase().includes(kw) ||
        c.course_name.toLowerCase().includes(kw) ||
        (c.short_description ?? "").toLowerCase().includes(kw)
    );
  }, [courses, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PER_PAGE;
  const pageRows   = filtered.slice(pageStart, pageStart + PER_PAGE);

  useEffect(() => { setPage(1); }, [search]);

  // ── Load — single Promise.all, no direct Supabase access
  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      const courseData = await loadCourses();
console.log("Courses:", courseData);

const companyData = await loadCompanies();
console.log("Companies:", companyData);

const categoryData = await loadCategories();
console.log("Categories:", categoryData);
      setCourses(courseData);
      setCompanies(companyData);
      setCategories(categoryData);
    } catch (err) {
      console.error(err);
      setBanner("Failed to load data. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Modal focus management
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
    async (data: CourseForm) => {
      setSaving(true);
      try {
        if (modal?.type === "edit") {
          await saveCourse(modal.course.id, data);
        } else {
          await createCourse(data);
        }
        await load();
        setBanner("");
        closeModal();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Unable to save course.");
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
      await removeCourse(modal.course.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to delete course.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle status — optimistic (no cross-row side effects)
  async function handleToggle(course: Course) {
    setTogglingId(course.id);
    try {
      await toggleCourseStatus(course.id, !course.active);
      setCourses((prev) =>
        prev.map((c) => c.id === course.id ? { ...c, active: !course.active } : c)
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
          <h2 className="text-xl font-bold text-slate-800">Course Management</h2>
          <p className="mt-0.5 text-sm text-slate-500">Create, manage and publish learning courses.</p>
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
            Add Course
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-4">
        <div className="relative flex-1 min-w-[240px]">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, name, description…"
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
            {filtered.length} {filtered.length === 1 ? "course" : "courses"}{search && " found"}
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
                    { h: "#",           cls: "w-10 text-left" },
                    { h: "Thumbnail",   cls: "text-left"      },
                    { h: "Code",        cls: "text-left"      },
                    { h: "Course Name", cls: "text-left"      },
                    { h: "Company",     cls: "text-left"      },
                    { h: "Category",    cls: "text-left"      },
                    { h: "Level",       cls: "text-left"      },
                    { h: "Duration",    cls: "text-left"      },
                    { h: "Pass %",      cls: "text-center"    },
                    { h: "Certificate", cls: "text-center"    },
                    { h: "Status",      cls: "text-center"    },
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
                {pageRows.map((course, i) => {
                  const busy = togglingId === course.id;
                  return (
                    <tr key={course.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">
                        {pageStart + i + 1}
                      </td>

                      <td className="px-4 py-3">
                        <Thumbnail src={course.thumbnail} alt={course.course_name} />
                      </td>

                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                        {course.course_code}
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{course.course_name}</p>
                        {course.short_description && (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                            {course.short_description}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {findName(companies, course.company_id, "company_name")}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {findName(categories, course.category_id, "category_name")}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {capitalize(course.level)}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {course.duration_days > 0 && <span>{course.duration_days}d </span>}
                        {course.duration_hours > 0 && <span>{course.duration_hours}h</span>}
                        {course.duration_days === 0 && course.duration_hours === 0 && "—"}
                      </td>

                      <td className="px-4 py-3 text-center text-slate-600">
                        {course.passing_percentage}%
                      </td>

                      <td className="px-4 py-3 text-center">
                        <CertBadge enabled={course.certificate_enabled} />
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggle(course)}
                          disabled={busy}
                          aria-label="Toggle status"
                          className="disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <StatusPill active={course.active} />
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal({ type: "edit", course })}
                            disabled={busy}
                            aria-label="Edit course"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openModal({ type: "delete", course })}
                            disabled={busy}
                            aria-label="Delete course"
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

      {/* Add / Edit modal */}
      {(modal?.type === "add" || modal?.type === "edit") && (
        <CourseModal
          editing={modal.type === "edit" ? modal.course : null}
          companies={companies}
          categories={categories}
          usedCodes={usedCodes}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {/* Delete confirmation */}
      {modal?.type === "delete" && (
        <DeleteDialog
          name={modal.course.course_name}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
  );
}
