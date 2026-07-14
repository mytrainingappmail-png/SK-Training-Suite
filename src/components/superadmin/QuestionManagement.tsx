import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadQuestions,
  loadOptionsByQuestion,
  createQuestion,
  saveQuestion,
  removeQuestion,
  toggleQuestionStatus,
} from "../../services/question/questionService";
import { loadAssessments } from "../../services/assessment/assessmentService";

import type {
  Question,
  QuestionWithOptionsForm,
  QuestionOptionForm,
  QuestionType,
  DifficultyLevel,
} from "../../types/question";
import type { Assessment } from "../../types/assessment";
import {
  defaultQuestionForm,
  TRUE_FALSE_OPTIONS,
} from "../../types/question";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "mcq",             label: "MCQ"              },
  { value: "multiple_select", label: "Multiple Select"  },
  { value: "true_false",      label: "True / False"     },
  { value: "fill_blank",      label: "Fill in the Blank"},
  { value: "short_answer",    label: "Short Answer"     },
  { value: "long_answer",     label: "Long Answer"      },
];

const DIFFICULTY_LEVELS: { value: DifficultyLevel; label: string }[] = [
  { value: "easy",   label: "Easy"   },
  { value: "medium", label: "Medium" },
  { value: "hard",   label: "Hard"   },
];

const OPTION_TYPES: QuestionType[] = ["mcq", "multiple_select", "true_false"];

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

function qtLabel(v: QuestionType): string {
  return QUESTION_TYPES.find((t) => t.value === v)?.label ?? v;
}

function diffColour(v: DifficultyLevel): string {
  if (v === "easy")   return "bg-green-50 text-green-700 ring-1 ring-green-200";
  if (v === "medium") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return                     "bg-red-50 text-red-700 ring-1 ring-red-200";
}

