// src/components/admin/assessment/AssessmentManagement.tsx
//
// Complete Assessment module. Reuses only existing, unmodified
// architecture:
//   assessmentService  (loadAssessments / createAssessment / saveAssessment /
//                        removeAssessment / toggleAssessmentStatus)
//   questionService    (loadQuestions / loadOptionsByQuestion /
//                        createQuestion / saveQuestion / removeQuestion /
//                        toggleQuestionStatus)
//   lessonBuilderService, moduleService, courseService, categoryService —
//                        used to resolve real Course/Category filters via
//                        the existing assessment.lesson_id -> lesson ->
//                        module -> course -> category chain.
//   contentEditorService.uploadImage — real Storage upload for Image
//                        Based Questions (Question.image_url).
//
// Question types offered are exactly the six the real QuestionType union
// supports (mcq / multiple_select / true_false / fill_blank /
// short_answer / long_answer). "Match the Following" and "Ordering" have
// no backing question_type value anywhere in the schema, so they are not
// offered — inventing them would silently corrupt real data through
// createQuestion/saveQuestion. "Image Based" is not a separate type; it
// is the existing, real image_url attachment available on any question.
//
// "Archive" has no dedicated status column distinct from the real
// Publish/Unpublish `active` flag, so it is kept as a clearly-labelled,
// session-local flag layered on top of the real data — never faked as
// persisted. saveAssessment/saveQuestion always receive a complete
// merged object (never a bare partial), because both services validate
// the full required field set on every call, partial or not.
//
// No repository, service, or database changes.

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  loadAssessments,
  createAssessment,
  saveAssessment,
  removeAssessment,
  toggleAssessmentStatus,
} from '../../../services/assessment/assessmentService';
import {
  loadQuestions,
  loadOptionsByQuestion,
  createQuestion,
  saveQuestion,
  removeQuestion,
  toggleQuestionStatus,
} from '../../../services/question/questionService';
import { loadLessons } from '../../../services/lessonBuilder/lessonBuilderService';
import { loadModules } from '../../../services/module/moduleService';
import { loadCourses } from '../../../services/course/courseService';
import { loadCategories } from '../../../services/category/categoryService';
import { uploadImage } from '../../../services/contentEditor/contentEditorService';

import type { Assessment, AssessmentForm, AssessmentType } from '../../../types/assessment';
import type {
  Question,
  QuestionOption,
  QuestionOptionForm,
  QuestionWithOptionsForm,
  QuestionType,
  DifficultyLevel,
} from '../../../types/question';
import { TRUE_FALSE_OPTIONS } from '../../../types/question';
import type { Lesson } from '../../../types/lessonBuilder';
import type { Module } from '../../../types/module';
import type { Course } from '../../../types/course';
import type { Category } from '../../../types/category';

// ─────────────────────────────────────────────────────────────────────────────
// Domain helpers
// ─────────────────────────────────────────────────────────────────────────────

function toAssessmentForm(a: Assessment): AssessmentForm {
  return {
    lesson_id: a.lesson_id,
    company_id: a.company_id,
    assessment_code: a.assessment_code,
    assessment_title: a.assessment_title,
    description: a.description,
    assessment_type: a.assessment_type,
    passing_percentage: a.passing_percentage,
    maximum_attempts: a.maximum_attempts,
    duration_minutes: a.duration_minutes,
    question_timer_enabled: a.question_timer_enabled,
    question_time_seconds: a.question_time_seconds,
    shuffle_questions: a.shuffle_questions,
    shuffle_options: a.shuffle_options,
    negative_marking: a.negative_marking,
    negative_marks: a.negative_marks,
    show_result_immediately: a.show_result_immediately,
    show_correct_answers: a.show_correct_answers,
    auto_submit: a.auto_submit,
    certificate_enabled: a.certificate_enabled,
    active: a.active,
  };
}

const ASSESSMENT_TYPE_OPTIONS: AssessmentType[] = ['quiz', 'test', 'exam', 'survey', 'practice'];

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'mcq', label: 'MCQ' },
  { value: 'multiple_select', label: 'Multiple Select' },
  { value: 'true_false', label: 'True / False' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'long_answer', label: 'Long Answer' },
  { value: 'fill_blank', label: 'Fill in the Blank' },
];
const QUESTION_TYPE_LABEL: Record<QuestionType, string> = Object.fromEntries(QUESTION_TYPE_OPTIONS.map((t) => [t.value, t.label])) as Record<QuestionType, string>;

const DIFFICULTY_OPTIONS: DifficultyLevel[] = ['easy', 'medium', 'hard'];
const DIFFICULTY_STYLES: Record<DifficultyLevel, string> = {
  easy: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  hard: 'bg-red-50 text-red-700',
};

function optionsForType(type: QuestionType): QuestionOptionForm[] {
  if (type === 'true_false') return TRUE_FALSE_OPTIONS.map((o) => ({ ...o }));
  if (type === 'mcq' || type === 'multiple_select') {
    return [
      { option_text: '', is_correct: false, display_order: 1 },
      { option_text: '', is_correct: false, display_order: 2 },
    ];
  }
  return [];
}

