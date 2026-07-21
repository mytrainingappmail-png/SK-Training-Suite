// src/components/admin/coursebuilder/CourseBuilder.tsx
//
// Premium Training App Course Builder: Course → Module → Page / Video /
// Reading Material / Assignment / Quiz (all existing `lessons` rows,
// differentiated by lesson_type — no schema change). Reuses existing
// services only (courseService, moduleService, lessonBuilderService,
// resourceService, contentEditorService). Every lesson type — including
// Page — is edited inside this same dark 3-column workspace via its own
// lightweight panel; the standalone ContentEditor component (with its own
// separate layout) is never embedded here.
//
// Right-panel Properties are 100% backed by real columns:
//   Module selected → module_name / description / thumbnail /
//                      estimated_minutes / module_order / active
//   Item selected   → lesson_title / content (as plain-text description
//                      for non-Page items only) / duration_minutes /
//                      display_order / active
// "Mandatory" has no dedicated column anywhere in the schema, so — same as
// Assignment/Quiz settings — it is kept as temporary, session-local UI
// state only, clearly labelled as such. Nothing fake is persisted.

import { useEffect, useRef, useState } from 'react';

import { loadCourses } from '../../../services/course/courseService';
import { loadModules, createModule, saveModule, removeModule } from '../../../services/module/moduleService';
import {
  loadLessons,
  createLesson,
  updateLesson,
  deleteLesson,
} from '../../../services/lessonBuilder/lessonBuilderService';
import { loadLessonContent, uploadVideo, uploadDocument, uploadImage } from '../../../services/contentEditor/contentEditorService';
import {
  loadResources,
  createResource,
  saveResource,
  removeResource,
} from '../../../services/resource/resourceService';
import {
  loadAssessments,
  createAssessment,
  saveAssessment,
  removeAssessment,
} from '../../../services/assessment/assessmentService';
import {
  loadQuestions,
  createQuestion,
  saveQuestion,
  removeQuestion,
  loadOptionsByQuestion,
} from '../../../services/question/questionService';

import type { Lesson, LessonType } from '../../../types/lessonBuilder';
import type { Module, ModuleForm } from '../../../types/module';
import type { Course } from '../../../types/course';
import type { Resource } from '../../../types/resource';
import type { Assessment, AssessmentForm, AssessmentType } from '../../../types/assessment';
import { defaultAssessmentForm } from '../../../types/assessment';
import type { Question, QuestionType, DifficultyLevel, QuestionWithOptionsForm, QuestionOptionForm } from '../../../types/question';
import { defaultQuestionForm, TRUE_FALSE_OPTIONS } from '../../../types/question';

const LESSONS_CHANGED_EVENT = 'sk:lessons-changed';

function notifyLessonsChanged() {
  window.dispatchEvent(new CustomEvent(LESSONS_CHANGED_EVENT));
}

function pageTypeLabel(type: LessonType): string {
  if (type === 'video') return 'Video';
  if (type === 'document') return 'Reading Material';
  if (type === 'assignment') return 'Assignment';
  if (type === 'quiz') return 'Quiz';
  return 'Page';
}

function toModuleForm(mod: Module): ModuleForm {
  return {
    course_id: mod.course_id,
    module_code: mod.module_code,
    module_name: mod.module_name,
    description: mod.description,
    module_order: mod.module_order,
    estimated_minutes: mod.estimated_minutes,
    thumbnail: mod.thumbnail,
    active: mod.active,
  };
}