function needsOptions(qt: QuestionType): boolean {
  return OPTION_TYPES.includes(qt);
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
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-yellow-500" : "bg-slate-200"}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0"}`}
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
// Skeleton / Empty state / Delete dialog
// ─────────────────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-10 w-8 rounded bg-slate-100" />
          <div className="h-10 flex-1 rounded bg-slate-100" />
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
        </svg>
      </div>
      <h3 className="mb-1 text-base font-semibold text-slate-800">
        {search ? "No questions found" : "No questions yet"}
      </h3>
      <p className="mb-6 text-sm text-slate-500">
        {search ? `No results for "${search}".` : "Add your first question to get started."}
      </p>
      {!search && (
        <button onClick={onAdd} className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95">
          Add Question
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
        <h3 id="dd-title" className="mb-1 text-lg font-semibold text-slate-800">Delete Question</h3>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to delete <span className="font-semibold text-slate-700">{name}</span>? All options will also be deleted. This cannot be undone.
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
// Option editor
// ─────────────────────────────────────────────────────────────────────────────

function OptionEditor({
  options,
  questionType,
  disabled,
  onChange,
}: {
  options: QuestionOptionForm[];
  questionType: QuestionType;
  disabled: boolean;
  onChange: (opts: QuestionOptionForm[]) => void;
}) {
  const isMcq     = questionType === "mcq" || questionType === "true_false";
  const isTrueFalse = questionType === "true_false";
  const canAdd    = !isTrueFalse && options.length < 6;
  const canRemove = !isTrueFalse && options.length > 2;

  function addOption() {
    if (!canAdd) return;
    onChange([
      ...options,
      { option_text: "", is_correct: false, display_order: options.length + 1 },
    ]);
  }

  function removeOption(idx: number) {
    if (!canRemove) return;
    onChange(options.filter((_, i) => i !== idx));
  }

  function setText(idx: number, text: string) {
    onChange(options.map((o, i) => i === idx ? { ...o, option_text: text } : o));
  }

  function toggleCorrect(idx: number) {
    if (isMcq) {
      // MCQ / True-False: only one correct
      onChange(options.map((o, i) => ({ ...o, is_correct: i === idx })));
    } else {
      // Multiple Select: toggle
      onChange(options.map((o, i) => i === idx ? { ...o, is_correct: !o.is_correct } : o));
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">
          Answer Options
          <span className="ml-1 text-red-500">*</span>
          <span className="ml-2 text-xs font-normal text-slate-400">
            {isTrueFalse
              ? "Auto-generated for True / False"
              : `${options.length}/6 — click ✓ to mark correct`}
          </span>
        </p>
        {canAdd && (
          <button
            type="button"
            onClick={addOption}
            disabled={disabled}
            className="text-xs font-medium text-yellow-600 hover:text-yellow-800 disabled:opacity-40"
          >
            + Add Option
          </button>
        )}
      </div>

      <div className="space-y-2">
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            {/* Correct marker */}
            <button
              type="button"
              onClick={() => toggleCorrect(idx)}
              disabled={disabled || isTrueFalse}
              aria-label={opt.is_correct ? "Marked correct" : "Mark as correct"}
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 transition focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:cursor-not-allowed ${
                opt.is_correct
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-slate-300 bg-white text-slate-300 hover:border-emerald-400"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </button>

            {/* Text input */}
            <input
              type="text"
              value={opt.option_text}
              onChange={(e) => setText(idx, e.target.value)}
              placeholder={`Option ${idx + 1}`}
              disabled={disabled || isTrueFalse}
              className={CLS_INPUT}
            />

            {/* Remove button */}
            {canRemove && (
              <button
                type="button"
                onClick={() => removeOption(idx)}
                disabled={disabled}
                aria-label="Remove option"
                className="flex-shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Question form modal
// ─────────────────────────────────────────────────────────────────────────────

interface FormErrs {
  assessment_id?: string;
  question_code?: string;
  question_text?: string;
  display_order?: string;
  marks?: string;
  negative_marks?: string;
  time_limit_seconds?: string;
  options?: string;
}

function QuestionModal({
  editing,
  editingOptions,
  assessments,
  questions,
  saving,
  onSave,
  onClose,
}: {
  editing: Question | null;
  editingOptions: QuestionOptionForm[];
  assessments: Assessment[];
  questions: Question[];
  saving: boolean;
  onSave: (data: QuestionWithOptionsForm) => void;
  onClose: () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<QuestionWithOptionsForm>(() => {
    if (!isEdit) return { ...defaultQuestionForm };
    return {
      assessment_id:    editing.assessment_id,
      question_code:    editing.question_code,
      question_text:    editing.question_text,
      question_type:    editing.question_type,
      difficulty_level: editing.difficulty_level,
      marks:            editing.marks,
      negative_marks:   editing.negative_marks,
      time_limit_seconds: editing.time_limit_seconds,
      explanation:      editing.explanation,
      hint:             editing.hint,
      display_order:    editing.display_order,
      mandatory:        editing.mandatory,
      randomize_options: editing.randomize_options,
      attachment_url:   editing.attachment_url,
      image_url:        editing.image_url,
      active:           editing.active,
      options:          editingOptions,
    };
  });

  const [errs, setErrs] = useState<FormErrs>({});
  const firstRef = useRef<HTMLSelectElement>(null);

  // When question_type changes, adjust options
  function handleTypeChange(qt: QuestionType) {
    let opts = form.options;

    if (qt === "true_false") {
      opts = [...TRUE_FALSE_OPTIONS];
    } else if (!needsOptions(qt)) {
      opts = [];
    } else if (needsOptions(qt) && form.options.length < 2) {
      opts = [
        { option_text: "", is_correct: false, display_order: 1 },
        { option_text: "", is_correct: false, display_order: 2 },
      ];
    }

    setForm((p) => ({ ...p, question_type: qt, options: opts }));
    setErrs((p) => ({ ...p, options: undefined }));
  }

  useEffect(() => { firstRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !saving) onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  function field<K extends keyof QuestionWithOptionsForm>(
    key: K,
    val: QuestionWithOptionsForm[K]
  ) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: FormErrs = {};

    if (!form.assessment_id)         e.assessment_id      = "Assessment is required.";
    if (!form.question_code.trim())  e.question_code      = "Question Code is required.";
    if (!form.question_text.trim())  e.question_text      = "Question Text is required.";
    if (form.display_order < 1)      e.display_order      = "Display Order must be at least 1.";
    if (form.marks < 1)              e.marks              = "Marks must be at least 1.";
    if (form.negative_marks > form.marks) {
      e.negative_marks = "Negative Marks cannot exceed Marks.";
    }

    if (form.time_limit_seconds > 0) {
      if (form.time_limit_seconds < 5)
        e.time_limit_seconds = "Timer must be at least 5 seconds.";
      if (form.time_limit_seconds > 600)
        e.time_limit_seconds = "Timer cannot exceed 600 seconds.";
    }

    if (needsOptions(form.question_type)) {
      const opts = form.options;
      if (opts.length < 2)                         e.options = "At least 2 options are required.";
      else if (opts.some((o) => !o.option_text.trim())) e.options = "All options must have text.";
      else {
        const correct = opts.filter((o) => o.is_correct).length;
        if (
          (form.question_type === "mcq" || form.question_type === "true_false") &&
          correct !== 1
        ) {
          e.options = "Exactly one correct option is required.";
        }
        if (form.question_type === "multiple_select" && correct < 1) {
          e.options = "At least one correct option is required.";
        }
      }
    }

    // Duplicate code check (client-side, service also checks)
    const code = form.question_code.trim().toLowerCase();
    const dup = questions.some(
      (q) =>
        q.question_code.trim().toLowerCase() === code &&
        (!isEdit || q.id !== editing.id)
    );
    if (code && dup) e.question_code = "Question Code already exists.";

    setErrs(e);
    return Object.keys(e).length === 0;
  }

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!validate()) return;
    onSave(form);
  }

  const showOptions = needsOptions(form.question_type);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="q-form-title"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="q-form-title" className="text-lg font-semibold text-slate-800">
              {isEdit ? "Edit Question" : "Add Question"}
            </h2>
            <p className="text-sm text-slate-500">
              {isEdit ? "Update question details." : "Configure the question below."}
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

            {/* ── Core ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Question Details</p>

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

            {/* Code + Type */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Question Code" required error={errs.question_code}>
                <input type="text" value={form.question_code}
                  onChange={(e) => field("question_code", e.target.value)}
                  placeholder="e.g. Q-001" maxLength={30} disabled={saving} className={CLS_INPUT} />
              </FL>
              <FL label="Question Type" required>
                <select value={form.question_type}
                  onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
                  disabled={saving} className={CLS_SELECT}>
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </FL>
            </div>

            {/* Question Text */}
            <FL label="Question Text" required error={errs.question_text}>
              <textarea value={form.question_text}
                onChange={(e) => field("question_text", e.target.value)}
                placeholder="Enter the full question text…"
                rows={3} disabled={saving} className={CLS_TEXTAREA} />
            </FL>

            {/* Difficulty + Display Order */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Difficulty Level">
                <select value={form.difficulty_level}
                  onChange={(e) => field("difficulty_level", e.target.value as DifficultyLevel)}
                  disabled={saving} className={CLS_SELECT}>
                  {DIFFICULTY_LEVELS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </FL>
              <FL label="Display Order" required error={errs.display_order}>
                <input type="number" min={1} value={form.display_order}
                  onChange={(e) => field("display_order", Math.max(1, parseInt(e.target.value, 10) || 1))}
                  disabled={saving} className={CLS_INPUT} />
              </FL>
            </div>

            {/* ── Scoring ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Scoring</p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <FL label="Marks" required error={errs.marks}>
                <input type="number" min={1} value={form.marks}
                  onChange={(e) => field("marks", Math.max(1, parseFloat(e.target.value) || 1))}
                  disabled={saving} className={CLS_INPUT} />
              </FL>
              <FL label="Negative Marks" error={errs.negative_marks}>
                <input type="number" min={0} step={0.5} value={form.negative_marks}
                  onChange={(e) => field("negative_marks", Math.max(0, parseFloat(e.target.value) || 0))}
                  disabled={saving} className={CLS_INPUT} />
              </FL>
              <FL label="Timer (seconds)" error={errs.time_limit_seconds}>
                <input type="number" min={0} value={form.time_limit_seconds}
                  onChange={(e) =>
                    field("time_limit_seconds", Math.max(0, parseInt(e.target.value, 10) || 0))
                  }
                  placeholder="0 = no limit"
                  disabled={saving} className={CLS_INPUT} />
              </FL>
            </div>

            {/* ── Options ── */}
            {showOptions && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Answer Options</p>
                <div>
                  <OptionEditor
                    options={form.options}
                    questionType={form.question_type}
                    disabled={saving}
                    onChange={(opts) => field("options", opts)}
                  />
                  {errs.options && (
                    <p className="mt-1 text-xs text-red-500">{errs.options}</p>
                  )}
                </div>
              </>
            )}

            {/* ── Media ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Media &amp; Hints</p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FL label="Image URL">
                <input type="url" value={form.image_url}
                  onChange={(e) => field("image_url", e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  disabled={saving} className={CLS_INPUT} />
              </FL>
              <FL label="Attachment URL">
                <input type="url" value={form.attachment_url}
                  onChange={(e) => field("attachment_url", e.target.value)}
                  placeholder="https://example.com/file.pdf"
                  disabled={saving} className={CLS_INPUT} />
              </FL>
            </div>

            <FL label="Explanation">
              <textarea value={form.explanation}
                onChange={(e) => field("explanation", e.target.value)}
                placeholder="Explain why the correct answer is correct…"
                rows={2} disabled={saving} className={CLS_TEXTAREA} />
            </FL>

            <FL label="Hint">
              <input type="text" value={form.hint}
                onChange={(e) => field("hint", e.target.value)}
                placeholder="Optional hint shown to the learner"
                maxLength={300} disabled={saving} className={CLS_INPUT} />
            </FL>

            {/* ── Settings ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Settings</p>

            <div className="flex flex-wrap gap-y-4 gap-x-8 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <ToggleRow label="Mandatory" sub="Cannot be skipped"
                on={form.mandatory} onChange={() => field("mandatory", !form.mandatory)} disabled={saving} />
              <ToggleRow label="Randomize Options" sub="Shuffle option order for each attempt"
                on={form.randomize_options} onChange={() => field("randomize_options", !form.randomize_options)} disabled={saving} />
              <ToggleRow label="Active" sub="Question is available in assessments"
                on={form.active} onChange={() => field("active", !form.active)} disabled={saving} />
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:opacity-50 active:scale-95">
              {saving ? "Saving…" : isEdit ? "Update Question" : "Add Question"}
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

interface QuestionWithOptions extends Question {
  options: QuestionOptionForm[];
}

type ModalKind =
  | { type: "add" }
  | { type: "edit"; question: QuestionWithOptions }
  | { type: "delete"; question: Question }
  | null;

export default function QuestionManagement() {

  const [questions,   setQuestions]   = useState<Question[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

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
    if (!kw) return questions;
    return questions.filter(
      (q) =>
        q.question_code.toLowerCase().includes(kw) ||
        q.question_text.toLowerCase().includes(kw) ||
        q.question_type.toLowerCase().includes(kw)
    );
  }, [questions, search]);

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
      const [qData, aData] = await Promise.all([
        loadQuestions(),
        loadAssessments(),
      ]);
      setQuestions(qData);
      setAssessments(aData);
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

  // Open edit modal: fetch options first
  async function openEdit(question: Question) {
    try {
      const options = await loadOptionsByQuestion(question.id);
      const opts: QuestionOptionForm[] = options.map((o) => ({
        option_text:   o.option_text,
        is_correct:    o.is_correct,
        display_order: o.display_order,
      }));
      openModal({ type: "edit", question: { ...question, options: opts } });
    } catch {
      setBanner("Failed to load question options. Please try again.");
    }
  }

  // ── Save
  const handleSave = useCallback(
    async (data: QuestionWithOptionsForm) => {
      setSaving(true);
      try {
        if (modal?.type === "edit") {
          await saveQuestion(modal.question.id, data);
        } else {
          await createQuestion(data);
        }
        await load();
        setBanner("");
        closeModal();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : "Unable to save question.");
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
      await removeQuestion(modal.question.id);
      await load();
      setBanner("");
      closeModal();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Unable to delete question.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Toggle — optimistic
  async function handleToggle(question: Question) {
    setTogglingId(question.id);
    try {
      await toggleQuestionStatus(question.id, !question.active);
      setQuestions((prev) =>
        prev.map((q) => q.id === question.id ? { ...q, active: !question.active } : q)
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
          <h2 className="text-xl font-bold text-slate-800">Question Bank</h2>
          <p className="mt-0.5 text-sm text-slate-500">Manage questions for all assessments.</p>
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
            Add Question
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
            placeholder="Search by code, text, type…"
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
            {filtered.length} {filtered.length === 1 ? "question" : "questions"}{search && " found"}
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
                    { h: "Code",        cls: "text-left"      },
                    { h: "Question",    cls: "text-left"      },
                    { h: "Assessment",  cls: "text-left"      },
                    { h: "Type",        cls: "text-left"      },
                    { h: "Difficulty",  cls: "text-center"    },
                    { h: "Marks",       cls: "text-center"    },
                    { h: "Order",       cls: "text-center"    },
                    { h: "Status",      cls: "text-center"    },
                    { h: "Actions",     cls: "text-right"     },
                  ].map(({ h, cls }) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.map((q, i) => {
                  const busy = togglingId === q.id;
                  return (
                    <tr key={q.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-400">{pageStart + i + 1}</td>

                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                        {q.question_code}
                      </td>

                      <td className="px-4 py-3">
                        <p className="max-w-xs truncate font-semibold text-slate-800">
                          {q.question_text}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {findName(assessments, q.assessment_id, "assessment_title")}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                          {qtLabel(q.question_type)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${diffColour(q.difficulty_level)}`}>
                          {q.difficulty_level.charAt(0).toUpperCase() + q.difficulty_level.slice(1)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center text-slate-600">{q.marks}</td>

                      <td className="px-4 py-3 text-center text-slate-600">{q.display_order}</td>

                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleToggle(q)} disabled={busy}
                          aria-label="Toggle status" className="disabled:cursor-not-allowed disabled:opacity-60">
                          <StatusPill active={q.active} />
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(q)}
                            disabled={busy}
                            aria-label="Edit question"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openModal({ type: "delete", question: q })}
                            disabled={busy}
                            aria-label="Delete question"
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
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* Form modal */}
      {(modal?.type === "add" || modal?.type === "edit") && (
        <QuestionModal
          editing={modal.type === "edit" ? modal.question : null}
          editingOptions={modal.type === "edit" ? modal.question.options : []}
          assessments={assessments}
          questions={questions}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {/* Delete dialog */}
      {modal?.type === "delete" && (
        <DeleteDialog
          name={modal.question.question_code}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={closeModal}
        />
      )}

    </div>
  );
}