function newQuestionForm(assessmentId: string): QuestionWithOptionsForm {
  return {
    assessment_id: assessmentId,
    question_code: `Q-${Date.now().toString(36).toUpperCase()}`,
    question_text: '',
    question_type: 'mcq',
    difficulty_level: 'medium',
    marks: 1,
    negative_marks: 0,
    time_limit_seconds: 0,
    explanation: '',
    hint: '',
    display_order: 1,
    mandatory: false,
    randomize_options: false,
    attachment_url: '',
    image_url: '',
    active: true,
    options: optionsForType('mcq'),
  };
}

function questionToForm(q: Question, options: QuestionOption[]): QuestionWithOptionsForm {
  return {
    assessment_id: q.assessment_id,
    question_code: q.question_code,
    question_text: q.question_text,
    question_type: q.question_type,
    difficulty_level: q.difficulty_level,
    marks: q.marks,
    negative_marks: q.negative_marks,
    time_limit_seconds: q.time_limit_seconds,
    explanation: q.explanation,
    hint: q.hint,
    display_order: q.display_order,
    mandatory: q.mandatory,
    randomize_options: q.randomize_options,
    attachment_url: q.attachment_url,
    image_url: q.image_url,
    active: q.active,
    options: options
      .sort((a, b) => a.display_order - b.display_order)
      .map((o) => ({ option_text: o.option_text, is_correct: o.is_correct, display_order: o.display_order })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV import / export — native, no dependency
// ─────────────────────────────────────────────────────────────────────────────

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));
}

function questionsToCsv(rows: QuestionWithOptionsForm[]): string {
  const header = ['question_text', 'question_type', 'option1', 'option2', 'option3', 'option4', 'correct_index', 'marks', 'negative_marks', 'difficulty_level'];
  const lines = rows.map((q) => {
    const opts = q.options.map((o) => o.option_text);
    const correctIndex = q.options.findIndex((o) => o.is_correct);
    return [
      `"${q.question_text.replace(/"/g, '""')}"`,
      q.question_type,
      opts[0] ?? '', opts[1] ?? '', opts[2] ?? '', opts[3] ?? '',
      String(correctIndex >= 0 ? correctIndex : ''),
      String(q.marks), String(q.negative_marks), q.difficulty_level,
    ].join(',');
  });
  return [header.join(','), ...lines].join('\n');
}