// For text pages, PageEditorPanel exclusively manages lesson.content as
// rich HTML. For every other lesson type, the same `content` column is
// reused as a plain-text Description — it must never render raw markup
// (e.g. leftover HTML from when a lesson was previously a text page).
function stripHtml(value: string): string {
  if (!value) return '';
  if (!/<[a-z][\s\S]*>/i.test(value)) return value;
  const div = document.createElement('div');
  div.innerHTML = value;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

function youtubeEmbedId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AssignmentSettings {
  instructions:       string;
  marks:              number;
  submissionRequired: boolean;
}

const DEFAULT_ASSIGNMENT: AssignmentSettings = { instructions: '', marks: 0, submissionRequired: false };

// ─────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG only — no external icon package, no emoji)
// ─────────────────────────────────────────────────────────────────────────────

function IconChevronDown({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}
function IconChevronRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}
function IconPanelLeft({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 4.5v15" />
    </svg>
  );
}
function IconSlidersHorizontal({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m9 12h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9 0H12m-8.25-6H12m0 0a1.5 1.5 0 1 0 3 0m-3 0a1.5 1.5 0 1 1 3 0m3.75 0H20.25" />
    </svg>
  );
}
function IconPlus({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
function IconTrash({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}
function IconPencil({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
    </svg>
  );
}
function IconDuplicate({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.29 48.29 0 0 1 1.927-.184" />
    </svg>
  );
}
function IconArrowUp({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
    </svg>
  );
}
function IconArrowDown({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}
function IconEye({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}
function IconSave({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
function IconX({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}
function IconUpload({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
function IconPage({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}
function IconVideo({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5 19.5 7.5v9l-3.75-3M4.5 6.75h9a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5v-7.5a1.5 1.5 0 0 1 1.5-1.5Z" />
    </svg>
  );
}
function IconAttachment({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
    </svg>
  );
}
function IconAssignment({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
    </svg>
  );
}
function IconQuiz({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17.25h.008v.008H12v-.008Z" />
    </svg>
  );
}
function IconImage({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M8.25 6.75h.008v.008H8.25V6.75Z" />
    </svg>
  );
}
function IconHighlight({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 11.25 6.75-6.75 3 3-6.75 6.75L9 15l-3-3 3-.75Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 19.5h18" />
    </svg>
  );
}

function PageTypeIcon({ type, className = 'h-4 w-4' }: { type: LessonType; className?: string }) {
  if (type === 'video') return <IconVideo className={className} />;
  if (type === 'document') return <IconAttachment className={className} />;
  if (type === 'assignment') return <IconAssignment className={className} />;
  if (type === 'quiz') return <IconQuiz className={className} />;
  return <IconPage className={className} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.4)]">
      <h3 className="mb-4 text-lg font-bold text-slate-100">{title}</h3>
      {children}
    </div>
  );
}

function PrimaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-950/40 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

function AccentButton({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-400 active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-3.5 py-2 text-sm font-semibold text-slate-200 shadow-sm ring-1 ring-slate-700 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

function DangerButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-3.5 py-2 text-sm font-semibold text-red-400 shadow-sm ring-1 ring-red-500/20 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <IconSpinner className={className} />;
}

function DeleteDialog({
  title, name, busy, onConfirm, onCancel,
}: { title: string; name: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={!busy ? onCancel : undefined} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <h3 className="mb-1 text-lg font-bold text-slate-100">{title}</h3>
        <p className="mb-5 text-sm text-slate-400">
          Delete <span className="font-semibold text-slate-200">{name}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onCancel} disabled={busy}>Cancel</SecondaryButton>
          <DangerButton onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner className="h-3.5 w-3.5" /> : <IconTrash className="h-3.5 w-3.5" />} Delete
          </DangerButton>
        </div>
      </div>
    </div>
  );
}

function PreviewDialog({ html, onClose }: { html: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100">Preview</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800">
            <IconX className="h-4 w-4" />
          </button>
        </div>
        <div className="prose max-w-none rounded-xl bg-white p-5 text-[15px] leading-relaxed text-slate-900" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Video Editor panel — reuses lesson.video_url + the existing uploadVideo()
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Page (text) editor panel — reuses the existing contentEditorService
// (loadLessonContent) and lessonBuilderService (updateLesson) directly.
// This replaces the standalone ContentEditor component, which had its own
// separate light-themed layout; Page lessons now share this same dark
// workspace exactly like every other lesson type.
// ─────────────────────────────────────────────────────────────────────────────

function PageEditorPanel({ lessonId, onDirtyChange }: { lessonId: string; onDirtyChange?: (dirty: boolean) => void }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [editorBg, setEditorBg] = useState<'dark' | 'white' | 'gray' | 'cream'>('dark');
  const [localNotice, setLocalNotice] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const loadedLessonId = useRef<string>('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRange = useRef<Range | null>(null);

  const EDITOR_BG: Record<typeof editorBg, { bg: string; text: string; label: string }> = {
    dark: { bg: '#1e293b', text: '#f1f5f9', label: 'Dark Blue' },
    white: { bg: '#ffffff', text: '#0f172a', label: 'White' },
    gray: { bg: '#f1f5f9', text: '#0f172a', label: 'Light Gray' },
    cream: { bg: '#fdf6e3', text: '#1f2937', label: 'Cream' },
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadLessonContent(lessonId)
      .then((data) => {
        if (cancelled) return;
        setHtml(data.content || '');
      })
      .catch(() => {
        if (!cancelled) setHtml('');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [lessonId]);

  useEffect(() => {
    if (!loading && editorRef.current && loadedLessonId.current !== lessonId) {
      editorRef.current.innerHTML = html;
      loadedLessonId.current = lessonId;
    }
  }, [loading, html, lessonId]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // ── Selection preservation ── native file pickers, color inputs and
  // window.prompt() all steal focus/selection from the contentEditable
  // element; every toolbar action saves the Range beforehand and restores
  // it right before executing, so insertion always lands where the user
  // was actually working (this is the fix for images "not appearing" —
  // execCommand was silently inserting into a lost/empty selection).
  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current && editorRef.current.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreSelection() {
    if (!savedRange.current) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(savedRange.current);
  }

  function handleInput() {
    if (editorRef.current) setHtml(editorRef.current.innerHTML);
    onDirtyChange?.(true);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      handleAutoSave();
    }, 2000);
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, value);
    saveSelection();
    handleInput();
  }

  function setFontSize(px: string) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand('fontSize', false, '7');
    if (editorRef.current) {
      editorRef.current.querySelectorAll('font[size="7"]').forEach((el) => {
        const span = document.createElement('span');
        span.style.fontSize = px;
        span.innerHTML = el.innerHTML;
        el.replaceWith(span);
      });
    }
    saveSelection();
    handleInput();
  }

  function handleInsertLink() {
    saveSelection();
    const url = window.prompt('Link URL:', 'https://');
    if (url) exec('createLink', url);
  }

  function handleEditorKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const ctrlOrCmd = e.ctrlKey || e.metaKey;
    if (!ctrlOrCmd) return;
    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); exec('bold'); }
    else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); exec('italic'); }
    else if (e.key === 'u' || e.key === 'U') { e.preventDefault(); exec('underline'); }
  }

  async function handleAutoSave() {
    if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null; }
    if (!editorRef.current) return;
    const current = editorRef.current.innerHTML;
    setSaveState('saving');
    try {
      await updateLesson(lessonId, { content: current });
      setSaveState('saved');
      onDirtyChange?.(false);
      notifyLessonsChanged();
      setTimeout(() => setSaveState('idle'), 1500);
    } catch {
      setSaveState('idle');
    }
  }

  function handleImageButtonClick() {
    saveSelection();
    imageInputRef.current?.click();
  }

  async function handleInsertImage(file: File) {
    setUploadingImage(true);
    try {
      const result = await uploadImage(file);
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${result.url}" alt="" style="max-width:100%;border-radius:0.5rem;" onerror="this.style.display='none'" />`
      );
      saveSelection();
      handleInput();
    } catch {
      // upload failure is surfaced by the service call itself; nothing to insert
    } finally {
      setUploadingImage(false);
    }
  }

  // ── Image selection (resize / align / delete) ───────────────────────────────
  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    setSelectedImage(target.tagName === 'IMG' ? (target as HTMLImageElement) : null);
  }
  function setImageAlign(align: 'left' | 'center' | 'right' | 'full') {
    if (!selectedImage) return;
    if (align === 'left') {
      selectedImage.style.cssFloat = 'left';
      selectedImage.style.display = '';
      selectedImage.style.margin = '0 1rem 1rem 0';
      selectedImage.style.width = selectedImage.style.width || '50%';
    } else if (align === 'right') {
      selectedImage.style.cssFloat = 'right';
      selectedImage.style.display = '';
      selectedImage.style.margin = '0 0 1rem 1rem';
      selectedImage.style.width = selectedImage.style.width || '50%';
    } else if (align === 'center') {
      selectedImage.style.cssFloat = 'none';
      selectedImage.style.display = 'block';
      selectedImage.style.margin = '0 auto 1rem auto';
    } else {
      selectedImage.style.cssFloat = 'none';
      selectedImage.style.display = 'block';
      selectedImage.style.margin = '0 0 1rem 0';
      selectedImage.style.width = '100%';
    }
    handleInput();
  }
  function setImageWidth(pct: string) {
    if (!selectedImage) return;
    selectedImage.style.width = pct;
    handleInput();
  }
  function deleteSelectedImage() {
    if (!selectedImage) return;
    selectedImage.remove();
    setSelectedImage(null);
    handleInput();
  }

  function showLocalNotice(message: string) {
    setLocalNotice(message);
    setTimeout(() => setLocalNotice(''), 2000);
  }

  // ── Tables ───────────────────────────────────────────────────────────────────
  function getSelectedCell(): HTMLTableCellElement | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLTableCellElement) return node;
      node = node.parentNode;
    }
    return null;
  }
  function insertTable() {
    const rowsInput = window.prompt('Number of rows:', '3');
    const colsInput = window.prompt('Number of columns:', '3');
    const rows = Math.max(1, Number(rowsInput) || 3);
    const cols = Math.max(1, Number(colsInput) || 3);
    let tableHtml = '<table style="border-collapse:collapse;width:100%;margin:0.5rem 0;">';
    for (let r = 0; r < rows; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < cols; c++) {
        tableHtml += '<td style="border:1px solid #64748b;padding:6px;min-width:40px;">&nbsp;</td>';
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</table><p><br></p>';
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand('insertHTML', false, tableHtml);
    saveSelection();
    handleInput();
  }
  function addTableRow() {
    const cell = getSelectedCell();
    const row = cell?.closest('tr');
    if (!row) { showLocalNotice('Click inside a table cell first.'); return; }
    const newRow = row.cloneNode(true) as HTMLTableRowElement;
    Array.from(newRow.cells).forEach((c) => { c.innerHTML = '&nbsp;'; });
    row.after(newRow);
    handleInput();
  }
  function deleteTableRow() {
    const cell = getSelectedCell();
    const row = cell?.closest('tr');
    if (!row) { showLocalNotice('Click inside a table cell first.'); return; }
    row.remove();
    handleInput();
  }
  function addTableColumn() {
    const cell = getSelectedCell();
    const table = cell?.closest('table');
    if (!cell || !table) { showLocalNotice('Click inside a table cell first.'); return; }
    const cellIndex = cell.cellIndex;
    Array.from(table.rows).forEach((r) => {
      const newCell = r.insertCell(cellIndex + 1);
      newCell.style.border = '1px solid #64748b';
      newCell.style.padding = '6px';
      newCell.innerHTML = '&nbsp;';
    });
    handleInput();
  }
  function deleteTableColumn() {
    const cell = getSelectedCell();
    const table = cell?.closest('table');
    if (!cell || !table) { showLocalNotice('Click inside a table cell first.'); return; }
    const cellIndex = cell.cellIndex;
    Array.from(table.rows).forEach((r) => {
      if (r.cells[cellIndex]) r.deleteCell(cellIndex);
    });
    handleInput();
  }
  function mergeTableCells() {
    const cell = getSelectedCell();
    if (!cell) { showLocalNotice('Click inside a table cell first.'); return; }
    const nextCell = cell.nextElementSibling;
    if (!(nextCell instanceof HTMLTableCellElement)) { showLocalNotice('No adjacent cell to merge with.'); return; }
    const currentColspan = Number(cell.getAttribute('colspan') || '1');
    const nextColspan = Number(nextCell.getAttribute('colspan') || '1');
    cell.setAttribute('colspan', String(currentColspan + nextColspan));
    cell.innerHTML = `${cell.innerHTML} ${nextCell.innerHTML}`.trim();
    nextCell.remove();
    handleInput();
  }

  const activeBg = EDITOR_BG[editorBg];

  return (
    <Card title="Page Content">
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Spinner className="h-5 w-5" />
        </div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-1 rounded-xl bg-slate-800 p-1.5">
            <select
              onMouseDown={saveSelection}
              onChange={(e) => exec('fontName', e.target.value)}
              defaultValue=""
              title="Font Family"
              className="h-8 rounded-lg bg-slate-700 px-2 text-xs text-slate-200 focus:outline-none"
            >
              <option value="" disabled>Font</option>
              <option value="Arial">Arial</option>
              <option value="Calibri">Calibri</option>
              <option value="Verdana">Verdana</option>
              <option value="Georgia">Georgia</option>
              <option value="Tahoma">Tahoma</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
            </select>
            <select
              onMouseDown={saveSelection}
              onChange={(e) => setFontSize(`${e.target.value}px`)}
              defaultValue=""
              title="Font Size"
              className="h-8 rounded-lg bg-slate-700 px-2 text-xs text-slate-200 focus:outline-none"
            >
              <option value="" disabled>Size</option>
              {[10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48].map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
            <span className="mx-1 h-6 w-px bg-slate-700" />
            <button onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} title="Bold" className="rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-300 hover:bg-slate-700">B</button>
            <button onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} title="Italic" className="rounded-lg px-2.5 py-1.5 text-sm italic text-slate-300 hover:bg-slate-700">I</button>
            <button onMouseDown={(e) => { e.preventDefault(); exec('underline'); }} title="Underline" className="rounded-lg px-2.5 py-1.5 text-sm underline text-slate-300 hover:bg-slate-700">U</button>
            <button onMouseDown={(e) => { e.preventDefault(); exec('strikeThrough'); }} title="Strikethrough" className="rounded-lg px-2.5 py-1.5 text-sm line-through text-slate-300 hover:bg-slate-700">S</button>
            <label title="Text Color" className="flex cursor-pointer items-center rounded-lg px-1.5 hover:bg-slate-700">
              <span className="text-sm font-bold text-slate-300">A</span>
              <input type="color" onMouseDown={saveSelection} onChange={(e) => exec('foreColor', e.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" />
            </label>
            <label title="Highlight Color" className="flex cursor-pointer items-center rounded-lg px-1.5 hover:bg-slate-700">
              <IconHighlight className="h-4 w-4 text-slate-300" />
              <input type="color" onMouseDown={saveSelection} onChange={(e) => exec('hiliteColor', e.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" />
            </label>
            <button onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); }} title="Clear Formatting" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">Clear</button>
            <span className="mx-1 h-6 w-px bg-slate-700" />
            <button onMouseDown={(e) => { e.preventDefault(); exec('superscript'); }} title="Superscript" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">x²</button>
            <button onMouseDown={(e) => { e.preventDefault(); exec('subscript'); }} title="Subscript" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">x₂</button>
            <span className="mx-1 h-6 w-px bg-slate-700" />
            <select
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => exec('formatBlock', e.target.value)}
              defaultValue="<p>"
              title="Paragraph Style"
              className="h-8 rounded-lg bg-slate-700 px-2 text-xs text-slate-200 focus:outline-none"
            >
              <option value="<p>">Text</option>
              <option value="<h1>">Heading 1</option>
              <option value="<h2>">Heading 2</option>
              <option value="<h3>">Heading 3</option>
              <option value="<blockquote>">Quote</option>
            </select>
            <button onMouseDown={(e) => { e.preventDefault(); exec('insertHorizontalRule'); }} title="Horizontal Rule" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">HR</button>
            <span className="mx-1 h-6 w-px bg-slate-700" />
            <button onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }} title="Bulleted List" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">• List</button>
            <button onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }} title="Numbered List" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">1. List</button>
            <button onMouseDown={(e) => { e.preventDefault(); exec('outdent'); }} title="Decrease Indent" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">⇤</button>
            <button onMouseDown={(e) => { e.preventDefault(); exec('indent'); }} title="Increase Indent" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">⇥</button>
            <span className="mx-1 h-6 w-px bg-slate-700" />
            <button onMouseDown={(e) => { e.preventDefault(); exec('justifyLeft'); }} title="Align Left" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">Left</button>
            <button onMouseDown={(e) => { e.preventDefault(); exec('justifyCenter'); }} title="Align Center" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">Center</button>
            <button onMouseDown={(e) => { e.preventDefault(); exec('justifyRight'); }} title="Align Right" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">Right</button>
            <span className="mx-1 h-6 w-px bg-slate-700" />
            <button onMouseDown={(e) => { e.preventDefault(); handleInsertLink(); }} title="Insert Link" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">Link</button>
            <button onMouseDown={(e) => { e.preventDefault(); exec('unlink'); }} title="Remove Link" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">Unlink</button>
            <span className="mx-1 h-6 w-px bg-slate-700" />
            <button onMouseDown={(e) => { e.preventDefault(); exec('undo'); }} title="Undo" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">↶</button>
            <button onMouseDown={(e) => { e.preventDefault(); exec('redo'); }} title="Redo" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">↷</button>
            <span className="mx-1 h-6 w-px bg-slate-700" />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleImageButtonClick}
              title="Insert Image"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
            >
              {uploadingImage ? <Spinner className="h-3.5 w-3.5" /> : <IconImage className="h-3.5 w-3.5" />} Image
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.gif"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleInsertImage(f); }}
            />
            <button onMouseDown={(e) => { e.preventDefault(); insertTable(); }} title="Insert Table" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-700">Table</button>
            <span className="ml-auto pr-1 text-[11px] text-slate-500">
              {localNotice && <span className="text-amber-400">{localNotice}</span>}
              {!localNotice && saveState === 'saving' && 'Saving…'}
              {!localNotice && saveState === 'saved' && 'Saved'}
            </span>
          </div>

          {selectedImage && (
            <div className="mb-2 flex flex-wrap items-center gap-1 rounded-xl bg-slate-800 p-1.5">
              <span className="px-2 text-[11px] font-semibold text-slate-500">Image</span>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setImageAlign('left')} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700">Left</button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setImageAlign('center')} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700">Center</button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setImageAlign('right')} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700">Right</button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setImageAlign('full')} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700">Full Width</button>
              <span className="mx-1 h-6 w-px bg-slate-700" />
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setImageWidth('25%')} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700">25%</button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setImageWidth('50%')} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700">50%</button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setImageWidth('100%')} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700">100%</button>
              <span className="mx-1 h-6 w-px bg-slate-700" />
              <button onMouseDown={(e) => e.preventDefault()} onClick={deleteSelectedImage} className="rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10">Delete</button>
            </div>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-1 rounded-xl bg-slate-800 p-1.5">
            <span className="px-2 text-[11px] font-semibold text-slate-500">Table</span>
            <button onMouseDown={(e) => e.preventDefault()} onClick={addTableRow} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700">+ Row</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={deleteTableRow} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700">− Row</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={addTableColumn} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700">+ Column</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={deleteTableColumn} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700">− Column</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={mergeTableCells} className="rounded-lg px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700">Merge Cells</button>
            <span className="ml-auto flex items-center gap-1.5 pr-1">
              <span className="text-[11px] font-semibold text-slate-500">Editor Background</span>
              <select
                value={editorBg}
                onChange={(e) => setEditorBg(e.target.value as typeof editorBg)}
                className="h-7 rounded-lg bg-slate-700 px-2 text-[11px] text-slate-200 focus:outline-none"
              >
                {(Object.keys(EDITOR_BG) as (typeof editorBg)[]).map((key) => (
                  <option key={key} value={key}>{EDITOR_BG[key].label}</option>
                ))}
              </select>
            </span>
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onBlur={handleAutoSave}
            onKeyDown={handleEditorKeyDown}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onClick={handleEditorClick}
            style={{ backgroundColor: activeBg.bg, color: activeBg.text }}
            className="w-full max-h-[calc(100vh-320px)] min-h-[560px] overflow-y-auto rounded-xl border border-slate-700 p-5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </>
      )}
    </Card>
  );
}

