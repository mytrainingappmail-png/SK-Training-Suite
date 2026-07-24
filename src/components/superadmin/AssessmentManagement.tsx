import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadAssessments,
  createAssessment,
  saveAssessment,
  removeAssessment,
  toggleAssessmentStatus,
} from "../../services/assessment/assessmentService";
import { loadLessons } from "../../services/lesson/lessonService";

import type { Assessment, AssessmentForm, AssessmentType } from "../../types/assessment";
import type { Lesson } from "../../types/lesson";
import { defaultAssessmentForm } from "../../types/assessment";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

const ASSESSMENT_TYPES: { value: AssessmentType; label: string }[] = [
  { value: "quiz",     label: "Quiz"     },
  { value: "test",     label: "Test"     },
  { value: "exam",     label: "Exam"     },
  { value: "survey",   label: "Survey"   },
  { value: "practice", label: "Practice" },
];

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

function typeLabel(value: AssessmentType): string {
  return ASSESSMENT_TYPES.find((t) => t.value === value)?.label ?? value;
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
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function TypeBadge({ value }: { value: AssessmentType }) {
  const colours: Record<AssessmentType, string> = {
    quiz:     "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    test:     "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    exam:     "bg-red-50 text-red-700 ring-1 ring-red-200",
    survey:   "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
    practice: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colours[value]}`}>
      {typeLabel(value)}
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
            d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
          />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No assessments found" : "No assessments yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search
          ? `No results for "${search}". Try a different keyword.`
          : "Add your first assessment to get started."}
      </p>
      {!search && (
        <button
          onClick={onAdd}
          className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
        >
          Add Assessment
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
          Delete Assessment
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
// Assessment form modal
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  lesson_id?: string;
  assessment_code?: string;
  assessment_title?: string;
  assessment_type?: string;
  passing_percentage?: string;
  maximum_attempts?: string;
  duration_minutes?: string;
  question_time_seconds?: string;
  negative_marks?: string;
}

function AssessmentModal({
  editing,
  lessons,
  saving,
  onSave,
  onClose,
}: {
  editing: Assessment | null;
  lessons: Lesson[];
  saving: boolean;
  onSave: (data: AssessmentForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<AssessmentForm>(() =>
    isEdit
      ? {
          lesson_id:               editing.lesson_id,
          company_id:              editing.company_id,
          assessment_code:         editing.assessment_code,
          assessment_title:        editing.assessment_title,
          description:             editing.description,
          assessment_type:         editing.assessment_type,
          passing_percentage:      editing.passing_percentage,
          maximum_attempts:        editing.maximum_attempts,
          duration_minutes:        editing.duration_minutes,
          question_timer_enabled:  editing.question_timer_enabled,
          question_time_seconds:   editing.question_time_seconds,
          shuffle_questions:       editing.shuffle_questions,
          shuffle_options:         editing.shuffle_options,
          negative_marking:        editing.negative_marking,
          negative_marks:          editing.negative_marks,
          show_result_immediately: editing.show_result_immediately,
          show_correct_answers:    editing.show_correct_answers,
          auto_submit:             editing.auto_submit,
          certificate_enabled:     editing.certificate_enabled,
          active:                  editing.active,
        }
      : { ...defaultAssessmentForm }
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

  function field<K extends keyof AssessmentForm>(key: K, val: AssessmentForm[K]) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined }));
  }

  function numField(key: keyof AssessmentForm, val: number) {
    field(key, val as AssessmentForm[typeof key]);
  }

  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.lesson_id)               e.lesson_id        = "Lesson is required.";
    if (!form.assessment_code.trim())  e.assessment_code  = "Assessment Code is required.";
    if (!form.assessment_title.trim()) e.assessment_title = "Assessment Title is required.";
    if (!form.assessment_type)         e.assessment_type  = "Assessment Type is required.";

    if (form.passing_percentage < 0 || form.passing_percentage > 100) {
      e.passing_percentage = "Passing Percentage must be between 0 and 100.";
    }
    if (form.maximum_attempts < 1) {
      e.maximum_attempts = "Maximum Attempts must be at least 1.";
    }
    if (form.duration_minutes < 1) {
      e.duration_minutes = "Duration must be at least 1 minute.";
    }
    if (form.question_timer_enabled && form.question_time_seconds < 5) {
      e.question_time_seconds = "Question Timer must be at least 5 seconds.";
    }
    if (form.negative_marking && form.negative_marks < 0) {
      e.negative_marks = "Negative Marks cannot be negative.";
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
      aria-labelledby="ass-form-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!saving ? onClose : undefined}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="ass-form-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Assessment" : "Add Assessment"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update assessment settings." : "Configure the assessment below."}
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

            {/* ── Basic Information ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Basic Information</p>

            {/* Lesson */}
            <FL label="Lesson" required error={errs.lesson_id}>
              <select
                ref={firstRef}
                value={form.lesson_id ?? ''}
                onChange={(e) => field("lesson_id", e.target.value)}
                disabled={saving}
                className={CLS_SELECT}
              >
                <option value="">— Select Lesson —</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>{l.lesson_title}</option>
                ))}
              </select>
            </FL>

            {/* Code + Title */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Assessment Code" required error={errs.assessment_code}>
                <input
                  type="text"
                  value={form.assessment_code}
                  onChange={(e) => field("assessment_code", e.target.value)}
                  placeholder="e.g. ASS-001"
                  maxLength={30}
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
              <FL label="Assessment Title" required error={errs.assessment_title}>
                <input
                  type="text"
                  value={form.assessment_title}
                  onChange={(e) => field("assessment_title", e.target.value)}
                  placeholder="e.g. Chapter 1 Quiz"
                  maxLength={200}
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
            </div>

            {/* Type */}
            <FL label="Assessment Type" required error={errs.assessment_type}>
              <select
                value={form.assessment_type}
                onChange={(e) => field("assessment_type", e.target.value as AssessmentType)}
                disabled={saving}
                className={CLS_SELECT}
              >
                <option value="">— Select Type —</option>
                {ASSESSMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </FL>

            {/* Description */}
            <FL label="Description">
              <textarea
                value={form.description}
                onChange={(e) => field("description", e.target.value)}
                placeholder="Optional description or instructions"
                rows={3}
                disabled={saving}
                className={CLS_TEXTAREA}
              />
            </FL>

            {/* ── Scoring ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Scoring</p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <FL label="Passing %" required error={errs.passing_percentage}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.passing_percentage}
                  onChange={(e) =>
                    numField("passing_percentage", Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))
                  }
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
              <FL label="Max Attempts" required error={errs.maximum_attempts}>
                <input
                  type="number"
                  min={1}
                  value={form.maximum_attempts}
                  onChange={(e) =>
                    numField("maximum_attempts", Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
              <FL label="Duration (min)" required error={errs.duration_minutes}>
                <input
                  type="number"
                  min={1}
                  value={form.duration_minutes}
                  onChange={(e) =>
                    numField("duration_minutes", Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  disabled={saving}
                  className={CLS_INPUT}
                />
              </FL>
            </div>

            {/* Negative Marking */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-4">
              <ToggleRow
                label="Negative Marking"
                sub="Deduct marks for wrong answers"
                on={form.negative_marking}
                onChange={() => field("negative_marking", !form.negative_marking)}
                disabled={saving}
              />
              {form.negative_marking && (
                <FL label="Marks Deducted per Wrong Answer" error={errs.negative_marks}>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.negative_marks}
                    onChange={(e) =>
                      numField("negative_marks", Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    disabled={saving}
                    className={CLS_INPUT}
                  />
                </FL>
              )}
            </div>

            {/* ── Timer ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Timer</p>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-4">
              <ToggleRow
                label="Question Timer"
                sub="Set a time limit per question"
                on={form.question_timer_enabled}
                onChange={() => field("question_timer_enabled", !form.question_timer_enabled)}
                disabled={saving}
              />
              {form.question_timer_enabled && (
                <FL label="Seconds per Question" error={errs.question_time_seconds}>
                  <input
                    type="number"
                    min={5}
                    value={form.question_time_seconds}
                    onChange={(e) =>
                      numField("question_time_seconds", Math.max(5, parseInt(e.target.value, 10) || 5))
                    }
                    disabled={saving}
                    className={CLS_INPUT}
                  />
                </FL>
              )}
              <ToggleRow
                label="Auto Submit"
                sub="Automatically submit when time runs out"
                on={form.auto_submit}
                onChange={() => field("auto_submit", !form.auto_submit)}
                disabled={saving}
              />
            </div>

            {/* ── Behaviour ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Behaviour</p>

            <div className="flex flex-wrap gap-y-4 gap-x-8 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <ToggleRow
                label="Shuffle Questions"
                sub="Randomise question order"
                on={form.shuffle_questions}
                onChange={() => field("shuffle_questions", !form.shuffle_questions)}
                disabled={saving}
              />
              <ToggleRow
                label="Shuffle Options"
                sub="Randomise answer options"
                on={form.shuffle_options}
                onChange={() => field("shuffle_options", !form.shuffle_options)}
                disabled={saving}
              />
              <ToggleRow
                label="Show Result Immediately"
                sub="Display result after submission"
                on={form.show_result_immediately}
                onChange={() => field("show_result_immediately", !form.show_result_immediately)}
                disabled={saving}
              />
              <ToggleRow
                label="Show Correct Answers"
                sub="Reveal correct answers after submission"
                on={form.show_correct_answers}
                onChange={() => field("show_correct_answers", !form.show_correct_answers)}
                disabled={saving}
              />
            </div>

            {/* ── Status ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status</p>

            <div className="flex flex-wrap gap-y-4 gap-x-8 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <ToggleRow
                label="Certificate Enabled"
                sub="Issue certificate on passing"
                on={form.certificate_enabled}
                onChange={() => field("certificate_enabled", !form.certificate_enabled)}
                disabled={saving}
              />
              <ToggleRow
                label="Active"
                sub="Assessment is available to learners"
                on={form.active}
                onChange={() => field("active", !form.active)}
                disabled={saving}
              />
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
              {saving ? "Saving…" : isEdit ? "Update Assessment" : "Add Assessment"}
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
  | { type: "edit"; assessment: Assessment }
  | { type: "delete"; assessment: Assessment }
  | null;

export default function AssessmentManagement() {

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [lessons,     setLessons]     = useState<Lesson[]>([]);

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
    if (!kw) return assessments;
    return assessments.filter(
      (a) =>
        a.assessment_code.toLowerCase().includes(kw) ||
        a.assessment_title.toLowerCase().includes(kw) ||
        a.assessment_type.toLowerCase().includes(kw) ||
        (a.description ?? "").toLowerCase().includes(kw)
    );
  }, [assessments, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PER_PAGE;
  const pageRows   = filtered.slice(pageStart, pageStart + PER_PAGE);

  useEffect(() => { setPage(1); }, [search]);

  // ── Load
  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      const [assData, lessonData] = await Promise.all([
        loadAssessments(),
        loadLessons(),
      ]);
      setAssessments(assData);
      setLessons(lessonData);
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
    async (data: AssessmentForm) => {
      setSaving(true);
      try {
        if (modal?.type === "edit") {
          await saveAssessment(modal.assessment.id, data);
        } else {
          await createAssessment(data);
        }
        await load();
        setBanner("");
        closeModal();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Unable to save assessment.");
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
      await removeAssessment(modal.assessment.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to delete assessment.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle — optimistic
  async function handleToggle(assessment: Assessment) {
    setTogglingId(assessment.id);
    try {
      await toggleAssessmentStatus(assessment.id, !assessment.active);
      setAssessments((prev) =>
        prev.map((a) => a.id === assessment.id ? { ...a, active: !assessment.active } : a)
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
          <h2 className="text-xl font-bold text-slate-800">Assessment Management</h2>
          <p className="mt-0.5 text-sm text-slate-500">Create and manage lesson assessments.</p>
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
            Add Assessment
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
            placeholder="Search by code, title, type…"
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
            {filtered.length} {filtered.length === 1 ? "assessment" : "assessments"}{search && " found"}
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
                    { h: "#",               cls: "w-10 text-left" },
                    { h: "Code",            cls: "text-left"      },
                    { h: "Assessment",      cls: "text-left"      },
                    { h: "Lesson",          cls: "text-left"      },
                    { h: "Type",            cls: "text-left"      },
                    { h: "Pass %",          cls: "text-center"    },
                    { h: "Attempts",        cls: "text-center"    },
                    { h: "Duration",        cls: "text-center"    },
                    { h: "Certificate",     cls: "text-center"    },
                    { h: "Status",          cls: "text-center"    },
                    { h: "Actions",         cls: "text-right"     },
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
                {pageRows.map((ass, i) => {
                  const busy = togglingId === ass.id;
                  return (
                    <tr key={ass.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">{pageStart + i + 1}</td>

                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                        {ass.assessment_code}
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{ass.assessment_title}</p>
                        {ass.description && (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                            {ass.description}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {findName(lessons, ass.lesson_id ?? '', "lesson_title")}
                      </td>

                      <td className="px-4 py-3">
                        <TypeBadge value={ass.assessment_type} />
                      </td>

                      <td className="px-4 py-3 text-center text-slate-600">
                        {ass.passing_percentage}%
                      </td>

                      <td className="px-4 py-3 text-center text-slate-600">
                        {ass.maximum_attempts}
                      </td>

                      <td className="px-4 py-3 text-center text-slate-600">
                        {ass.duration_minutes}m
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            ass.certificate_enabled
                              ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                              : "bg-slate-100 text-slate-400 ring-1 ring-slate-200"
                          }`}
                        >
                          {ass.certificate_enabled ? "Yes" : "No"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggle(ass)}
                          disabled={busy}
                          aria-label="Toggle status"
                          className="disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <StatusPill active={ass.active} />
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal({ type: "edit", assessment: ass })}
                            disabled={busy}
                            aria-label="Edit assessment"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openModal({ type: "delete", assessment: ass })}
                            disabled={busy}
                            aria-label="Delete assessment"
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
        <AssessmentModal
          editing={modal.type === "edit" ? modal.assessment : null}
          lessons={lessons}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {modal?.type === "delete" && (
        <DeleteDialog
          name={modal.assessment.assessment_title}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
  );
}