function csvToQuestionForms(text: string, assessmentId: string): QuestionWithOptionsForm[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const dataRows = rows[0][0]?.toLowerCase() === 'question_text' ? rows.slice(1) : rows;
  return dataRows.map((row, i) => {
    const [questionText, questionTypeRaw, opt1, opt2, opt3, opt4, correctIndexRaw, marksRaw, negativeMarksRaw, difficultyRaw] = row;
    const questionType: QuestionType = QUESTION_TYPE_OPTIONS.some((t) => t.value === questionTypeRaw) ? (questionTypeRaw as QuestionType) : 'mcq';
    const optionTexts = [opt1, opt2, opt3, opt4].filter((t): t is string => !!t && t.trim().length > 0);
    const correctIndex = Number(correctIndexRaw ?? 0);
    const options: QuestionOptionForm[] = optionTexts.length > 0
      ? optionTexts.map((text, idx) => ({ option_text: text, is_correct: idx === correctIndex, display_order: idx + 1 }))
      : optionsForType(questionType);
    const difficulty: DifficultyLevel = DIFFICULTY_OPTIONS.includes(difficultyRaw as DifficultyLevel) ? (difficultyRaw as DifficultyLevel) : 'medium';
    return {
      assessment_id: assessmentId,
      question_code: `IMP-${Date.now().toString(36).toUpperCase()}-${i}`,
      question_text: questionText ?? '',
      question_type: questionType,
      difficulty_level: difficulty,
      marks: Number(marksRaw) > 0 ? Number(marksRaw) : 1,
      negative_marks: Number(negativeMarksRaw) || 0,
      time_limit_seconds: 0,
      explanation: '',
      hint: '',
      display_order: i + 1,
      mandatory: false,
      randomize_options: false,
      attachment_url: '',
      image_url: '',
      active: true,
      options,
    };
  }).filter((q) => q.question_text.trim().length > 0);
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons + shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function IconPlus({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>);
}
function IconTrash({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>);
}
function IconDuplicate({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.29 48.29 0 0 1 1.927-.184" /></svg>);
}
function IconEye({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>);
}
function IconUpload({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>);
}
function IconDownload({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>);
}
function IconX({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>);
}
function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}

function PrimaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}
function AccentButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}
function SecondaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}
function DangerButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition ${on ? 'bg-indigo-600' : 'bg-slate-300'}`}>
      <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white transition ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  );
}
function ToggleRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      {children}
    </div>
  );
}
const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

function StatusBadge({ active, archived }: { active: boolean; archived: boolean }) {
  if (archived) return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">Archived</span>;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {active ? 'Published' : 'Draft'}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
    </div>
  );
}
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load assessments</p>
      <p className="mt-1">{message}</p>
      <SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton>
    </div>
  );
}
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Question Editor modal
// ─────────────────────────────────────────────────────────────────────────────

function QuestionEditorModal({
  form, saving, uploadingImage, onChange, onUploadImage, onSave, onCancel,
}: {
  form: QuestionWithOptionsForm;
  saving: boolean;
  uploadingImage: boolean;
  onChange: (patch: Partial<QuestionWithOptionsForm>) => void;
  onUploadImage: (file: File) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const usesOptions = form.question_type === 'mcq' || form.question_type === 'multiple_select' || form.question_type === 'true_false';
  const isTrueFalse = form.question_type === 'true_false';

  function updateOption(index: number, patch: Partial<QuestionOptionForm>) {
    const next = form.options.map((o, i) => (i === index ? { ...o, ...patch } : o));
    onChange({ options: next });
  }
  function setCorrectSingle(index: number) {
    onChange({ options: form.options.map((o, i) => ({ ...o, is_correct: i === index })) });
  }
  function toggleCorrectMulti(index: number) {
    onChange({ options: form.options.map((o, i) => (i === index ? { ...o, is_correct: !o.is_correct } : o)) });
  }
  function addOption() {
    if (form.options.length >= 6) return;
    onChange({ options: [...form.options, { option_text: '', is_correct: false, display_order: form.options.length + 1 }] });
  }
  function removeOption(index: number) {
    if (form.options.length <= 2) return;
    onChange({ options: form.options.filter((_, i) => i !== index).map((o, i) => ({ ...o, display_order: i + 1 })) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onCancel} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Question</h3>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><IconX /></button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Question Type">
            <select
              value={form.question_type}
              onChange={(e) => {
                const type = e.target.value as QuestionType;
                onChange({ question_type: type, options: optionsForType(type) });
              }}
              className={INPUT_CLS}
            >
              {QUESTION_TYPE_OPTIONS.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
          </Field>
          <Field label="Difficulty">
            <select value={form.difficulty_level} onChange={(e) => onChange({ difficulty_level: e.target.value as DifficultyLevel })} className={INPUT_CLS}>
              {DIFFICULTY_OPTIONS.map((d) => (<option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>))}
            </select>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Question Text">
            <textarea value={form.question_text} onChange={(e) => onChange({ question_text: e.target.value })} rows={3} className={`${INPUT_CLS} resize-none`} />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Image Based Question (optional)">
            <div className="flex items-center gap-3">
              {form.image_url ? <img src={form.image_url} alt="" className="h-16 w-24 rounded-lg object-cover" /> : (
                <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-slate-100 text-slate-300"><IconUpload className="h-5 w-5" /></div>
              )}
              <SecondaryButton onClick={() => imageInputRef.current?.click()}>
                {uploadingImage ? <IconSpinner className="h-3.5 w-3.5" /> : <IconUpload className="h-3.5 w-3.5" />} Attach Image
              </SecondaryButton>
              <input ref={imageInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUploadImage(f); }} />
            </div>
          </Field>
        </div>

        {usesOptions && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold text-slate-500">Options — {form.question_type === 'multiple_select' ? 'select all correct answers' : 'select the correct answer'}</p>
            <div className="space-y-2">
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  {form.question_type === 'multiple_select' ? (
                    <input type="checkbox" checked={opt.is_correct} onChange={() => toggleCorrectMulti(i)} className="h-4 w-4 flex-shrink-0 rounded text-indigo-600 focus:ring-indigo-400" />
                  ) : (
                    <input type="radio" checked={opt.is_correct} onChange={() => setCorrectSingle(i)} disabled={isTrueFalse} className="h-4 w-4 flex-shrink-0 text-indigo-600 focus:ring-indigo-400" />
                  )}
                  <input
                    value={opt.option_text}
                    onChange={(e) => updateOption(i, { option_text: e.target.value })}
                    disabled={isTrueFalse}
                    placeholder={`Option ${i + 1}`}
                    className={`${INPUT_CLS} flex-1 disabled:opacity-60`}
                  />
                  {!isTrueFalse && form.options.length > 2 && (
                    <button onClick={() => removeOption(i)} className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><IconTrash /></button>
                  )}
                </div>
              ))}
            </div>
            {!isTrueFalse && form.options.length < 6 && (
              <button onClick={addOption} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"><IconPlus className="h-3.5 w-3.5" /> Add Option</button>
            )}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Marks"><input type="number" min={1} value={form.marks} onChange={(e) => onChange({ marks: Number(e.target.value) })} className={INPUT_CLS} /></Field>
          <Field label="Negative Marks"><input type="number" min={0} value={form.negative_marks} onChange={(e) => onChange({ negative_marks: Number(e.target.value) })} className={INPUT_CLS} /></Field>
          <Field label="Time Limit (sec)"><input type="number" min={0} value={form.time_limit_seconds} onChange={(e) => onChange({ time_limit_seconds: Number(e.target.value) })} className={INPUT_CLS} /></Field>
          <Field label="Display Order"><input type="number" min={1} value={form.display_order} onChange={(e) => onChange({ display_order: Number(e.target.value) })} className={INPUT_CLS} /></Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Explanation (optional)"><textarea value={form.explanation} onChange={(e) => onChange({ explanation: e.target.value })} rows={2} className={`${INPUT_CLS} resize-none`} /></Field>
          <Field label="Hint (optional)"><textarea value={form.hint} onChange={(e) => onChange({ hint: e.target.value })} rows={2} className={`${INPUT_CLS} resize-none`} /></Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ToggleRow label="Mandatory" on={form.mandatory} onChange={() => onChange({ mandatory: !form.mandatory })} />
          <ToggleRow label="Randomize Options" on={form.randomize_options} onChange={() => onChange({ randomize_options: !form.randomize_options })} />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <SecondaryButton onClick={onCancel} disabled={saving}>Cancel</SecondaryButton>
          <PrimaryButton onClick={onSave} disabled={saving || !form.question_text.trim()}>
            {saving ? <IconSpinner className="h-3.5 w-3.5" /> : null} Save Question
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview modal
// ─────────────────────────────────────────────────────────────────────────────

function PreviewModal({
  assessment, questions, onClose,
}: { assessment: Assessment; questions: QuestionWithOptionsForm[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{assessment.assessment_title}</h3>
            <p className="text-xs text-slate-400">{assessment.duration_minutes} min · Pass {assessment.passing_percentage}% · {questions.length} question(s)</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><IconX /></button>
        </div>
        {questions.length === 0 ? (
          <EmptyState message="No questions in this assessment yet." />
        ) : (
          <div className="space-y-5">
            {questions.map((q, i) => (
              <div key={i} className="rounded-xl border border-slate-100 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">{i + 1}. {q.question_text}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${DIFFICULTY_STYLES[q.difficulty_level]}`}>{q.difficulty_level}</span>
                </div>
                {q.image_url && <img src={q.image_url} alt="" className="mb-2 h-32 rounded-lg object-cover" />}
                {q.options.length > 0 && (
                  <div className="space-y-1.5">
                    {q.options.map((o, oi) => (
                      <div key={oi} className={`rounded-lg px-3 py-1.5 text-sm ${o.is_correct ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>{o.option_text}</div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-400">{q.marks} mark(s){q.negative_marks > 0 ? ` · -${q.negative_marks} negative` : ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main AssessmentManagement
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'draft' | 'published' | 'archived';

function AssessmentManagement() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());

  const [activeAssessmentId, setActiveAssessmentId] = useState('');
  const [activeTab, setActiveTab] = useState<'settings' | 'questions'>('settings');

  const [creatingOpen, setCreatingOpen] = useState(false);
  const [newLessonId, setNewLessonId] = useState('');
  const [creating, setCreating] = useState(false);
  const [savingField, setSavingField] = useState(false);

  const [deleteAssessmentTarget, setDeleteAssessmentTarget] = useState<Assessment | null>(null);
  const [deletingAssessment, setDeletingAssessment] = useState(false);

  const [optionsByQuestion, setOptionsByQuestion] = useState<Record<string, QuestionOption[]>>({});
  const [questionModalForm, setQuestionModalForm] = useState<QuestionWithOptionsForm | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteQuestionTarget, setDeleteQuestionTarget] = useState<Question | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<QuestionWithOptionsForm[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const importInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([loadAssessments(), loadQuestions(), loadLessons(), loadModules(), loadCourses(), loadCategories()])
      .then(([assessmentRows, questionRows, lessonRows, moduleRows, courseRows, categoryRows]) => {
        setAssessments(assessmentRows);
        setQuestions(questionRows);
        setLessons(lessonRows);
        setModules(moduleRows);
        setCourses(courseRows);
        setCategories(categoryRows);
        setActiveAssessmentId((prev) => prev || assessmentRows[0]?.id || '');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load assessments.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Course / Category resolution (assessment -> lesson -> module -> course -> category) ──

  const lessonById = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons]);
  const moduleById = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  function resolveCourse(a: Assessment): Course | null {
    const lesson = a.lesson_id ? lessonById.get(a.lesson_id) : undefined;
    const mod = lesson ? moduleById.get(lesson.module_id) : undefined;
    return mod ? courseById.get(mod.course_id) ?? null : null;
  }
  function resolveCategory(a: Assessment): Category | null {
    const course = resolveCourse(a);
    return course ? categoryById.get(course.category_id) ?? null : null;
  }

  const questionsByAssessment = useMemo(() => {
    const map = new Map<string, Question[]>();
    questions.forEach((q) => {
      const list = map.get(q.assessment_id) ?? [];
      list.push(q);
      map.set(q.assessment_id, list);
    });
    return map;
  }, [questions]);

  // ── Filtering ────────────────────────────────────────────────────────────────

  const searchTerm = search.trim().toLowerCase();
  const filteredAssessments = useMemo(() => {
    return assessments.filter((a) => {
      const archived = archivedIds.has(a.id);
      if (searchTerm && !a.assessment_title.toLowerCase().includes(searchTerm) && !a.assessment_code.toLowerCase().includes(searchTerm)) return false;
      if (courseFilter !== 'all' && resolveCourse(a)?.id !== courseFilter) return false;
      if (categoryFilter !== 'all' && resolveCategory(a)?.id !== categoryFilter) return false;
      if (statusFilter === 'archived' && !archived) return false;
      if (statusFilter === 'published' && (archived || !a.active)) return false;
      if (statusFilter === 'draft' && (archived || a.active)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessments, searchTerm, courseFilter, categoryFilter, statusFilter, archivedIds, lessonById, moduleById, courseById, categoryById]);

  const activeAssessment = assessments.find((a) => a.id === activeAssessmentId) ?? null;
  const activeQuestions = activeAssessmentId ? (questionsByAssessment.get(activeAssessmentId) ?? []).sort((a, b) => a.display_order - b.display_order) : [];

  // ── Assessment CRUD ──────────────────────────────────────────────────────────

  const availableLessonsForNew = useMemo(() => {
    const usedLessonIds = new Set(assessments.map((a) => a.lesson_id));
    return lessons.filter((l) => l.lesson_type === 'quiz' && !usedLessonIds.has(l.id));
  }, [assessments, lessons]);

  async function handleCreateAssessment() {
    if (!newLessonId) return;
    setCreating(true);
    try {
      const lesson = lessonById.get(newLessonId);
      const created = await createAssessment({
        lesson_id: newLessonId,
        company_id: null,
        assessment_code: `ASM-${Date.now().toString(36).toUpperCase()}`,
        assessment_title: lesson?.lesson_title || 'Untitled Assessment',
        description: '',
        assessment_type: 'quiz',
        passing_percentage: 70,
        maximum_attempts: 3,
        duration_minutes: 30,
        question_timer_enabled: false,
        question_time_seconds: 60,
        shuffle_questions: false,
        shuffle_options: false,
        negative_marking: false,
        negative_marks: 0,
        show_result_immediately: true,
        show_correct_answers: true,
        auto_submit: true,
        certificate_enabled: false,
        active: true,
      });
      setCreatingOpen(false);
      setNewLessonId('');
      fetchAll();
      setActiveAssessmentId(created.id);
      setActiveTab('settings');
      showToast('Assessment created');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create assessment.');
    } finally {
      setCreating(false);
    }
  }

  async function updateAssessmentField(patch: Partial<AssessmentForm>) {
    if (!activeAssessment) return;
    setSavingField(true);
    try {
      await saveAssessment(activeAssessment.id, { ...toAssessmentForm(activeAssessment), ...patch });
      fetchAll();
      showToast('Saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSavingField(false);
    }
  }

  async function handleDeleteAssessmentConfirm() {
    if (!deleteAssessmentTarget) return;
    setDeletingAssessment(true);
    try {
      await removeAssessment(deleteAssessmentTarget.id);
      if (activeAssessmentId === deleteAssessmentTarget.id) setActiveAssessmentId('');
      setDeleteAssessmentTarget(null);
      fetchAll();
      showToast('Assessment deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete assessment.');
    } finally {
      setDeletingAssessment(false);
    }
  }

  async function handleDuplicateAssessment(a: Assessment) {
    try {
      const created = await createAssessment({
        ...toAssessmentForm(a),
        assessment_code: `${a.assessment_code}-COPY-${Date.now().toString(36).toUpperCase()}`,
        assessment_title: `${a.assessment_title} (Copy)`,
        active: false,
      });
      const sourceQuestions = questionsByAssessment.get(a.id) ?? [];
      for (const q of sourceQuestions) {
        const opts = await loadOptionsByQuestion(q.id);
        await createQuestion({
          ...questionToForm(q, opts),
          assessment_id: created.id,
          question_code: `${q.question_code}-COPY-${Date.now().toString(36).toUpperCase()}`,
        });
      }
      fetchAll();
      showToast('Assessment duplicated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to duplicate assessment.');
    }
  }

  async function handlePublishToggle(a: Assessment) {
    try {
      await toggleAssessmentStatus(a.id, !a.active);
      fetchAll();
      showToast(a.active ? 'Unpublished' : 'Published');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update status.');
    }
  }

  function handleToggleArchive(a: Assessment) {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
      return next;
    });
    showToast(archivedIds.has(a.id) ? 'Restored from archive' : 'Archived');
  }

  // ── Question CRUD ────────────────────────────────────────────────────────────

  async function fetchOptionsFor(questionId: string): Promise<QuestionOption[]> {
    if (optionsByQuestion[questionId]) return optionsByQuestion[questionId];
    const opts = await loadOptionsByQuestion(questionId);
    setOptionsByQuestion((prev) => ({ ...prev, [questionId]: opts }));
    return opts;
  }

  function openCreateQuestion() {
    if (!activeAssessmentId) return;
    setEditingQuestionId(null);
    setQuestionModalForm(newQuestionForm(activeAssessmentId));
  }

  async function openEditQuestion(q: Question) {
    const opts = await fetchOptionsFor(q.id);
    setEditingQuestionId(q.id);
    setQuestionModalForm(questionToForm(q, opts));
  }

  function updateQuestionModal(patch: Partial<QuestionWithOptionsForm>) {
    setQuestionModalForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function handleUploadQuestionImage(file: File) {
    setUploadingImage(true);
    try {
      const result = await uploadImage(file);
      updateQuestionModal({ image_url: result.url });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSaveQuestion() {
    if (!questionModalForm) return;
    setSavingQuestion(true);
    try {
      if (editingQuestionId) {
        await saveQuestion(editingQuestionId, questionModalForm);
      } else {
        await createQuestion(questionModalForm);
      }
      setQuestionModalForm(null);
      setEditingQuestionId(null);
      fetchAll();
      showToast('Question saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save question.');
    } finally {
      setSavingQuestion(false);
    }
  }

  async function handleDeleteQuestionConfirm() {
    if (!deleteQuestionTarget) return;
    try {
      await removeQuestion(deleteQuestionTarget.id);
      setDeleteQuestionTarget(null);
      fetchAll();
      showToast('Question deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete question.');
    }
  }

  async function handleDuplicateQuestion(q: Question) {
    try {
      const opts = await fetchOptionsFor(q.id);
      const form = questionToForm(q, opts);
      await createQuestion({ ...form, question_code: `${q.question_code}-COPY-${Date.now().toString(36).toUpperCase()}` });
      fetchAll();
      showToast('Question duplicated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to duplicate question.');
    }
  }

  async function handleToggleQuestionActive(q: Question) {
    try {
      await toggleQuestionStatus(q.id, !q.active);
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update question status.');
    }
  }

  // ── Bulk import / export ─────────────────────────────────────────────────────

  async function handleBulkImport(file: File) {
    if (!activeAssessmentId) return;
    try {
      const text = await file.text();
      const forms = csvToQuestionForms(text, activeAssessmentId);
      if (forms.length === 0) { showToast('No valid questions found in file.'); return; }
      for (const form of forms) await createQuestion(form);
      fetchAll();
      showToast(`Imported ${forms.length} question(s)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed.');
    }
  }

  async function handleBulkExport() {
    if (activeQuestions.length === 0) { showToast('No questions to export.'); return; }
    const forms = await Promise.all(activeQuestions.map(async (q) => questionToForm(q, await fetchOptionsFor(q.id))));
    downloadBlob(questionsToCsv(forms), `${activeAssessment?.assessment_code || 'questions'}.csv`, 'text/csv');
  }

  async function handleOpenPreview() {
    if (!activeAssessment) return;
    setPreviewLoading(true);
    try {
      const forms = await Promise.all(activeQuestions.map(async (q) => questionToForm(q, await fetchOptionsFor(q.id))));
      setPreviewQuestions(forms);
      setPreviewOpen(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load preview.');
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  const courseOptionsMap = new Map<string, Course>();
  const categoryOptionsMap = new Map<string, Category>();
  assessments.forEach((a) => {
    const course = resolveCourse(a);
    if (course) courseOptionsMap.set(course.id, course);
    const category = resolveCategory(a);
    if (category) categoryOptionsMap.set(category.id, category);
  });
  const courseOptions = Array.from(courseOptionsMap.values());
  const categoryOptions = Array.from(categoryOptionsMap.values());

  return (
    <div className="space-y-6">

      {/* TOP BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Assessments</h2>
          <p className="text-sm text-slate-500">Manage assessments and their question banks.</p>
        </div>
        <PrimaryButton onClick={() => setCreatingOpen(true)}><IconPlus className="h-3.5 w-3.5" /> Create Assessment</PrimaryButton>
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assessments…" className={`${INPUT_CLS} min-w-[200px] flex-1`} />
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className={INPUT_CLS}>
          <option value="all">All Courses</option>
          {courseOptions.map((c) => (<option key={c.id} value={c.id}>{c.course_name}</option>))}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={INPUT_CLS}>
          <option value="all">All Categories</option>
          {categoryOptions.map((c) => (<option key={c.id} value={c.id}>{c.category_name}</option>))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={INPUT_CLS}>
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">

        {/* LIST */}
        <div className="rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          {filteredAssessments.length === 0 ? (
            <EmptyState message="No assessments match these filters." />
          ) : (
            <div className="max-h-[600px] space-y-1.5 overflow-y-auto">
              {filteredAssessments.map((a) => {
                const course = resolveCourse(a);
                const questionCount = (questionsByAssessment.get(a.id) ?? []).length;
                return (
                  <button
                    key={a.id}
                    onClick={() => { setActiveAssessmentId(a.id); setActiveTab('settings'); }}
                    className={`flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition ${activeAssessmentId === a.id ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">{a.assessment_title}</span>
                      <StatusBadge active={a.active} archived={archivedIds.has(a.id)} />
                    </div>
                    <span className="truncate text-xs text-slate-400">{course?.course_name ?? 'Unlinked'} · {questionCount} question(s)</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* DETAIL */}
        <div className="space-y-6">
          {!activeAssessment ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <EmptyState message="Select or create an assessment to begin." />
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-800">{activeAssessment.assessment_title}</h3>
                    <StatusBadge active={activeAssessment.active} archived={archivedIds.has(activeAssessment.id)} />
                    {savingField && <IconSpinner className="h-3.5 w-3.5 text-slate-400" />}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SecondaryButton onClick={handleOpenPreview} disabled={previewLoading}>
                      {previewLoading ? <IconSpinner className="h-3.5 w-3.5" /> : <IconEye className="h-3.5 w-3.5" />} Preview
                    </SecondaryButton>
                    <SecondaryButton onClick={() => handleDuplicateAssessment(activeAssessment)}><IconDuplicate /> Duplicate</SecondaryButton>
                    <AccentButton onClick={() => handlePublishToggle(activeAssessment)}>{activeAssessment.active ? 'Unpublish' : 'Publish'}</AccentButton>
                    <SecondaryButton onClick={() => handleToggleArchive(activeAssessment)}>{archivedIds.has(activeAssessment.id) ? 'Restore' : 'Archive'}</SecondaryButton>
                    <DangerButton onClick={() => setDeleteAssessmentTarget(activeAssessment)}><IconTrash /> Delete</DangerButton>
                  </div>
                </div>

                <div className="flex gap-2 border-b border-slate-100 pb-3">
                  <button onClick={() => setActiveTab('settings')} className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${activeTab === 'settings' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Settings</button>
                  <button onClick={() => setActiveTab('questions')} className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${activeTab === 'questions' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Questions ({activeQuestions.length})</button>
                </div>

                {activeTab === 'settings' && (
                  <div className="mt-5 space-y-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Assessment Title">
                        <input key={`${activeAssessment.id}-title`} defaultValue={activeAssessment.assessment_title} onBlur={(e) => updateAssessmentField({ assessment_title: e.target.value })} className={INPUT_CLS} />
                      </Field>
                      <Field label="Assessment Type">
                        <select value={activeAssessment.assessment_type} onChange={(e) => updateAssessmentField({ assessment_type: e.target.value as AssessmentType })} className={INPUT_CLS}>
                          {ASSESSMENT_TYPE_OPTIONS.map((t) => (<option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>))}
                        </select>
                      </Field>
                    </div>
                    <Field label="Description">
                      <textarea key={`${activeAssessment.id}-desc`} defaultValue={activeAssessment.description} onBlur={(e) => updateAssessmentField({ description: e.target.value })} rows={3} className={`${INPUT_CLS} resize-none`} />
                    </Field>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <Field label="Passing %">
                        <input key={`${activeAssessment.id}-pass`} type="number" min={0} max={100} defaultValue={activeAssessment.passing_percentage} onBlur={(e) => updateAssessmentField({ passing_percentage: Number(e.target.value) })} className={INPUT_CLS} />
                      </Field>
                      <Field label="Duration (min)">
                        <input key={`${activeAssessment.id}-dur`} type="number" min={1} defaultValue={activeAssessment.duration_minutes} onBlur={(e) => updateAssessmentField({ duration_minutes: Number(e.target.value) })} className={INPUT_CLS} />
                      </Field>
                      <Field label="Attempts">
                        <input key={`${activeAssessment.id}-att`} type="number" min={1} defaultValue={activeAssessment.maximum_attempts} onBlur={(e) => updateAssessmentField({ maximum_attempts: Number(e.target.value) })} className={INPUT_CLS} />
                      </Field>
                      <Field label="Negative Marks">
                        <input key={`${activeAssessment.id}-neg`} type="number" min={0} defaultValue={activeAssessment.negative_marks} onBlur={(e) => updateAssessmentField({ negative_marks: Number(e.target.value) })} className={INPUT_CLS} />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <ToggleRow label="Shuffle Questions" on={activeAssessment.shuffle_questions} onChange={() => updateAssessmentField({ shuffle_questions: !activeAssessment.shuffle_questions })} />
                      <ToggleRow label="Shuffle Options" on={activeAssessment.shuffle_options} onChange={() => updateAssessmentField({ shuffle_options: !activeAssessment.shuffle_options })} />
                      <ToggleRow label="Negative Marking" on={activeAssessment.negative_marking} onChange={() => updateAssessmentField({ negative_marking: !activeAssessment.negative_marking })} />
                      <ToggleRow label="Question Timer" on={activeAssessment.question_timer_enabled} onChange={() => updateAssessmentField({ question_timer_enabled: !activeAssessment.question_timer_enabled })} />
                      <ToggleRow label="Auto Submit" on={activeAssessment.auto_submit} onChange={() => updateAssessmentField({ auto_submit: !activeAssessment.auto_submit })} />
                      <ToggleRow label="Certificate Eligible" on={activeAssessment.certificate_enabled} onChange={() => updateAssessmentField({ certificate_enabled: !activeAssessment.certificate_enabled })} />
                      <ToggleRow label="Show Result Immediately" on={activeAssessment.show_result_immediately} onChange={() => updateAssessmentField({ show_result_immediately: !activeAssessment.show_result_immediately })} />
                      <ToggleRow label="Show Correct Answers" on={activeAssessment.show_correct_answers} onChange={() => updateAssessmentField({ show_correct_answers: !activeAssessment.show_correct_answers })} />
                    </div>

                    {activeAssessment.question_timer_enabled && (
                      <Field label="Time Per Question (sec)">
                        <input key={`${activeAssessment.id}-qtime`} type="number" min={5} max={600} defaultValue={activeAssessment.question_time_seconds} onBlur={(e) => updateAssessmentField({ question_time_seconds: Number(e.target.value) })} className="max-w-[160px] rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
                      </Field>
                    )}
                  </div>
                )}

                {activeTab === 'questions' && (
                  <div className="mt-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Question Bank</p>
                      <div className="flex flex-wrap gap-2">
                        <SecondaryButton onClick={() => importInputRef.current?.click()}><IconUpload className="h-3.5 w-3.5" /> Bulk Import</SecondaryButton>
                        <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleBulkImport(f); }} />
                        <SecondaryButton onClick={handleBulkExport}><IconDownload className="h-3.5 w-3.5" /> Bulk Export</SecondaryButton>
                        <PrimaryButton onClick={openCreateQuestion}><IconPlus className="h-3.5 w-3.5" /> Add Question</PrimaryButton>
                      </div>
                    </div>

                    {activeQuestions.length === 0 ? (
                      <EmptyState message="No questions yet — add one or bulk import a CSV." />
                    ) : (
                      <div className="space-y-2">
                        {activeQuestions.map((q, idx) => (
                          <div key={q.id} className="rounded-xl border border-slate-100 p-3.5">
                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{idx + 1}. {q.question_text}</p>
                              <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${DIFFICULTY_STYLES[q.difficulty_level]}`}>{q.difficulty_level}</span>
                            </div>
                            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">{QUESTION_TYPE_LABEL[q.question_type]}</span>
                              <span>{q.marks} mark(s)</span>
                              {q.negative_marks > 0 && <span>-{q.negative_marks} negative</span>}
                              {q.mandatory && <span className="text-indigo-500">Mandatory</span>}
                              {!q.active && <span className="text-amber-600">Inactive</span>}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <SecondaryButton onClick={() => openEditQuestion(q)}>Edit</SecondaryButton>
                              <SecondaryButton onClick={() => handleDuplicateQuestion(q)}><IconDuplicate /> Duplicate</SecondaryButton>
                              <SecondaryButton onClick={() => handleToggleQuestionActive(q)}>{q.active ? 'Deactivate' : 'Activate'}</SecondaryButton>
                              <DangerButton onClick={() => setDeleteQuestionTarget(q)}><IconTrash /> Delete</DangerButton>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {creatingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setCreatingOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-slate-900">Create Assessment</h3>
            <Field label="Linked Quiz Lesson">
              <select value={newLessonId} onChange={(e) => setNewLessonId(e.target.value)} className={INPUT_CLS}>
                <option value="">Select a quiz-type lesson…</option>
                {availableLessonsForNew.map((l) => (<option key={l.id} value={l.id}>{l.lesson_title}</option>))}
              </select>
            </Field>
            {availableLessonsForNew.length === 0 && (
              <p className="mt-2 text-xs text-slate-400">No unused Quiz-type lessons available. Create one in Course Builder first.</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <SecondaryButton onClick={() => setCreatingOpen(false)} disabled={creating}>Cancel</SecondaryButton>
              <PrimaryButton onClick={handleCreateAssessment} disabled={!newLessonId || creating}>
                {creating ? <IconSpinner className="h-3.5 w-3.5" /> : null} Create
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {deleteAssessmentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDeleteAssessmentTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-slate-900">Delete Assessment</h3>
            <p className="mb-5 text-sm text-slate-500">Delete "{deleteAssessmentTarget.assessment_title}"? This also removes its questions.</p>
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setDeleteAssessmentTarget(null)} disabled={deletingAssessment}>Cancel</SecondaryButton>
              <DangerButton onClick={handleDeleteAssessmentConfirm} disabled={deletingAssessment}>
                {deletingAssessment ? <IconSpinner className="h-3.5 w-3.5" /> : <IconTrash />} Delete
              </DangerButton>
            </div>
          </div>
        </div>
      )}

      {deleteQuestionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDeleteQuestionTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-slate-900">Delete Question</h3>
            <p className="mb-5 text-sm text-slate-500">Delete this question? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setDeleteQuestionTarget(null)}>Cancel</SecondaryButton>
              <DangerButton onClick={handleDeleteQuestionConfirm}><IconTrash /> Delete</DangerButton>
            </div>
          </div>
        </div>
      )}

      {questionModalForm && (
        <QuestionEditorModal
          form={questionModalForm}
          saving={savingQuestion}
          uploadingImage={uploadingImage}
          onChange={updateQuestionModal}
          onUploadImage={handleUploadQuestionImage}
          onSave={handleSaveQuestion}
          onCancel={() => { setQuestionModalForm(null); setEditingQuestionId(null); }}
        />
      )}

      {previewOpen && activeAssessment && (
        <PreviewModal assessment={activeAssessment} questions={previewQuestions} onClose={() => setPreviewOpen(false)} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default AssessmentManagement;