function VideoEditorPanel({
  lesson, uploading, onUrlChange, onUpload, onDurationChange,
}: {
  lesson: Lesson;
  uploading: boolean;
  onUrlChange: (url: string) => void;
  onUpload: (file: File) => void;
  onDurationChange: (minutes: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isYouTube = !!youtubeEmbedId(lesson.video_url);
  return (
    <Card title="Video">
      {lesson.video_url ? (
        <div className="mb-4 overflow-hidden rounded-xl bg-black">
          {isYouTube ? (
            <iframe className="aspect-video w-full" src={`https://www.youtube.com/embed/${youtubeEmbedId(lesson.video_url)}`} title="Video preview" allowFullScreen />
          ) : (
            <video controls className="aspect-video w-full" src={lesson.video_url} />
          )}
        </div>
      ) : (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 py-16 text-slate-600">
          <IconVideo className="h-6 w-6" /> No video yet
        </div>
      )}
      <label className="mb-1 block text-xs font-semibold text-slate-400">YouTube URL</label>
      <input
        key={lesson.id}
        defaultValue={lesson.video_url}
        onBlur={(e) => onUrlChange(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=…"
        className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
      />
      <div className="mb-4">
        <label className="mb-1 block text-xs font-semibold text-slate-400">Duration (min)</label>
        <input
          key={`${lesson.id}-dur`}
          type="number"
          min={0}
          defaultValue={lesson.duration_minutes}
          onBlur={(e) => onDurationChange(Number(e.target.value))}
          className="w-full max-w-[140px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
      </div>
      <div className="flex items-center gap-2">
        <SecondaryButton onClick={() => inputRef.current?.click()} className="flex-1">
          {uploading ? <Spinner className="h-3.5 w-3.5" /> : <IconUpload className="h-4 w-4" />} {lesson.video_url ? 'Replace Video' : 'Upload Video (MP4)'}
        </SecondaryButton>
        {lesson.video_url && (
          <DangerButton onClick={() => onUrlChange('')}>
            <IconTrash className="h-3.5 w-3.5" /> Remove
          </DangerButton>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".mp4"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(f); }}
      />
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading Material panel — reuses existing resourceService (learning_resources)
// ─────────────────────────────────────────────────────────────────────────────

function ReadingMaterialPanel({
  resource, uploading, onUpload, onLabelChange, onRemove,
}: {
  resource: Resource | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  onLabelChange: (label: string) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Card title="Reading Material">
      {resource ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl bg-slate-800 p-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <IconAttachment className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <a href={resource.file_url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-semibold text-slate-100 hover:underline">
                {resource.file_url.split('/').pop()}
              </a>
              <p className="text-xs text-slate-400">{resource.description}</p>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Download Button Label</label>
            <input
              value={resource.resource_title}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="e.g. Download Reading Material"
              className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <div className="flex flex-wrap gap-1.5">
              {['Download Brochure', 'Download Reading Material', 'Download SOP', 'Download PPT', 'Download Price List'].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onLabelChange(label)}
                  className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-indigo-500/10 hover:text-indigo-300"
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Employees will see exactly this label on their download button.</p>
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={() => inputRef.current?.click()} className="flex-1">
              {uploading ? <Spinner className="h-3.5 w-3.5" /> : <IconUpload className="h-3.5 w-3.5" />} Replace
            </SecondaryButton>
            <DangerButton onClick={onRemove}>
              <IconTrash className="h-3.5 w-3.5" /> Delete
            </DangerButton>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 py-16 text-slate-500 transition hover:border-indigo-500/50 hover:text-indigo-400"
        >
          {uploading ? <Spinner className="h-6 w-6" /> : <IconUpload className="h-6 w-6" />}
          <span className="text-sm font-semibold">Attach PDF</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(f); }}
      />
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assignment panel — no backend column exists; temporary local UI state only
// ─────────────────────────────────────────────────────────────────────────────

function AssignmentPanel({
  settings, onChange,
}: { settings: AssignmentSettings; onChange: (patch: Partial<AssignmentSettings>) => void }) {
  return (
    <Card title="Assignment">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400">Instructions</label>
          <textarea
            value={settings.instructions}
            onChange={(e) => onChange({ instructions: e.target.value })}
            rows={6}
            placeholder="Describe what learners need to submit…"
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Marks</label>
            <input
              type="number"
              min={0}
              value={settings.marks}
              onChange={(e) => onChange({ marks: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={settings.submissionRequired}
                onChange={(e) => onChange({ submissionRequired: e.target.checked })}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
              />
              Submission Required
            </label>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Assignment settings are not backed by a dedicated table yet — kept for this session only.
        </p>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test panel — real `assessments` + `question_bank` + `question_options`
// tables (assessmentService / questionService, unmodified). One Assessment
// row per Quiz lesson (assessments.lesson_id), with a real question bank
// underneath. Nothing here is session-local or fake.
// ─────────────────────────────────────────────────────────────────────────────

const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  quiz: 'Quiz', test: 'Test', exam: 'Exam', survey: 'Survey', practice: 'Practice',
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple Choice', multiple_select: 'Multiple Select', true_false: 'True / False',
  fill_blank: 'Fill in the Blank', short_answer: 'Short Answer', long_answer: 'Long Answer',
};

const TEST_INPUT_CLS = 'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40';

function questionFormFromRow(row: Question, options: QuestionOptionForm[]): QuestionWithOptionsForm {
  return {
    assessment_id: row.assessment_id,
    question_code: row.question_code,
    question_text: row.question_text,
    question_type: row.question_type,
    difficulty_level: row.difficulty_level,
    marks: row.marks,
    negative_marks: row.negative_marks,
    time_limit_seconds: row.time_limit_seconds,
    explanation: row.explanation,
    hint: row.hint,
    display_order: row.display_order,
    mandatory: row.mandatory,
    randomize_options: row.randomize_options,
    attachment_url: row.attachment_url,
    image_url: row.image_url,
    active: row.active,
    options: options.length ? options : defaultQuestionForm.options,
  };
}

function QuestionEditorDialog({
  assessmentId, question, nextOrder, busy, onSave, onCancel,
}: {
  assessmentId: string;
  question: Question | null;
  nextOrder: number;
  busy: boolean;
  onSave: (form: QuestionWithOptionsForm) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<QuestionWithOptionsForm>({
    ...defaultQuestionForm,
    assessment_id: assessmentId,
    question_code: `Q-${Date.now().toString(36).toUpperCase()}`,
    display_order: nextOrder,
  });
  const [loadingOptions, setLoadingOptions] = useState(!!question);

  useEffect(() => {
    if (!question) return;
    let cancelled = false;
    setLoadingOptions(true);
    loadOptionsByQuestion(question.id)
      .then((opts) => {
        if (cancelled) return;
        setForm(questionFormFromRow(
          question,
          opts.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct, display_order: o.display_order })),
        ));
      })
      .finally(() => { if (!cancelled) setLoadingOptions(false); });
    return () => { cancelled = true; };
  }, [question]);

  const needsOptions = form.question_type === 'mcq' || form.question_type === 'multiple_select' || form.question_type === 'true_false';

  function toggleCorrect(index: number) {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (
        prev.question_type === 'multiple_select'
          ? (i === index ? { ...o, is_correct: !o.is_correct } : o)
          : { ...o, is_correct: i === index }
      )),
    }));
  }
  function updateOptionText(index: number, text: string) {
    setForm((prev) => ({ ...prev, options: prev.options.map((o, i) => (i === index ? { ...o, option_text: text } : o)) }));
  }
  function addOption() {
    setForm((prev) => ({ ...prev, options: [...prev.options, { option_text: '', is_correct: false, display_order: prev.options.length + 1 }] }));
  }
  function removeOptionAt(index: number) {
    setForm((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  }
  function handleTypeChange(type: QuestionType) {
    setForm((prev) => ({
      ...prev,
      question_type: type,
      options: type === 'true_false'
        ? TRUE_FALSE_OPTIONS
        : (type === 'mcq' || type === 'multiple_select' ? prev.options : []),
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={!busy ? onCancel : undefined} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100">{question ? 'Edit Question' : 'Add Question'}</h3>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"><IconX className="h-4 w-4" /></button>
        </div>
        {loadingOptions ? (
          <div className="flex items-center justify-center py-16 text-slate-500"><Spinner className="h-5 w-5" /></div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Question Text</label>
              <textarea
                value={form.question_text}
                onChange={(e) => setForm((p) => ({ ...p, question_text: e.target.value }))}
                rows={3}
                placeholder="Type the question…"
                className={`${TEST_INPUT_CLS} resize-none`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">Type</label>
                <select value={form.question_type} onChange={(e) => handleTypeChange(e.target.value as QuestionType)} className={TEST_INPUT_CLS}>
                  {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (<option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">Difficulty</label>
                <select value={form.difficulty_level} onChange={(e) => setForm((p) => ({ ...p, difficulty_level: e.target.value as DifficultyLevel }))} className={TEST_INPUT_CLS}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">Marks</label>
                <input type="number" min={1} value={form.marks} onChange={(e) => setForm((p) => ({ ...p, marks: Number(e.target.value) }))} className={TEST_INPUT_CLS} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">Negative Marks</label>
                <input type="number" min={0} value={form.negative_marks} onChange={(e) => setForm((p) => ({ ...p, negative_marks: Number(e.target.value) }))} className={TEST_INPUT_CLS} />
              </div>
            </div>

            {needsOptions && (
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-400">
                  Options {form.question_type === 'multiple_select' ? '(check all correct answers)' : '(select the correct answer)'}
                </label>
                <div className="space-y-2">
                  {form.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type={form.question_type === 'multiple_select' ? 'checkbox' : 'radio'}
                        checked={opt.is_correct}
                        onChange={() => toggleCorrect(i)}
                        disabled={form.question_type === 'true_false'}
                        className="h-4 w-4 flex-shrink-0 text-indigo-500"
                      />
                      <input
                        value={opt.option_text}
                        onChange={(e) => updateOptionText(i, e.target.value)}
                        disabled={form.question_type === 'true_false'}
                        placeholder={`Option ${i + 1}`}
                        className={`min-w-0 flex-1 ${TEST_INPUT_CLS} disabled:opacity-60`}
                      />
                      {form.question_type !== 'true_false' && form.options.length > 2 && (
                        <button onClick={() => removeOptionAt(i)} className="flex-shrink-0 rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
                          <IconTrash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {form.question_type !== 'true_false' && form.options.length < 6 && (
                  <button onClick={addOption} className="mt-2 flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                    <IconPlus className="h-3.5 w-3.5" /> Add Option
                  </button>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Explanation (shown after answering)</label>
              <textarea
                value={form.explanation}
                onChange={(e) => setForm((p) => ({ ...p, explanation: e.target.value }))}
                rows={2}
                placeholder="Optional…"
                className={`${TEST_INPUT_CLS} resize-none`}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton onClick={onCancel} disabled={busy}>Cancel</SecondaryButton>
              <PrimaryButton onClick={() => onSave(form)} disabled={busy || !form.question_text.trim()}>
                {busy ? <Spinner className="h-3.5 w-3.5" /> : <IconSave className="h-3.5 w-3.5" />} Save Question
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TestEditorPanel({ lessonId }: { lessonId: string }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | 'new' | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [deleteQuestionTarget, setDeleteQuestionTarget] = useState<Question | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  const [confirmDeleteTest, setConfirmDeleteTest] = useState(false);
  const [deletingTest, setDeletingTest] = useState(false);
  const [testToast, setTestToast] = useState('');

  function showTestToast(message: string) {
    setTestToast(message);
    setTimeout(() => setTestToast(''), 2200);
  }

  function fetchTest() {
    setLoading(true);
    Promise.all([loadAssessments(), loadQuestions()])
      .then(([assessments, allQuestions]) => {
        const match = assessments.find((a) => a.lesson_id === lessonId) ?? null;
        setAssessment(match);
        setQuestions(
          match
            ? allQuestions.filter((q) => q.assessment_id === match.id).sort((a, b) => a.display_order - b.display_order)
            : []
        );
      })
      .catch(() => showTestToast('Failed to load test.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function handleCreateTest() {
    setCreating(true);
    try {
      const created = await createAssessment({
        ...defaultAssessmentForm,
        lesson_id: lessonId,
        assessment_code: `TEST-${Date.now().toString(36).toUpperCase()}`,
        assessment_title: 'Untitled Test',
      });
      setAssessment(created);
    } catch (err) {
      showTestToast(err instanceof Error ? err.message : 'Failed to create test.');
    } finally {
      setCreating(false);
    }
  }

  async function handleSettingsChange(patch: Partial<AssessmentForm>) {
    if (!assessment) return;
    setSavingSettings(true);
    try {
      const updated = await saveAssessment(assessment.id, patch);
      setAssessment(updated);
    } catch (err) {
      showTestToast(err instanceof Error ? err.message : 'Failed to update test settings.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSaveQuestion(form: QuestionWithOptionsForm) {
    setSavingQuestion(true);
    try {
      if (editingQuestion && editingQuestion !== 'new') {
        await saveQuestion(editingQuestion.id, form);
      } else {
        await createQuestion(form);
      }
      setEditingQuestion(null);
      fetchTest();
    } catch (err) {
      showTestToast(err instanceof Error ? err.message : 'Failed to save question.');
    } finally {
      setSavingQuestion(false);
    }
  }

  async function handleDeleteQuestionConfirm() {
    if (!deleteQuestionTarget) return;
    setDeletingQuestion(true);
    try {
      await removeQuestion(deleteQuestionTarget.id);
      setDeleteQuestionTarget(null);
      fetchTest();
    } catch (err) {
      showTestToast(err instanceof Error ? err.message : 'Failed to delete question.');
    } finally {
      setDeletingQuestion(false);
    }
  }

  async function handleDeleteTestConfirm() {
    if (!assessment) return;
    setDeletingTest(true);
    try {
      await removeAssessment(assessment.id);
      setAssessment(null);
      setQuestions([]);
      setConfirmDeleteTest(false);
    } catch (err) {
      showTestToast(err instanceof Error ? err.message : 'Failed to delete test.');
    } finally {
      setDeletingTest(false);
    }
  }

  if (loading) {
    return (
      <Card title="Test">
        <div className="flex items-center justify-center py-16 text-slate-500"><Spinner className="h-5 w-5" /></div>
      </Card>
    );
  }

  if (!assessment) {
    return (
      <>
        <Card title="Test">
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-700 py-16 text-center">
            <IconQuiz className="h-6 w-6 text-slate-600" />
            <p className="text-sm text-slate-500">No test linked to this item yet.</p>
            <PrimaryButton onClick={handleCreateTest} disabled={creating}>
              {creating ? <Spinner className="h-3.5 w-3.5" /> : <IconPlus className="h-3.5 w-3.5" />} Create Test
            </PrimaryButton>
          </div>
        </Card>
        {testToast && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 shadow-lg">{testToast}</div>
        )}
      </>
    );
  }

  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

  return (
    <div className="space-y-5">
      <Card title="Test Settings">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Title</label>
            <input key={assessment.id} defaultValue={assessment.assessment_title} onBlur={(e) => handleSettingsChange({ assessment_title: e.target.value })} className={TEST_INPUT_CLS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Type</label>
              <select value={assessment.assessment_type} onChange={(e) => handleSettingsChange({ assessment_type: e.target.value as AssessmentType })} className={TEST_INPUT_CLS}>
                {(Object.keys(ASSESSMENT_TYPE_LABELS) as AssessmentType[]).map((t) => (<option key={t} value={t}>{ASSESSMENT_TYPE_LABELS[t]}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Duration (min)</label>
              <input key={`${assessment.id}-dur`} type="number" min={1} defaultValue={assessment.duration_minutes} onBlur={(e) => handleSettingsChange({ duration_minutes: Number(e.target.value) })} className={TEST_INPUT_CLS} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Passing %</label>
              <input key={`${assessment.id}-pass`} type="number" min={0} max={100} defaultValue={assessment.passing_percentage} onBlur={(e) => handleSettingsChange({ passing_percentage: Number(e.target.value) })} className={TEST_INPUT_CLS} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Max Attempts</label>
              <input key={`${assessment.id}-att`} type="number" min={1} defaultValue={assessment.maximum_attempts} onBlur={(e) => handleSettingsChange({ maximum_attempts: Number(e.target.value) })} className={TEST_INPUT_CLS} />
            </div>
          </div>
          {assessment.negative_marking && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Negative Marks (per wrong answer)</label>
              <input key={`${assessment.id}-neg`} type="number" min={0} step={0.5} defaultValue={assessment.negative_marks} onBlur={(e) => handleSettingsChange({ negative_marks: Number(e.target.value) })} className={TEST_INPUT_CLS} />
            </div>
          )}
          <div className="space-y-2">
            <ToggleRow label="Shuffle Questions" on={assessment.shuffle_questions} onChange={() => handleSettingsChange({ shuffle_questions: !assessment.shuffle_questions })} />
            <ToggleRow label="Shuffle Options" on={assessment.shuffle_options} onChange={() => handleSettingsChange({ shuffle_options: !assessment.shuffle_options })} />
            <ToggleRow label="Negative Marking" on={assessment.negative_marking} onChange={() => handleSettingsChange({ negative_marking: !assessment.negative_marking })} />
            <ToggleRow label="Show Result Immediately" on={assessment.show_result_immediately} onChange={() => handleSettingsChange({ show_result_immediately: !assessment.show_result_immediately })} />
            <ToggleRow label="Show Correct Answers" on={assessment.show_correct_answers} onChange={() => handleSettingsChange({ show_correct_answers: !assessment.show_correct_answers })} />
            <ToggleRow label="Auto Submit on Timer End" on={assessment.auto_submit} onChange={() => handleSettingsChange({ auto_submit: !assessment.auto_submit })} />
            <ToggleRow label="Certificate on Pass" on={assessment.certificate_enabled} onChange={() => handleSettingsChange({ certificate_enabled: !assessment.certificate_enabled })} />
          </div>
          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <span className="text-xs text-slate-500">
              {savingSettings ? 'Saving…' : `${questions.length} question${questions.length === 1 ? '' : 's'} · ${totalMarks} marks total`}
            </span>
            <DangerButton onClick={() => setConfirmDeleteTest(true)}><IconTrash className="h-3.5 w-3.5" /> Delete Test</DangerButton>
          </div>
        </div>
      </Card>

      <Card title="Questions">
        <div className="space-y-2">
          {questions.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">No questions yet. Add the first one below.</p>
          )}
          {questions.map((q, i) => (
            <div key={q.id} className="flex items-start gap-3 rounded-xl bg-slate-800/70 p-3">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-300">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">{q.question_text || 'Untitled question'}</p>
                <p className="mt-0.5 text-xs text-slate-500">{QUESTION_TYPE_LABELS[q.question_type]} · {q.marks} mark{q.marks === 1 ? '' : 's'}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <button onClick={() => setEditingQuestion(q)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-indigo-400"><IconPencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => setDeleteQuestionTarget(q)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400"><IconTrash className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setEditingQuestion('new')}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-700 py-3 text-sm font-semibold text-slate-400 transition hover:border-indigo-500/50 hover:text-indigo-400"
        >
          <IconPlus className="h-4 w-4" /> Add Question
        </button>
      </Card>

      {editingQuestion && (
        <QuestionEditorDialog
          assessmentId={assessment.id}
          question={editingQuestion === 'new' ? null : editingQuestion}
          nextOrder={questions.length + 1}
          busy={savingQuestion}
          onSave={handleSaveQuestion}
          onCancel={() => setEditingQuestion(null)}
        />
      )}

      {deleteQuestionTarget && (
        <DeleteDialog
          title="Delete Question"
          name={deleteQuestionTarget.question_text || 'this question'}
          busy={deletingQuestion}
          onConfirm={handleDeleteQuestionConfirm}
          onCancel={() => setDeleteQuestionTarget(null)}
        />
      )}

      {confirmDeleteTest && (
        <DeleteDialog
          title="Delete Test"
          name={assessment.assessment_title || 'this test'}
          busy={deletingTest}
          onConfirm={handleDeleteTestConfirm}
          onCancel={() => setConfirmDeleteTest(false)}
        />
      )}

      {testToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 shadow-lg">{testToast}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Properties panel — right sidebar. Context-aware: shows real Module
// columns when a Module is selected, or real Lesson columns when an item
// is selected. "Mandatory" has no backend column anywhere, so it is kept
// as clearly-labelled, session-local state only (same treatment as
// Assignment/Quiz settings above).
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Common Lesson Settings — always visible below the primary (type-specific)
// editor, regardless of which lesson type is selected. Every field here
// reuses an existing, already-wired handler/state from the main component;
// nothing new is fetched, saved, or fabricated.
// ─────────────────────────────────────────────────────────────────────────────

function CommonSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-800 pt-5 first:border-t-0 first:pt-0">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {children}
    </div>
  );
}

function extractImageUrls(html: string): string[] {
  if (!html) return [];
  const matches = html.match(/<img[^>]+src=["']([^"']+)["']/gi) ?? [];
  return matches
    .map((tag) => {
      const srcMatch = tag.match(/src=["']([^"']+)["']/i);
      return srcMatch ? srcMatch[1] : '';
    })
    .filter((url) => url.length > 0);
}

function LessonCommonSettings({
  lesson, lessonModule, readingResource,
  uploadingThumbnail, uploadingReading,
  assignmentSettings, mandatory,
  onThumbnailUpload, onReadingUpload, onReadingLabelChange, onReadingRemove,
  onAssignmentChange, onMandatoryChange, onLessonChange,
}: {
  lesson: Lesson;
  lessonModule: Module | null;
  readingResource: Resource | null;
  uploadingThumbnail: boolean;
  uploadingReading: boolean;
  assignmentSettings: AssignmentSettings;
  mandatory: boolean;
  onThumbnailUpload: (file: File) => void;
  onReadingUpload: (file: File) => void;
  onReadingLabelChange: (label: string) => void;
  onReadingRemove: () => void;
  onAssignmentChange: (patch: Partial<AssignmentSettings>) => void;
  onMandatoryChange: (value: boolean) => void;
  onLessonChange: (patch: Partial<Lesson>) => void;
}) {
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const readingInputRef = useRef<HTMLInputElement>(null);
  // Single source of truth: images embedded in the lesson's own content —
  // the exact same field the Page Editor writes to and Preview renders
  // from. No separate resource-row model, so this can never drift out of
  // sync with what the editor or Preview actually show.
  const imageUrls = lesson.lesson_type === 'text' ? extractImageUrls(lesson.content) : [];

  return (
    <Card title="Common Lesson Settings">
      <div className="space-y-5">

        <CommonSection title="Thumbnail">
          {lessonModule ? (
            <div className="flex items-center gap-3">
              {lessonModule.thumbnail ? (
                <div className="relative h-16 w-24 flex-shrink-0">
                  <img
                    src={lessonModule.thumbnail}
                    alt=""
                    className="h-16 w-24 rounded-lg object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling;
                      if (fallback instanceof HTMLElement) fallback.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden absolute inset-0 flex h-16 w-24 items-center justify-center rounded-lg bg-slate-800 text-slate-600"><IconImage className="h-5 w-5" /></div>
                </div>
              ) : (
                <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-600"><IconImage className="h-5 w-5" /></div>
              )}
              <SecondaryButton onClick={() => thumbInputRef.current?.click()}>
                {uploadingThumbnail ? <Spinner className="h-3.5 w-3.5" /> : <IconUpload className="h-3.5 w-3.5" />} Replace
              </SecondaryButton>
              <input ref={thumbInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onThumbnailUpload(f); }} />
            </div>
          ) : (
            <p className="text-xs text-slate-600">No parent module resolved for this item.</p>
          )}
        </CommonSection>

        <CommonSection title="Reading Material">
          {readingResource ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg bg-slate-800 p-3">
                <IconAttachment className="h-5 w-5 flex-shrink-0 text-red-400" />
                <a href={readingResource.file_url} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-slate-200 hover:underline">
                  {readingResource.file_url.split('/').pop()}
                </a>
              </div>
              <input
                value={readingResource.resource_title}
                onChange={(e) => onReadingLabelChange(e.target.value)}
                placeholder="Download button label"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <div className="flex items-center gap-2">
                <SecondaryButton onClick={() => readingInputRef.current?.click()} className="flex-1">
                  {uploadingReading ? <Spinner className="h-3.5 w-3.5" /> : <IconUpload className="h-3.5 w-3.5" />} Replace
                </SecondaryButton>
                <DangerButton onClick={onReadingRemove}><IconTrash className="h-3.5 w-3.5" /> Delete</DangerButton>
              </div>
            </div>
          ) : (
            <SecondaryButton onClick={() => readingInputRef.current?.click()}>
              {uploadingReading ? <Spinner className="h-3.5 w-3.5" /> : <IconUpload className="h-3.5 w-3.5" />} Attach PDF
            </SecondaryButton>
          )}
          <input ref={readingInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onReadingUpload(f); }} />
        </CommonSection>

        <CommonSection title="Images">
          {imageUrls.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {imageUrls.map((url, i) => (<img key={`${url}-${i}`} src={url} alt="" className="h-14 w-full rounded-md object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />))}
            </div>
          ) : lesson.lesson_type === 'text' ? (
            <p className="text-xs text-slate-600">Images added in the Page Content editor appear here.</p>
          ) : (
            <p className="text-xs text-slate-600">Images are only supported on Page items.</p>
          )}
        </CommonSection>

        <CommonSection title="Assignment">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Marks</label>
              <input type="number" min={0} value={assignmentSettings.marks} onChange={(e) => onAssignmentChange({ marks: Number(e.target.value) })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-300">
              <input type="checkbox" checked={assignmentSettings.submissionRequired} onChange={(e) => onAssignmentChange({ submissionRequired: e.target.checked })} className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500" />
              Submission Required
            </label>
          </div>
        </CommonSection>

        <CommonSection title="Visibility">
          <div className="space-y-2">
            <ToggleRow label="Mandatory" on={mandatory} onChange={() => onMandatoryChange(!mandatory)} />
            <ToggleRow label="Visible" on={lesson.active} onChange={() => onLessonChange({ active: !lesson.active })} />
          </div>
        </CommonSection>

        <CommonSection title="Advanced">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Estimated Time (min)</label>
              <input
                key={`${lesson.id}-adv-dur`}
                type="number"
                min={0}
                defaultValue={lesson.duration_minutes}
                onBlur={(e) => onLessonChange({ duration_minutes: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-400">Release Order</label>
              <input
                key={`${lesson.id}-adv-order`}
                type="number"
                min={1}
                defaultValue={lesson.display_order}
                onBlur={(e) => onLessonChange({ display_order: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>
        </CommonSection>

      </div>
    </Card>
  );
}

type PropertyTab = 'general' | 'media' | 'visibility' | 'advanced';

const PROPERTY_TABS: { key: PropertyTab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'media', label: 'Media' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'advanced', label: 'Advanced' },
];

function PropertyTabBar({ active, onChange }: { active: PropertyTab; onChange: (tab: PropertyTab) => void }) {
  return (
    <div className="mb-4 flex gap-1 rounded-xl bg-slate-800/60 p-1">
      {PROPERTY_TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
            active === tab.key ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-800/70 px-3 py-2.5">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <button
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition ${on ? 'bg-indigo-500' : 'bg-slate-600'}`}
      >
        <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white transition ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function PropertyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-400">{label}</label>
      {children}
    </div>
  );
}

const PROPERTY_INPUT_CLS = 'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40';

function ModuleProperties({
  module: mod, uploadingThumbnail, onChange, onThumbnailUpload,
}: {
  module: Module;
  uploadingThumbnail: boolean;
  onChange: (patch: Partial<Module>) => void;
  onThumbnailUpload: (file: File) => void;
}) {
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<PropertyTab>('general');

  return (
    <div>
      <PropertyTabBar active={tab} onChange={setTab} />

      {tab === 'general' && (
        <div className="space-y-4">
          <PropertyField label="Title">
            <input
              key={mod.id}
              defaultValue={mod.module_name}
              onBlur={(e) => onChange({ module_name: e.target.value })}
              className={PROPERTY_INPUT_CLS}
            />
          </PropertyField>
          <PropertyField label="Description">
            <textarea
              key={`${mod.id}-desc`}
              defaultValue={mod.description}
              onBlur={(e) => onChange({ description: e.target.value })}
              rows={5}
              className={`${PROPERTY_INPUT_CLS} resize-none`}
            />
          </PropertyField>
        </div>
      )}

      {tab === 'media' && (
        <div className="space-y-4">
          <PropertyField label={'\u00A0'}>
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <IconImage className="h-3.5 w-3.5" /> Thumbnail
            </span>
            <div className="flex items-center gap-2">
              <input
                key={`${mod.id}-thumb`}
                defaultValue={mod.thumbnail}
                onBlur={(e) => onChange({ thumbnail: e.target.value })}
                placeholder="https://\u2026 or upload below"
                className={`min-w-0 flex-1 ${PROPERTY_INPUT_CLS}`}
              />
              <SecondaryButton onClick={() => thumbInputRef.current?.click()} className="flex-shrink-0 px-3">
                {uploadingThumbnail ? <Spinner className="h-3.5 w-3.5" /> : <IconUpload className="h-3.5 w-3.5" />}
              </SecondaryButton>
            </div>
            <input
              ref={thumbInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.gif"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onThumbnailUpload(f); }}
            />
            {mod.thumbnail && (
              <div className="relative mt-3 h-28 w-full">
                <img
                  src={mod.thumbnail}
                  alt=""
                  className="h-28 w-full rounded-lg object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling;
                    if (fallback instanceof HTMLElement) fallback.classList.remove('hidden');
                  }}
                />
                <div className="hidden absolute inset-0 flex h-28 w-full items-center justify-center rounded-lg bg-slate-800 text-slate-600"><IconImage className="h-6 w-6" /></div>
              </div>
            )}
          </PropertyField>
        </div>
      )}

      {tab === 'visibility' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-slate-800/70 px-3 py-2.5">
            <span className="text-sm font-medium text-slate-300">Status</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${mod.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
              {mod.active ? 'Published' : 'Draft'}
            </span>
          </div>
          <ToggleRow label="Visible" on={mod.active} onChange={() => onChange({ active: !mod.active })} />
        </div>
      )}

      {tab === 'advanced' && (
        <div className="grid grid-cols-2 gap-3">
          <PropertyField label="Duration (min)">
            <input
              key={`${mod.id}-dur`}
              type="number"
              min={0}
              defaultValue={mod.estimated_minutes}
              onBlur={(e) => onChange({ estimated_minutes: Number(e.target.value) })}
              className={PROPERTY_INPUT_CLS}
            />
          </PropertyField>
          <PropertyField label="Release Order">
            <input
              key={`${mod.id}-order`}
              type="number"
              min={1}
              defaultValue={mod.module_order}
              onBlur={(e) => onChange({ module_order: Number(e.target.value) })}
              className={PROPERTY_INPUT_CLS}
            />
          </PropertyField>
        </div>
      )}
    </div>
  );
}

function ItemProperties({
  lesson, mandatory, onLessonChange, onMandatoryChange,
}: {
  lesson: Lesson;
  mandatory: boolean;
  onLessonChange: (patch: Partial<Lesson>) => void;
  onMandatoryChange: (value: boolean) => void;
}) {
  const showDescription = lesson.lesson_type !== 'text';
  const [tab, setTab] = useState<PropertyTab>('general');

  return (
    <div>
      <PropertyTabBar active={tab} onChange={setTab} />

      {tab === 'general' && (
        <div className="space-y-4">
          <PropertyField label="Title">
            <input
              key={lesson.id}
              defaultValue={lesson.lesson_title}
              onBlur={(e) => onLessonChange({ lesson_title: e.target.value })}
              className={PROPERTY_INPUT_CLS}
            />
          </PropertyField>
          {showDescription ? (
            <PropertyField label="Description">
              <textarea
                key={`${lesson.id}-desc`}
                defaultValue={stripHtml(lesson.content)}
                onBlur={(e) => onLessonChange({ content: stripHtml(e.target.value) })}
                rows={5}
                placeholder="Short description shown to learners\u2026"
                className={`${PROPERTY_INPUT_CLS} resize-none`}
              />
            </PropertyField>
          ) : (
            <p className="text-xs text-slate-500">This is a text page \u2014 its content is authored in the Content Editor in the center panel.</p>
          )}
        </div>
      )}

      {tab === 'media' && (
        <div className="rounded-xl border border-dashed border-slate-700 px-3 py-6 text-center text-xs text-slate-500">
          {lesson.lesson_type === 'video' || lesson.lesson_type === 'document'
            ? 'Media for this item is managed in the center editor.'
            : 'This item type has no media attachment.'}
        </div>
      )}

      {tab === 'visibility' && (
        <div className="space-y-3">
          <ToggleRow label="Mandatory" on={mandatory} onChange={() => onMandatoryChange(!mandatory)} />
          <ToggleRow label="Visible" on={lesson.active} onChange={() => onLessonChange({ active: !lesson.active })} />
          <p className="text-xs text-slate-500">Mandatory is a session-only flag \u2014 no dedicated column exists for it yet.</p>
        </div>
      )}

      {tab === 'advanced' && (
        <div className="grid grid-cols-2 gap-3">
          <PropertyField label="Estimated Time (min)">
            <input
              key={`${lesson.id}-dur`}
              type="number"
              min={0}
              defaultValue={lesson.duration_minutes}
              onBlur={(e) => onLessonChange({ duration_minutes: Number(e.target.value) })}
              className={PROPERTY_INPUT_CLS}
            />
          </PropertyField>
          <PropertyField label="Release Order">
            <input
              key={`${lesson.id}-order`}
              type="number"
              min={1}
              defaultValue={lesson.display_order}
              onBlur={(e) => onLessonChange({ display_order: Number(e.target.value) })}
              className={PROPERTY_INPUT_CLS}
            />
          </PropertyField>
        </div>
      )}
    </div>
  );
}

function PropertiesPanel({
  selectedModule, selectedItem, mandatory, uploadingThumbnail, onModuleChange, onLessonChange, onMandatoryChange, onThumbnailUpload,
}: {
  selectedModule: Module | null;
  selectedItem:   Lesson | null;
  mandatory:      boolean;
  uploadingThumbnail: boolean;
  onModuleChange:    (patch: Partial<Module>) => void;
  onLessonChange:    (patch: Partial<Lesson>) => void;
  onMandatoryChange: (value: boolean) => void;
  onThumbnailUpload: (file: File) => void;
}) {
  return (
    <aside className="space-y-4 xl:sticky xl:top-24 xl:h-fit">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.4)]">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Properties</h3>
        {selectedModule && (
          <ModuleProperties
            key={selectedModule.id}
            module={selectedModule}
            uploadingThumbnail={uploadingThumbnail}
            onChange={onModuleChange}
            onThumbnailUpload={onThumbnailUpload}
          />
        )}
        {selectedItem && (
          <ItemProperties
            key={selectedItem.id}
            lesson={selectedItem}
            mandatory={mandatory}
            onLessonChange={onLessonChange}
            onMandatoryChange={onMandatoryChange}
          />
        )}
        {!selectedModule && !selectedItem && (
          <p className="text-sm text-slate-500">Select a module or item to edit its properties.</p>
        )}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main CourseBuilder
// ─────────────────────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saved';

function CourseBuilder() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(new Set());

  const [addingModule, setAddingModule] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [addMenuOpenFor, setAddMenuOpenFor] = useState<string | null>(null);
  const [savingModule, setSavingModule] = useState(false);
  const [duplicatingModuleId, setDuplicatingModuleId] = useState<string | null>(null);
  const [duplicatingPageId, setDuplicatingPageId] = useState<string | null>(null);

  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingModuleName, setEditingModuleName] = useState('');
  const [deleteModuleTarget, setDeleteModuleTarget] = useState<Module | null>(null);
  const [deletingModule, setDeletingModule] = useState(false);

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState('');
  const [deletePageTarget, setDeletePageTarget] = useState<Lesson | null>(null);
  const [deletingPage, setDeletingPage] = useState(false);

  const [activeLessonId, setActiveLessonId] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');

  const [resources, setResources] = useState<Resource[]>([]);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingReading, setUploadingReading] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const [assignmentSettingsById, setAssignmentSettingsById] = useState<Record<string, AssignmentSettings>>({});
  const [mandatoryById, setMandatoryById] = useState<Record<string, boolean>>({});

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [treeSearch, setTreeSearch] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Drag & drop reorder (modules + lessons, same-module and cross-module)
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);
  const [dragOverModuleId, setDragOverModuleId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ id: string; moduleId: string } | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // Undo-delete (10 second window before the real delete call fires)
  const pendingModuleDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLessonDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unsaved-changes protection
  const [isDirty, setIsDirty] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Workspace shell layout (pure UI state — persisted to localStorage
  // only; no business data, no service/database involvement) ───────────────
  const LAYOUT_KEY = 'sk:coursebuilder-layout';
  function readLayoutPrefs() {
    try {
      const raw = window.localStorage.getItem(LAYOUT_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  const initialLayout = readLayoutPrefs();
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(!!initialLayout.leftCollapsed);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(!!initialLayout.inspectorOpen);
  const [leftWidth, setLeftWidth] = useState<number>(typeof initialLayout.leftWidth === 'number' ? initialLayout.leftWidth : 320);
  const [rightWidth, setRightWidth] = useState<number>(typeof initialLayout.rightWidth === 'number' ? initialLayout.rightWidth : 360);
  const [isDragging, setIsDragging] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(LAYOUT_KEY, JSON.stringify({ leftCollapsed, inspectorOpen, leftWidth, rightWidth }));
    } catch {
      // ignore storage errors (private browsing, quota, etc.)
    }
  }, [leftCollapsed, inspectorOpen, leftWidth, rightWidth]);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) ?? null;
  const activeLesson = lessons.find((l) => l.id === activeLessonId) ?? null;
  const selectedModule = modules.find((m) => m.id === selectedModuleId) ?? null;
  const activeLessonModule = activeLesson ? modules.find((m) => m.id === activeLesson.module_id) ?? null : null;
  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setInspectorOpen((prev) => !prev);
        return;
      }
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (ctrlOrCmd && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSave();
        return;
      }
      if (ctrlOrCmd && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === 'Escape') {
        setAddMenuOpenFor(null);
        setPreviewOpen(false);
        setDeleteModuleTarget(null);
        setDeletePageTarget(null);
        return;
      }
      if (e.key === 'Delete' && !isTypingTarget(e.target)) {
        if (activeLesson) {
          setDeletePageTarget(activeLesson);
        } else if (selectedModule) {
          setDeleteModuleTarget(selectedModule);
        }
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLesson, selectedModule]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 1280 && !leftCollapsed) setLeftCollapsed(true);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    function handleMouseMove(e: MouseEvent) {
      if (isDragging === 'left') {
        setLeftWidth(Math.min(480, Math.max(200, e.clientX)));
      } else if (isDragging === 'right') {
        setRightWidth(Math.min(520, Math.max(280, window.innerWidth - e.clientX)));
      }
    }
    function handleMouseUp() {
      setIsDragging(null);
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const [undoToast, setUndoToast] = useState<{ message: string; onUndo: () => void } | null>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2200);
  }

  function showUndoToast(message: string, onUndo: () => void) {
    setUndoToast({ message, onUndo });
    setTimeout(() => setUndoToast((current) => (current?.message === message ? null : current)), 10000);
  }

  function fetchOutline() {
    setLoading(true);
    setError('');
    Promise.all([loadCourses(), loadModules(), loadLessons()])
      .then(([courseRows, moduleRows, lessonRows]) => {
        setCourses(courseRows);
        setModules(moduleRows);
        setLessons(lessonRows);
        setSelectedCourseId((prev) => prev || courseRows[0]?.id || '');
        setLastSavedAt(new Date());
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load course structure.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchOutline();

    function handleLessonsChanged() { fetchOutline(); }
    function handleFocusOrVisible() {
      if (document.visibilityState === 'hidden') return;
      fetchOutline();
    }
    window.addEventListener(LESSONS_CHANGED_EVENT, handleLessonsChanged);
    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    return () => {
      window.removeEventListener(LESSONS_CHANGED_EVENT, handleLessonsChanged);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  

  const courseModules = modules
    .filter((m) => m.course_id === selectedCourseId)
    .sort((a, b) => a.module_order - b.module_order);

  function lessonsForModule(moduleId: string): Lesson[] {
    return lessons.filter((l) => l.module_id === moduleId).sort((a, b) => a.display_order - b.display_order);
  }

  const searchTerm = treeSearch.trim().toLowerCase();

  function itemsMatchingSearch(moduleId: string): Lesson[] {
    const items = lessonsForModule(moduleId);
    if (!searchTerm) return items;
    return items.filter((i) => i.lesson_title.toLowerCase().includes(searchTerm));
  }

  const visibleModules = courseModules.filter((mod) => {
    if (!searchTerm) return true;
    const moduleMatches = mod.module_name.toLowerCase().includes(searchTerm);
    return moduleMatches || itemsMatchingSearch(mod.id).length > 0;
  });

  function expandAll() {
    setExpandedModuleIds(new Set(courseModules.map((m) => m.id)));
  }

  function collapseAll() {
    setExpandedModuleIds(new Set());
  }

  function moduleProgress(moduleId: string): { published: number; total: number } {
    const items = lessonsForModule(moduleId);
    return { published: items.filter((i) => i.active).length, total: items.length };
  }

  function toggleModuleExpanded(id: string) {
    setExpandedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function confirmDiscardIfDirty(): boolean {
    if (!isDirty) return true;
    const proceed = window.confirm('You have unsaved changes. Leave without saving?');
    if (proceed) setIsDirty(false);
    return proceed;
  }

  function selectModule(mod: Module) {
    if (!confirmDiscardIfDirty()) return;
    setSelectedModuleId(mod.id);
    setActiveLessonId('');
  }

  function selectItem(item: Lesson) {
    if (!confirmDiscardIfDirty()) return;
    setActiveLessonId(item.id);
    setSelectedModuleId('');
  }

  async function handleAddModule() {
    if (!newModuleName.trim() || !selectedCourseId) return;
    setSavingModule(true);
    try {
      const created = await createModule({
        course_id: selectedCourseId,
        module_code: `MOD-${Date.now().toString(36).toUpperCase()}`,
        module_name: newModuleName.trim(),
        description: '',
        module_order: courseModules.length + 1,
        estimated_minutes: 30,
        thumbnail: '',
        active: true,
      });
      setNewModuleName('');
      setAddingModule(false);
      setExpandedModuleIds((prev) => new Set(prev).add(created.id));
      fetchOutline();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create module.');
    } finally {
      setSavingModule(false);
    }
  }

  async function handleAddItem(moduleId: string, type: LessonType, label: string) {
    try {
      const created = await createLesson({
        module_id: moduleId,
        lesson_title: `Untitled ${label}`,
        lesson_type: type,
        content: '',
        video_url: '',
        duration_minutes: 0,
        display_order: lessonsForModule(moduleId).length + 1,
        downloadable: false,
        active: true,
      });
      fetchOutline();
      setActiveLessonId(created.id);
      setSelectedModuleId('');
      notifyLessonsChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Failed to create ${label.toLowerCase()}.`);
    }
  }

  function startRenameModule(mod: Module) {
    setEditingModuleId(mod.id);
    setEditingModuleName(mod.module_name);
  }

  async function commitRenameModule() {
    if (!editingModuleId || !editingModuleName.trim()) { setEditingModuleId(null); return; }
    const current = modules.find((m) => m.id === editingModuleId);
    if (!current) { setEditingModuleId(null); return; }
    try {
      await saveModule(editingModuleId, { ...toModuleForm(current), module_name: editingModuleName.trim() });
      setEditingModuleId(null);
      fetchOutline();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to rename module.');
    }
  }

  async function handleDeleteModuleConfirm() {
    if (!deleteModuleTarget) return;
    const target = deleteModuleTarget;
    setDeletingModule(true);
    setDeleteModuleTarget(null);
    if (lessonsForModule(target.id).some((p) => p.id === activeLessonId)) setActiveLessonId('');
    if (selectedModuleId === target.id) setSelectedModuleId('');
    setDeletingModule(false);
    showUndoToast(`"${target.module_name}" will be deleted`, () => {
      if (pendingModuleDeleteTimer.current) clearTimeout(pendingModuleDeleteTimer.current);
      pendingModuleDeleteTimer.current = null;
      showToast('Delete cancelled');
    });
    pendingModuleDeleteTimer.current = setTimeout(async () => {
      try {
        await removeModule(target.id);
        fetchOutline();
        notifyLessonsChanged();
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to delete module.');
      }
    }, 10000);
  }

  async function handleDuplicateModule(mod: Module) {
    setDuplicatingModuleId(mod.id);
    try {
      const created = await createModule({
        course_id: mod.course_id,
        module_code: `MOD-${Date.now().toString(36).toUpperCase()}`,
        module_name: `${mod.module_name} (Copy)`,
        description: mod.description,
        module_order: courseModules.length + 1,
        estimated_minutes: mod.estimated_minutes,
        thumbnail: mod.thumbnail,
        active: mod.active,
      });

      const sourceItems = lessonsForModule(mod.id);
      for (const item of sourceItems) {
        await createLesson({
          module_id: created.id,
          lesson_title: item.lesson_title,
          lesson_type: item.lesson_type,
          content: item.content,
          video_url: item.video_url,
          duration_minutes: item.duration_minutes,
          display_order: item.display_order,
          downloadable: item.downloadable,
          active: item.active,
        });
      }

      setExpandedModuleIds((prev) => new Set(prev).add(created.id));
      fetchOutline();
      notifyLessonsChanged();
      showToast('Module duplicated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to duplicate module.');
    } finally {
      setDuplicatingModuleId(null);
    }
  }

  async function moveModule(mod: Module, direction: 'up' | 'down') {
    const ordered = courseModules;
    const index = ordered.findIndex((m) => m.id === mod.id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    const target = ordered[targetIndex];
    try {
      await Promise.all([
        saveModule(mod.id, { ...toModuleForm(mod), module_order: target.module_order }),
        saveModule(target.id, { ...toModuleForm(target), module_order: mod.module_order }),
      ]);
      fetchOutline();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reorder modules.');
    }
  }

  function handleModuleDragStart(moduleId: string) {
    setDraggedModuleId(moduleId);
  }
  function handleModuleDragOver(e: React.DragEvent, moduleId: string) {
    e.preventDefault();
    if (draggedModuleId && draggedModuleId !== moduleId) setDragOverModuleId(moduleId);
  }
  async function handleModuleDrop(targetModuleId: string) {
    const sourceId = draggedModuleId;
    setDraggedModuleId(null);
    setDragOverModuleId(null);
    if (!sourceId || sourceId === targetModuleId) return;
    const ordered = [...courseModules];
    const fromIndex = ordered.findIndex((m) => m.id === sourceId);
    const toIndex = ordered.findIndex((m) => m.id === targetModuleId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, moved);
    try {
      await Promise.all(ordered.map((m, i) => saveModule(m.id, { ...toModuleForm(m), module_order: i + 1 })));
      fetchOutline();
      showToast('Modules reordered');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reorder modules.');
    }
  }

  function handleItemDragStart(itemId: string, moduleId: string) {
    setDraggedItem({ id: itemId, moduleId });
  }
  function handleItemDragOver(e: React.DragEvent, itemId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (draggedItem && draggedItem.id !== itemId) setDragOverItemId(itemId);
  }
  async function handleItemDrop(targetModuleId: string, targetItemId: string | null) {
    const source = draggedItem;
    setDraggedItem(null);
    setDragOverItemId(null);
    if (!source) return;
    const draggedLesson = lessons.find((l) => l.id === source.id);
    if (!draggedLesson) return;
    const targetItems = lessonsForModule(targetModuleId).filter((i) => i.id !== source.id);
    const insertAt = targetItemId ? targetItems.findIndex((i) => i.id === targetItemId) : targetItems.length;
    const reordered = [...targetItems];
    reordered.splice(insertAt < 0 ? reordered.length : insertAt, 0, draggedLesson);
    try {
      await Promise.all(reordered.map((item, i) => updateLesson(item.id, { module_id: targetModuleId, display_order: i + 1 })));
      fetchOutline();
      notifyLessonsChanged();
      showToast(source.moduleId === targetModuleId ? 'Item reordered' : 'Item moved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reorder item.');
    }
  }

  async function handleModulePropertiesChange(patch: Partial<Module>) {
    if (!selectedModule) return;
    try {
      await saveModule(selectedModule.id, { ...toModuleForm(selectedModule), ...patch });
      fetchOutline();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update module.');
    }
  }

  async function handleThumbnailUpload(file: File) {
    if (!selectedModule) return;
    setUploadingThumbnail(true);
    try {
      const result = await uploadImage(file);
      await saveModule(selectedModule.id, { ...toModuleForm(selectedModule), thumbnail: result.url });
      fetchOutline();
      showToast('Thumbnail updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Thumbnail upload failed.');
    } finally {
      setUploadingThumbnail(false);
    }
  }

  async function handleLessonModuleThumbnailUpload(file: File) {
    if (!activeLessonModule) return;
    setUploadingThumbnail(true);
    try {
      const result = await uploadImage(file);
      await saveModule(activeLessonModule.id, { ...toModuleForm(activeLessonModule), thumbnail: result.url });
      fetchOutline();
      showToast('Thumbnail updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Thumbnail upload failed.');
    } finally {
      setUploadingThumbnail(false);
    }
  }

  function startRenamePage(page: Lesson) {
    setEditingPageId(page.id);
    setEditingPageName(page.lesson_title);
  }

  async function commitRenamePage() {
    if (!editingPageId || !editingPageName.trim()) { setEditingPageId(null); return; }
    try {
      await updateLesson(editingPageId, { lesson_title: editingPageName.trim() });
      setEditingPageId(null);
      fetchOutline();
      notifyLessonsChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to rename item.');
    }
  }

  async function handleDeletePageConfirm() {
    if (!deletePageTarget) return;
    const target = deletePageTarget;
    setDeletingPage(true);
    setDeletePageTarget(null);
    if (activeLessonId === target.id) setActiveLessonId('');
    setDeletingPage(false);
    showUndoToast(`"${target.lesson_title || 'Untitled'}" will be deleted`, () => {
      if (pendingLessonDeleteTimer.current) clearTimeout(pendingLessonDeleteTimer.current);
      pendingLessonDeleteTimer.current = null;
      showToast('Delete cancelled');
    });
    pendingLessonDeleteTimer.current = setTimeout(async () => {
      try {
        await deleteLesson(target.id);
        fetchOutline();
        notifyLessonsChanged();
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to delete item.');
      }
    }, 10000);
  }

  async function handleDuplicatePage(moduleId: string, page: Lesson) {
    setDuplicatingPageId(page.id);
    try {
      const created = await createLesson({
        module_id: moduleId,
        lesson_title: `${page.lesson_title} (Copy)`,
        lesson_type: page.lesson_type,
        content: page.content,
        video_url: page.video_url,
        duration_minutes: page.duration_minutes,
        display_order: lessonsForModule(moduleId).length + 1,
        downloadable: page.downloadable,
        active: page.active,
      });
      fetchOutline();
      setActiveLessonId(created.id);
      setSelectedModuleId('');
      notifyLessonsChanged();
      showToast('Item duplicated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to duplicate item.');
    } finally {
      setDuplicatingPageId(null);
    }
  }

  async function movePage(moduleId: string, page: Lesson, direction: 'up' | 'down') {
    const ordered = lessonsForModule(moduleId);
    const index = ordered.findIndex((p) => p.id === page.id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;
    const target = ordered[targetIndex];
    try {
      await Promise.all([
        updateLesson(page.id, { display_order: target.display_order }),
        updateLesson(target.id, { display_order: page.display_order }),
      ]);
      fetchOutline();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reorder items.');
    }
  }

  async function handleItemPropertiesChange(patch: Partial<Lesson>) {
    if (!activeLesson) return;
    try {
      await updateLesson(activeLesson.id, patch);
      fetchOutline();
      notifyLessonsChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update item.');
    }
  }

  function getMandatory(lessonId: string): boolean {
    return mandatoryById[lessonId] ?? false;
  }

  function setMandatory(lessonId: string, value: boolean) {
    setMandatoryById((prev) => ({ ...prev, [lessonId]: value }));
  }

  // ── Reading Material resource for the active page (existing resourceService) ─

  function fetchResources() {
    if (!activeLessonId) { setResources([]); return; }
    loadResources()
      .then((all) => setResources(all.filter((r) => r.lesson_id === activeLessonId)))
      .catch(() => {});
  }

  useEffect(() => {
    fetchResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLessonId]);

  const readingResource = resources.find((r) => r.resource_type === 'pdf') ?? null;

  async function handleReadingUpload(file: File) {
    setUploadingReading(true);
    try {
      const result = await uploadDocument(file);
      const sizeLabel = formatFileSize(file.size);
      if (readingResource) {
        await saveResource(readingResource.id, {
          lesson_id: readingResource.lesson_id,
          resource_title: readingResource.resource_title,
          resource_type: readingResource.resource_type,
          file_url: result.url,
          description: sizeLabel,
          display_order: readingResource.display_order,
          downloadable: readingResource.downloadable,
          active: readingResource.active,
        });
      } else {
        await createResource({
          lesson_id: activeLessonId,
          resource_title: 'Download Reading Material',
          resource_type: 'pdf',
          file_url: result.url,
          description: sizeLabel,
          display_order: 1,
          downloadable: true,
          active: true,
        });
      }
      fetchResources();
      showToast('Reading material updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingReading(false);
    }
  }

  async function handleReadingLabelChange(label: string) {
    if (!readingResource) return;
    setResources((prev) => prev.map((r) => (r.id === readingResource.id ? { ...r, resource_title: label } : r)));
    try {
      await saveResource(readingResource.id, {
        lesson_id: readingResource.lesson_id,
        resource_title: label,
        resource_type: readingResource.resource_type,
        file_url: readingResource.file_url,
        description: readingResource.description,
        display_order: readingResource.display_order,
        downloadable: readingResource.downloadable,
        active: readingResource.active,
      });
    } catch {
      // best-effort; next fetchResources() resyncs if this failed
    }
  }

  async function handleReadingRemove() {
    if (!readingResource) return;
    try {
      await removeResource(readingResource.id);
      fetchResources();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove file.');
    }
  }

  // ── Video (lesson.video_url via the existing updateLesson + uploadVideo) ──

  async function handleVideoUpload(file: File) {
    if (!activeLesson) return;
    setUploadingVideo(true);
    try {
      const result = await uploadVideo(file);
      await updateLesson(activeLesson.id, { video_url: result.url });
      fetchOutline();
      showToast('Video uploaded');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Video upload failed.');
    } finally {
      setUploadingVideo(false);
    }
  }

  async function handleVideoUrlChange(url: string) {
    if (!activeLesson) return;
    try {
      await updateLesson(activeLesson.id, { video_url: url });
      fetchOutline();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save video URL.');
    }
  }

  async function handleVideoDurationChange(minutes: number) {
    if (!activeLesson) return;
    try {
      await updateLesson(activeLesson.id, { duration_minutes: minutes });
      fetchOutline();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save duration.');
    }
  }

  // ── Assignment — temporary local UI state only (no backend table) ──────────

  function getAssignmentSettings(lessonId: string): AssignmentSettings {
    return assignmentSettingsById[lessonId] ?? DEFAULT_ASSIGNMENT;
  }

  function updateAssignmentSettings(lessonId: string, patch: Partial<AssignmentSettings>) {
    setAssignmentSettingsById((prev) => ({
      ...prev,
      [lessonId]: { ...getAssignmentSettings(lessonId), ...patch },
    }));
  }

  // ── Publish / Preview ────────────────────────────────────────────────────────

  async function handlePublishToggle() {
    if (!activeLesson) return;
    try {
      await updateLesson(activeLesson.id, { active: !activeLesson.active });
      fetchOutline();
      notifyLessonsChanged();
      showToast(activeLesson.active ? 'Unpublished' : 'Published');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update publish state.');
    }
  }

  async function handlePreview() {
    if (!activeLessonId || !activeLesson) return;
    if (activeLesson.lesson_type !== 'text') {
      showToast('Preview is available for Page items.');
      return;
    }
    setPreviewLoading(true);
    try {
      const data = await loadLessonContent(activeLessonId);
      setPreviewHtml(data.content);
      setPreviewOpen(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load preview.');
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleSave() {
    setSaveStatus('saved');
    setIsDirty(false);
    showToast('Saved');
    setTimeout(() => setSaveStatus('idle'), 1500);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen rounded-2xl bg-slate-950">

      {/* TOP TOOLBAR */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-slate-800 bg-slate-900/95 px-6 py-3 backdrop-blur">
        <div className="min-w-0">
          {courses.length > 1 ? (
            <select
              value={selectedCourseId}
              onChange={(e) => { setSelectedCourseId(e.target.value); setExpandedModuleIds(new Set()); setActiveLessonId(''); setSelectedModuleId(''); }}
              className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-lg font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              {courses.map((c) => (<option key={c.id} value={c.id}>{c.course_name}</option>))}
            </select>
          ) : (
            <p className="truncate text-lg font-bold text-slate-100">{selectedCourse?.course_name || 'Course Builder'}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {selectedCourse && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${selectedCourse.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                Course: {selectedCourse.active ? 'Published' : 'Draft'}
              </span>
            )}
            {activeLesson && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${activeLesson.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                {activeLesson.active ? 'Published' : 'Draft'}
              </span>
            )}
            {saveStatus === 'saved' && <span className="text-emerald-400">Auto Saved</span>}
            {lastSavedAt && (
              <span className="text-slate-500">
                Last saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton onClick={handlePreview} disabled={!activeLessonId || previewLoading}>
            {previewLoading ? <Spinner className="h-3.5 w-3.5" /> : <IconEye className="h-4 w-4" />} Preview
          </SecondaryButton>
          {activeLesson && (
            <AccentButton onClick={handlePublishToggle}>{activeLesson.active ? 'Unpublish' : 'Publish'}</AccentButton>
          )}
          <PrimaryButton onClick={handleSave} disabled={!activeLessonId}>
            <IconSave className="h-4 w-4" /> Save Draft
          </PrimaryButton>
        </div>
      </div>

      <div className="relative flex items-start gap-0 p-6">

        {/* LEFT PANEL — Course Structure */}
        <aside
          style={{ width: leftCollapsed ? 56 : leftWidth }}
          className={`flex-shrink-0 rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.4)] lg:sticky lg:top-24 lg:h-fit ${isDragging === 'left' ? '' : 'transition-[width] duration-300 ease-in-out'}`}
        >
          <div className="flex items-center gap-1 border-b border-slate-800 p-2">
            <button
              onClick={() => setLeftCollapsed((v) => !v)}
              title={leftCollapsed ? 'Expand Course Structure' : 'Collapse Course Structure'}
              className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-indigo-400"
            >
              <IconPanelLeft className="h-4 w-4" />
            </button>
            {!leftCollapsed && (
              <>
                <p className="truncate text-sm font-bold text-slate-100">Course Structure</p>
                <div className="ml-auto flex flex-shrink-0 items-center gap-1">
                  <button
                    onClick={expandAll}
                    title="Expand All"
                    className="rounded-lg px-1.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-800 hover:text-indigo-400"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={collapseAll}
                    title="Collapse All"
                    className="rounded-lg px-1.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-800 hover:text-indigo-400"
                  >
                    Collapse All
                  </button>
                </div>
              </>
            )}
          </div>

          {leftCollapsed ? (
            <div className="flex flex-col items-center gap-2 p-2">
              {visibleModules.map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => { setLeftCollapsed(false); selectModule(mod); }}
                  title={mod.module_name}
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold transition ${selectedModuleId === mod.id ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-indigo-300'}`}
                >
                  {mod.module_name.slice(0, 2).toUpperCase()}
                </button>
              ))}
            </div>
          ) : (
          <div className="p-4 pt-3">

          <div className="relative mb-3">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </span>
            <input
              ref={searchInputRef}
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              placeholder="Search modules & items\u2026"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 py-1.5 pl-8 pr-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          {loading && <p className="px-1 text-xs text-slate-500">Loading course structure\u2026</p>}
          {error && <p className="px-1 text-xs text-red-600">{error}</p>}

          {!loading && !error && (
            <div className="space-y-1">
              {visibleModules.map((mod, modIndex) => {
                const isExpanded = searchTerm ? true : expandedModuleIds.has(mod.id);
                const items = itemsMatchingSearch(mod.id);
                const isEditingModule = editingModuleId === mod.id;
                const progress = moduleProgress(mod.id);
                const isModuleSelected = selectedModuleId === mod.id;
                return (
                  <div key={mod.id} className={`rounded-xl transition ${isModuleSelected ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : ''}`}>
                    <div
                      draggable
                      onDragStart={() => handleModuleDragStart(mod.id)}
                      onDragOver={(e) => handleModuleDragOver(e, mod.id)}
                      onDragLeave={() => setDragOverModuleId((current) => (current === mod.id ? null : current))}
                      onDrop={() => handleModuleDrop(mod.id)}
                      className={`group flex items-center gap-1 rounded-xl px-1 py-1.5 hover:bg-slate-800/60 ${dragOverModuleId === mod.id ? 'ring-2 ring-indigo-500/60' : ''}`}
                    >
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveModule(mod, 'up')}
                          disabled={modIndex === 0}
                          aria-label="Move module up"
                          className="text-slate-600 transition hover:text-indigo-400 disabled:opacity-30"
                        >
                          <IconArrowUp />
                        </button>
                        <button
                          onClick={() => moveModule(mod, 'down')}
                          disabled={modIndex === visibleModules.length - 1}
                          aria-label="Move module down"
                          className="text-slate-600 transition hover:text-indigo-400 disabled:opacity-30"
                        >
                          <IconArrowDown />
                        </button>
                      </div>

                      <button
                        onClick={() => toggleModuleExpanded(mod.id)}
                        aria-label={isExpanded ? 'Collapse module' : 'Expand module'}
                        className="flex-shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-800"
                      >
                        {isExpanded ? <IconChevronDown className="h-3.5 w-3.5" /> : <IconChevronRight className="h-3.5 w-3.5" />}
                      </button>

                      <button
                        onClick={() => selectModule(mod)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left"
                      >
                        {isEditingModule ? (
                          <input
                            autoFocus
                            value={editingModuleName}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditingModuleName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitRenameModule(); if (e.key === 'Escape') setEditingModuleId(null); }}
                            onBlur={commitRenameModule}
                            className="min-w-0 flex-1 rounded-md bg-slate-800 px-1.5 py-0.5 text-sm text-slate-100 ring-1 ring-indigo-500 focus:outline-none"
                          />
                        ) : (
                          <span className={`truncate text-sm font-semibold ${isModuleSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                            {mod.module_name}
                          </span>
                        )}
                        {!isEditingModule && progress.total > 0 && (
                          <span className="flex-shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                            {progress.published}/{progress.total}
                          </span>
                        )}
                      </button>

                      {!isEditingModule && (
                        <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                          <button onClick={() => startRenameModule(mod)} title="Rename Module" className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-indigo-400">
                            <IconPencil />
                          </button>
                          <button
                            onClick={() => handleDuplicateModule(mod)}
                            title="Duplicate Module"
                            disabled={duplicatingModuleId === mod.id}
                            className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-indigo-400 disabled:opacity-50"
                          >
                            {duplicatingModuleId === mod.id ? <Spinner className="h-3.5 w-3.5" /> : <IconDuplicate />}
                          </button>
                          <button onClick={() => setDeleteModuleTarget(mod)} title="Delete Module" className="rounded-md p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="ml-4 space-y-0.5 border-l border-slate-800 pl-3 pb-2">
                        {items.map((item, itemIndex) => {
                          const isEditingItem = editingPageId === item.id;
                          const isItemSelected = activeLessonId === item.id;
                          return (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={(e) => { e.stopPropagation(); handleItemDragStart(item.id, mod.id); }}
                              onDragOver={(e) => handleItemDragOver(e, item.id)}
                              onDragLeave={() => setDragOverItemId((current) => (current === item.id ? null : current))}
                              onDrop={(e) => { e.stopPropagation(); handleItemDrop(mod.id, item.id); }}
                              className={`group flex items-center gap-1 rounded-lg ${isItemSelected ? 'bg-indigo-500/10' : ''} ${dragOverItemId === item.id ? 'ring-2 ring-indigo-500/60' : ''}`}
                            >
                              <div className="flex flex-col">
                                <button
                                  onClick={() => movePage(mod.id, item, 'up')}
                                  disabled={itemIndex === 0}
                                  aria-label="Move item up"
                                  className="text-slate-600 transition hover:text-indigo-400 disabled:opacity-30"
                                >
                                  <IconArrowUp className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => movePage(mod.id, item, 'down')}
                                  disabled={itemIndex === items.length - 1}
                                  aria-label="Move item down"
                                  className="text-slate-600 transition hover:text-indigo-400 disabled:opacity-30"
                                >
                                  <IconArrowDown className="h-3 w-3" />
                                </button>
                              </div>
                              <button
                                onClick={() => selectItem(item)}
                                className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm transition ${
                                  isItemSelected ? 'font-medium text-indigo-300' : 'text-slate-400'
                                }`}
                              >
                                <PageTypeIcon type={item.lesson_type} className="h-3.5 w-3.5 flex-shrink-0" />
                                {isEditingItem ? (
                                  <input
                                    autoFocus
                                    value={editingPageName}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => setEditingPageName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') commitRenamePage(); if (e.key === 'Escape') setEditingPageId(null); }}
                                    onBlur={commitRenamePage}
                                    className="min-w-0 flex-1 rounded-md bg-slate-800 px-1.5 py-0.5 text-sm text-slate-100 ring-1 ring-indigo-500 focus:outline-none"
                                  />
                                ) : (
                                  <span className="truncate">{item.lesson_title || pageTypeLabel(item.lesson_type)}</span>
                                )}
                              </button>
                              {!isEditingItem && (
                                <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                                  <button onClick={() => startRenamePage(item)} title="Rename" className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-indigo-400">
                                    <IconPencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDuplicatePage(mod.id, item)}
                                    title="Duplicate"
                                    disabled={duplicatingPageId === item.id}
                                    className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-indigo-400 disabled:opacity-50"
                                  >
                                    {duplicatingPageId === item.id ? <Spinner className="h-3 w-3" /> : <IconDuplicate className="h-3 w-3" />}
                                  </button>
                                  <button onClick={() => setDeletePageTarget(item)} title="Delete" className="rounded-md p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
                                    <IconTrash className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        <div
                          onDragOver={(e) => { if (draggedItem) e.preventDefault(); }}
                          onDrop={() => handleItemDrop(mod.id, null)}
                          className="h-2"
                        />
                        <div className="relative pt-1">
                          <button
                            onClick={() => setAddMenuOpenFor(addMenuOpenFor === mod.id ? null : mod.id)}
                            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-indigo-400 hover:bg-slate-800"
                          >
                            <IconPlus className="h-3.5 w-3.5" /> Add
                          </button>
                          {addMenuOpenFor === mod.id && (
                            <>
                              <div className="fixed inset-0 z-20" onClick={() => setAddMenuOpenFor(null)} />
                              <div className="absolute left-0 top-full z-30 mt-1 w-48 space-y-0.5 rounded-xl border border-slate-700 bg-slate-800 p-1.5 shadow-xl">
                                <button onClick={() => { handleAddItem(mod.id, 'text', 'Page'); setAddMenuOpenFor(null); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-indigo-300">
                                  <IconPage className="h-3.5 w-3.5" /> Page
                                </button>
                                <button onClick={() => { handleAddItem(mod.id, 'video', 'Video'); setAddMenuOpenFor(null); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-indigo-300">
                                  <IconVideo className="h-3.5 w-3.5" /> Video
                                </button>
                                <button onClick={() => { handleAddItem(mod.id, 'document', 'Reading Material'); setAddMenuOpenFor(null); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-indigo-300">
                                  <IconAttachment className="h-3.5 w-3.5" /> Reading Material
                                </button>
                                <button onClick={() => { handleAddItem(mod.id, 'assignment', 'Assignment'); setAddMenuOpenFor(null); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-indigo-300">
                                  <IconAssignment className="h-3.5 w-3.5" /> Assignment
                                </button>
                                <button onClick={() => { handleAddItem(mod.id, 'quiz', 'Quiz'); setAddMenuOpenFor(null); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-indigo-300">
                                  <IconQuiz className="h-3.5 w-3.5" /> Quiz
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {!addingModule ? (
                <button
                  onClick={() => setAddingModule(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-indigo-400 hover:bg-indigo-500/10"
                >
                  <IconPlus /> Add Module
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-1 pt-1">
                  <input
                    autoFocus
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddModule(); if (e.key === 'Escape') setAddingModule(false); }}
                    placeholder="Module name…"
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                  <button onClick={handleAddModule} disabled={savingModule} className="rounded-lg bg-indigo-500 p-1.5 text-white disabled:opacity-50">
                    {savingModule ? <Spinner className="h-3.5 w-3.5" /> : <IconPlus className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => setAddingModule(false)} className="rounded-lg bg-slate-800 p-1.5 text-slate-400">
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
          </div>
          )}
        </aside>

        {!leftCollapsed && (
          <div
            onMouseDown={() => setIsDragging('left')}
            className="mx-1 hidden w-1 flex-shrink-0 cursor-col-resize self-stretch rounded-full transition hover:bg-indigo-500/40 lg:block"
          />
        )}

        {/* CENTER — type-specific panel */}
        <main className="min-w-0 flex-1 mt-7">
          {(selectedModule || activeLesson) && (
            <nav className="mb-4 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="truncate text-slate-400">{selectedCourse?.course_name ?? 'Course'}</span>
              {(activeLessonModule || selectedModule) && (
                <>
                  <IconChevronRight className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate text-slate-400">{(activeLessonModule ?? selectedModule)?.module_name}</span>
                </>
              )}
              {activeLesson && (
                <>
                  <IconChevronRight className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate font-semibold text-slate-200">{activeLesson.lesson_title || 'Untitled'}</span>
                </>
              )}
            </nav>
          )}

          {!activeLessonId && !selectedModuleId && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 px-6 py-14 text-center shadow-[0_2px_16px_-4px_rgba(0,0,0,0.4)]">
              <p className="text-sm text-slate-500">Select an item from Course Structure to start editing.</p>
            </div>
          )}

          {selectedModuleId && !activeLessonId && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 px-6 py-14 text-center shadow-[0_2px_16px_-4px_rgba(0,0,0,0.4)]">
              <p className="text-sm text-slate-500">Edit this module's properties on the right, or select an item inside it.</p>
            </div>
          )}

          {activeLessonId && activeLesson?.lesson_type === 'text' && (
            <PageEditorPanel key={activeLessonId} lessonId={activeLessonId} onDirtyChange={setIsDirty} />
          )}

          {activeLessonId && activeLesson?.lesson_type === 'video' && (
            <VideoEditorPanel
              lesson={activeLesson}
              uploading={uploadingVideo}
              onUrlChange={handleVideoUrlChange}
              onUpload={handleVideoUpload}
              onDurationChange={handleVideoDurationChange}
            />
          )}

          {activeLessonId && activeLesson?.lesson_type === 'document' && (
            <ReadingMaterialPanel
              resource={readingResource}
              uploading={uploadingReading}
              onUpload={handleReadingUpload}
              onLabelChange={handleReadingLabelChange}
              onRemove={handleReadingRemove}
            />
          )}

          {activeLessonId && activeLesson?.lesson_type === 'assignment' && (
            <AssignmentPanel
              settings={getAssignmentSettings(activeLessonId)}
              onChange={(patch) => updateAssignmentSettings(activeLessonId, patch)}
            />
          )}

          {activeLessonId && activeLesson?.lesson_type === 'quiz' && (
            <TestEditorPanel key={activeLessonId} lessonId={activeLessonId} />
          )}

          {activeLessonId && activeLesson &&
            !['text', 'video', 'document', 'assignment', 'quiz'].includes(activeLesson.lesson_type) && (
              <PageEditorPanel key={activeLessonId} lessonId={activeLessonId} onDirtyChange={setIsDirty} />
          )}

          {activeLessonId && activeLesson && (
            <div className="mt-6">
              <LessonCommonSettings
                lesson={activeLesson}
                lessonModule={activeLessonModule}
                readingResource={readingResource}
                uploadingThumbnail={uploadingThumbnail}
                uploadingReading={uploadingReading}
                assignmentSettings={getAssignmentSettings(activeLessonId)}
                mandatory={getMandatory(activeLessonId)}
                onThumbnailUpload={handleLessonModuleThumbnailUpload}
                onReadingUpload={handleReadingUpload}
                onReadingLabelChange={handleReadingLabelChange}
                onReadingRemove={handleReadingRemove}
                onAssignmentChange={(patch) => updateAssignmentSettings(activeLessonId, patch)}
                onMandatoryChange={(value) => setMandatory(activeLessonId, value)}
                onLessonChange={handleItemPropertiesChange}
              />
            </div>
          )}
        </main>

        {/* RIGHT PANEL — Properties (slide-in Inspector, closed by default) */}
        {inspectorOpen && (selectedModule || activeLesson) && (
          <div
            onMouseDown={() => setIsDragging('right')}
            className="mx-1 hidden w-1 flex-shrink-0 cursor-col-resize self-stretch rounded-full transition hover:bg-indigo-500/40 xl:block"
          />
        )}
        {inspectorOpen && (selectedModule || activeLesson) && (
          <div
            style={{ width: rightWidth }}
            className={`flex-shrink-0 ${isDragging === 'right' ? '' : 'transition-[width] duration-300 ease-in-out'}`}
          >
            <PropertiesPanel
              selectedModule={selectedModuleId ? selectedModule : null}
              selectedItem={activeLessonId ? activeLesson : null}
              mandatory={activeLessonId ? getMandatory(activeLessonId) : false}
              uploadingThumbnail={uploadingThumbnail}
              onModuleChange={handleModulePropertiesChange}
              onLessonChange={handleItemPropertiesChange}
              onMandatoryChange={(value) => activeLessonId && setMandatory(activeLessonId, value)}
              onThumbnailUpload={handleThumbnailUpload}
            />
          </div>
        )}

        {!inspectorOpen && (selectedModule || activeLesson) && (
          <button
            onClick={() => setInspectorOpen(true)}
            title="Open Properties (Alt+P)"
            className="fixed right-0 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-xl border border-r-0 border-slate-800 bg-slate-900 px-2 py-3 text-slate-400 shadow-lg transition hover:bg-slate-800 hover:text-indigo-400"
          >
            <IconSlidersHorizontal className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl]">Properties</span>
          </button>
        )}

        {inspectorOpen && (selectedModule || activeLesson) && (
          <button
            onClick={() => setInspectorOpen(false)}
            title="Close Properties (Alt+P)"
            className="absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-l-xl border border-r-0 border-slate-800 bg-slate-900 p-2 text-slate-400 shadow-lg transition hover:bg-slate-800 hover:text-indigo-400"
            style={{ marginRight: rightWidth }}
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {deleteModuleTarget && (
        <DeleteDialog
          title="Delete Module"
          name={deleteModuleTarget.module_name}
          busy={deletingModule}
          onConfirm={handleDeleteModuleConfirm}
          onCancel={() => setDeleteModuleTarget(null)}
        />
      )}

      {deletePageTarget && (
        <DeleteDialog
          title={`Delete ${pageTypeLabel(deletePageTarget.lesson_type)}`}
          name={deletePageTarget.lesson_title || 'Untitled'}
          busy={deletingPage}
          onConfirm={handleDeletePageConfirm}
          onCancel={() => setDeletePageTarget(null)}
        />
      )}

      {previewOpen && (
        <PreviewDialog html={previewHtml} onClose={() => setPreviewOpen(false)} />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 shadow-lg">
          {toast}
        </div>
      )}

      {undoToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 shadow-lg">
          <span>{undoToast.message}</span>
          <button
            onClick={() => { undoToast.onUndo(); setUndoToast(null); }}
            className="rounded-lg bg-indigo-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-400"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

export default CourseBuilder;