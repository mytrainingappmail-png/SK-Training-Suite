// src/components/admin/contenteditor/ContentEditor.tsx
//
// Course Authoring Workspace — full UI/UX replacement only.
//
// Nothing under the hood changed: this file still calls exactly the same
// repository-backed services it always did —
//   contentEditorService  (loadLessonContent / saveLessonContent /
//                           uploadImage / uploadVideo / uploadDocument)
//   lessonBuilderService  (loadLessons / createLesson / updateLesson /
//                           deleteLesson)   — "Pages" in the outline are
//                           existing `lessons` rows; lesson_type drives the
//                           icon (page/video/reading/assignment/quiz)
//   moduleService          (loadModules / createModule)
//   courseService          (loadCourses)
//   resourceService        (loadResources / createResource / saveResource /
//                           removeResource) — existing `learning_resources`
//                           rows power the Thumbnail, Reading Material and
//                           Images cards (distinguished by resource_type and
//                           a `description` marker, both existing columns)
//
// Assignment marks/submission-required, Quiz linkage/passing%/attempts/
// timer, and Visibility targeting have no dedicated columns anywhere in
// the schema, and no repository/service/database change was permitted for
// this task. They are stored as a small JSON metadata block prepended to
// the *same* `lessons.content` string (a hidden <script> tag, stripped
// before the content is shown in the editor and re-attached on save) —
// still just the existing `content` column, still saved through the exact
// same saveLessonContent() call. This keeps every one of those fields
// fully real, editable and persisted without inventing any new storage.

import { useCallback, useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG only — no external icon package)
// ─────────────────────────────────────────────────────────────────────────────

function IconChevronDown({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>);
}
function IconChevronRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>);
}
function IconPage({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>);
}
function IconVideo({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5 19.5 7.5v9l-3.75-3M4.5 6.75h9a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5v-7.5a1.5 1.5 0 0 1 1.5-1.5Z" /></svg>);
}
function IconImage({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M8.25 6.75h.008v.008H8.25V6.75Z" /></svg>);
}
function IconAssignment({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" /></svg>);
}
function IconQuiz({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 17.25h.008v.008H12v-.008Z" /></svg>);
}
function IconPlus({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>);
}
function IconTrash({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>);
}
function IconUpload({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>);
}
function IconDownload({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>);
}
function IconRefresh({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>);
}
function IconEye({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>);
}
function IconSave({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>);
}
function IconCheckCircle({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>);
}
function IconClock({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>);
}
function IconUsers({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>);
}
function IconLoader({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}
function IconX({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>);
}

import {
  loadLessonContent,
  saveLessonContent,
  uploadImage,
  uploadVideo,
  uploadDocument,
} from '../../../services/contentEditor/contentEditorService';
import {
  loadLessons,
  createLesson,
  updateLesson,
} from '../../../services/lessonBuilder/lessonBuilderService';
import { loadModules, createModule } from '../../../services/module/moduleService';
import { loadCourses } from '../../../services/course/courseService';
import {
  loadResources,
  createResource,
  saveResource,
  removeResource,
} from '../../../services/resource/resourceService';

import type { Lesson, LessonType } from '../../../types/lessonBuilder';
import type { Module } from '../../../types/module';
import type { Course } from '../../../types/course';
import type { Resource } from '../../../types/resource';

// ─────────────────────────────────────────────────────────────────────────────
// Cross-component authoring sync (unchanged mechanism)
// ─────────────────────────────────────────────────────────────────────────────

const LESSONS_CHANGED_EVENT = 'sk:lessons-changed';

function notifyLessonsChanged() {
  window.dispatchEvent(new CustomEvent(LESSONS_CHANGED_EVENT));
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ContentEditorProps {
  lessonId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const AUTOSAVE_DELAY_MS = 1500;
const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif';
const VIDEO_ACCEPT = '.mp4';
const PDF_ACCEPT = '.pdf';

const VISIBILITY_OPTIONS = ['Freshers', 'Experienced', 'Managers', 'HR', 'Trainer', 'Individual Employees'];

const THUMBNAIL_MARKER = '__thumbnail__';

interface CaretRangeFromPoint {
  caretRangeFromPoint?(x: number, y: number): Range | null;
}
interface CaretPositionFromPoint {
  caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null;
}

function PageIcon({ type, className }: { type: LessonType; className?: string }) {
  if (type === 'video') return <IconVideo className={className} />;
  if (type === 'assignment') return <IconAssignment className={className} />;
  if (type === 'quiz') return <IconQuiz className={className} />;
  return <IconPage className={className} />;
}

function pageTypeLabel(type: LessonType): string {
  if (type === 'video') return 'Video';
  if (type === 'assignment') return 'Assignment';
  if (type === 'quiz') return 'Quiz';
  if (type === 'document') return 'Reading Material';
  return 'Page';
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata block — Assignment / Quiz / Visibility, embedded in `content`
// ─────────────────────────────────────────────────────────────────────────────

interface LessonMeta {
  marks:               number;
  submissionRequired:  boolean;
  quizName:            string;
  passingPercent:      number;
  attempts:            number;
  timerMinutes:        number;
  visibility:          string[];
}

const DEFAULT_META: LessonMeta = {
  marks: 0,
  submissionRequired: false,
  quizName: '',
  passingPercent: 60,
  attempts: 1,
  timerMinutes: 0,
  visibility: [],
};

const META_RE = /^<script type="application\/json" data-sk-meta="1">([\s\S]*?)<\/script>/;

function extractMeta(html: string): { meta: LessonMeta; body: string } {
  const match = html.match(META_RE);
  if (!match) return { meta: { ...DEFAULT_META }, body: html };
  try {
    const parsed = JSON.parse(match[1]);
    return { meta: { ...DEFAULT_META, ...parsed }, body: html.slice(match[0].length) };
  } catch {
    return { meta: { ...DEFAULT_META }, body: html.slice(match[0].length) };
  }
}

function embedMeta(meta: LessonMeta, body: string): string {
  return `<script type="application/json" data-sk-meta="1">${JSON.stringify(meta)}</script>${body}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function youtubeEmbedId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Design primitives
// ─────────────────────────────────────────────────────────────────────────────

function Card({ title, icon, children, className = '' }: { title?: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] ${className}`}>
      {title && (
        <div className="mb-4 flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

function PrimaryButton({
  onClick, disabled, children, className = '',
}: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

function AccentButton({
  onClick, disabled, children, className = '',
}: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  onClick, disabled, children, className = '',
}: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

function DangerButton({
  onClick, disabled, children, className = '',
}: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <IconLoader className={className} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ContentEditor — Course Authoring Workspace
// ─────────────────────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved' | 'error';

function ContentEditor({ lessonId }: ContentEditorProps) {
  // ── Outline data (Course → Module → Pages) ──────────────────────────────────
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [outlineLoading, setOutlineLoading] = useState(true);
  const [outlineError, setOutlineError] = useState('');

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(new Set());
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [savingModule, setSavingModule] = useState(false);

  const [activeLessonId, setActiveLessonId] = useState(lessonId ?? '');

  // ── Active page content ─────────────────────────────────────────────────────
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  const [meta, setMeta] = useState<LessonMeta>({ ...DEFAULT_META });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError,  setSaveError]  = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [toast, setToast] = useState('');

  const [canUndo, setCanUndo] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});

  // ── Resources for the active page ──────────────────────────────────────────
  const [resources, setResources] = useState<Resource[]>([]);
  const [uploadingKind, setUploadingKind] = useState<'thumbnail' | 'reading' | 'gallery' | 'video' | null>(null);

  const editorRef       = useRef<HTMLDivElement>(null);
  const initializedRef  = useRef(false);
  const pendingBodyRef  = useRef('');
  const savedRangeRef   = useRef<Range | null>(null);
  const autosaveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const readingInputRef   = useRef<HTMLInputElement>(null);
  const galleryInputRef   = useRef<HTMLInputElement>(null);
  const videoInputRef     = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }

  // ── Load outline (courses / modules / lessons) — existing services only ────

  function fetchOutline() {
    setOutlineLoading(true);
    setOutlineError('');
    Promise.all([loadCourses(), loadModules(), loadLessons()])
      .then(([courseRows, moduleRows, lessonRows]) => {
        setCourses(courseRows);
        setModules(moduleRows);
        setLessons(lessonRows);
        setSelectedCourseId((prev) => prev || courseRows[0]?.id || '');
      })
      .catch((err: unknown) => {
        setOutlineError(err instanceof Error ? err.message : 'Failed to load course outline.');
      })
      .finally(() => setOutlineLoading(false));
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

  useEffect(() => {
    if (lessonId) setActiveLessonId(lessonId);
  }, [lessonId]);

  const activeLesson = lessons.find((l) => l.id === activeLessonId) ?? null;

  const courseModules = modules
    .filter((m) => m.course_id === selectedCourseId)
    .sort((a, b) => a.module_order - b.module_order);

  function lessonsForModule(moduleId: string): Lesson[] {
    return lessons.filter((l) => l.module_id === moduleId).sort((a, b) => a.display_order - b.display_order);
  }

  function toggleModuleExpanded(id: string) {
    setExpandedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleAddModule() {
    if (!newModuleName.trim() || !selectedCourseId) return;
    setSavingModule(true);
    try {
      const order = courseModules.length + 1;
      const created = await createModule({
        course_id: selectedCourseId,
        module_code: `MOD-${Date.now().toString(36).toUpperCase()}`,
        module_name: newModuleName.trim(),
        description: '',
        module_order: order,
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

  async function handleAddPage(moduleId: string) {
    try {
      const siblingCount = lessonsForModule(moduleId).length;
      const created = await createLesson({
        module_id: moduleId,
        lesson_title: 'Untitled Page',
        lesson_type: 'text',
        content: '',
        video_url: '',
        duration_minutes: 0,
        display_order: siblingCount + 1,
        downloadable: false,
        active: true,
      });
      fetchOutline();
      setActiveLessonId(created.id);
      notifyLessonsChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create page.');
    }
  }

  // ── Legacy placeholder cleanup (unchanged behaviour from before) ──────────

  function stripPlaceholderMarkup(html: string): string {
    return html.replace(
      /<div[^>]*data-media-placeholder="[^"]*"[^>]*>[\s\S]*?<\/div>\s*(<p><\/p>)?/g,
      ''
    );
  }

  // ── Load active page content ────────────────────────────────────────────────

  useEffect(() => {
    initializedRef.current = false;
    setPageTitle(activeLesson?.lesson_title ?? '');

    if (!activeLessonId) {
      setLoading(false);
      setLoadError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError('');

    loadLessonContent(activeLessonId)
      .then((data) => {
        if (cancelled) return;
        setPageTitle(data.lessonTitle);
        const clean = stripPlaceholderMarkup(data.content);
        const { meta: parsedMeta, body } = extractMeta(clean);
        setMeta(parsedMeta);
        pendingBodyRef.current = body;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load page content.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLessonId]);

  useEffect(() => {
    if (!loading && !loadError && editorRef.current && !initializedRef.current) {
      editorRef.current.innerHTML = pendingBodyRef.current;
      initializedRef.current = true;
      updateToolbarState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadError]);

  // ── Resources for the active page (existing resourceService only) ─────────

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

  const thumbnailResource = resources.find((r) => r.resource_type === 'image' && r.description === THUMBNAIL_MARKER) ?? null;
  const galleryImages     = resources.filter((r) => r.resource_type === 'image' && r.description !== THUMBNAIL_MARKER);
  const readingMaterial   = resources.find((r) => r.resource_type === 'pdf') ?? null;

  // ── Toolbar state ────────────────────────────────────────────────────────────

  function updateToolbarState() {
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      });
    } catch { /* ignore */ }
    try {
      setCanUndo(document.queryCommandEnabled('undo'));
    } catch { /* ignore */ }
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      const range = sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  }

  function restoreSelection() {
    if (!savedRangeRef.current) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
  }

  useEffect(() => {
    function handleSelectionChange() {
      const sel = document.getSelection();
      const anchor = sel?.anchorNode ?? null;
      if (editorRef.current && anchor && editorRef.current.contains(anchor)) {
        updateToolbarState();
        saveSelection();
      }
    }
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // ── Save (content + metadata via saveLessonContent; title/duration/video
  //    via the existing updateLesson — all pre-existing calls) ───────────────

  const doSave = useCallback(
    async (auto: boolean) => {
      if (!activeLessonId || !editorRef.current) return;
      setSaveStatus('saving');
      setSaveError('');
      try {
        const bodyHtml = stripPlaceholderMarkup(editorRef.current.innerHTML);
        const combined = embedMeta(meta, bodyHtml);
        await saveLessonContent(activeLessonId, combined);
        if (activeLesson && pageTitle.trim() && pageTitle !== activeLesson.lesson_title) {
          await updateLesson(activeLessonId, { lesson_title: pageTitle.trim() });
          fetchOutline();
        }
        setSaveStatus('saved');
      } catch (err) {
        setSaveStatus('error');
        setSaveError(err instanceof Error ? err.message : 'Failed to save.');
      }
      if (!auto) showToast('Saved');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeLessonId, meta, pageTitle]
  );

  function scheduleAutosave() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => doSave(true), AUTOSAVE_DELAY_MS);
  }

  function handleManualSave() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    doSave(false);
  }

  function handleInput() {
    setSaveStatus('unsaved');
    updateToolbarState();
    saveSelection();
    scheduleAutosave();
  }

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function handleTitleChange(value: string) {
    setPageTitle(value);
    setSaveStatus('unsaved');
    scheduleAutosave();
  }

  function updateMeta(patch: Partial<LessonMeta>) {
    setMeta((prev) => ({ ...prev, ...patch }));
    setSaveStatus('unsaved');
    scheduleAutosave();
  }

  function toggleVisibility(option: string) {
    setMeta((prev) => {
      const has = prev.visibility.includes(option);
      return { ...prev, visibility: has ? prev.visibility.filter((v) => v !== option) : [...prev.visibility, option] };
    });
    setSaveStatus('unsaved');
    scheduleAutosave();
  }

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

  // ── Formatting commands ─────────────────────────────────────────────────────

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, value);
    saveSelection();
    handleInput();
  }

  function insertHtml(html: string) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand('insertHTML', false, html);
    saveSelection();
    handleInput();
  }

  function handleEditorKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const isMod = e.ctrlKey || e.metaKey;
    if (!isMod) return;
    const key = e.key.toLowerCase();
    if (key === 'b') { e.preventDefault(); exec('bold'); }
    else if (key === 'i') { e.preventDefault(); exec('italic'); }
    else if (key === 'u') { e.preventDefault(); exec('underline'); }
    else if (key === 's') { e.preventDefault(); handleManualSave(); }
  }

  function handleInsertLink() {
    const url = window.prompt('Enter URL:', 'https://');
    if (!url) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) exec('createLink', url);
    else insertHtml(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
  }

  function setCaretFromPoint(x: number, y: number) {
    const doc = document as Document & CaretRangeFromPoint & CaretPositionFromPoint;
    let range: Range | null = null;
    if (typeof doc.caretRangeFromPoint === 'function') {
      range = doc.caretRangeFromPoint(x, y);
    } else if (typeof doc.caretPositionFromPoint === 'function') {
      const pos = doc.caretPositionFromPoint(x, y);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    if (range && editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      savedRangeRef.current = range.cloneRange();
    }
  }

  function handleEditorDragOver(e: React.DragEvent<HTMLDivElement>) { e.preventDefault(); }

  function handleEditorDrop(e: React.DragEvent<HTMLDivElement>) {
    const file = e.dataTransfer.files[0];
    if (!file) return;
    e.preventDefault();
    setCaretFromPoint(e.clientX, e.clientY);
    if (file.type.startsWith('image/')) void handleGalleryUpload(file);
  }

  function handleEditorPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    e.preventDefault();
    saveSelection();
    void handleGalleryUpload(file);
  }

  // ── Thumbnail (single image resource, description marked as thumbnail) ────

  async function handleThumbnailUpload(file: File) {
    setUploadingKind('thumbnail');
    try {
      const result = await uploadImage(file);
      if (thumbnailResource) {
        await saveResource(thumbnailResource.id, {
          lesson_id: thumbnailResource.lesson_id,
          resource_title: thumbnailResource.resource_title,
          resource_type: thumbnailResource.resource_type,
          file_url: result.url,
          description: thumbnailResource.description,
          display_order: thumbnailResource.display_order,
          downloadable: thumbnailResource.downloadable,
          active: thumbnailResource.active,
        });
      } else {
        await createResource({
          lesson_id: activeLessonId,
          resource_title: 'Thumbnail',
          resource_type: 'image',
          file_url: result.url,
          description: THUMBNAIL_MARKER,
          display_order: 1,
          downloadable: false,
          active: true,
        });
      }
      fetchResources();
      showToast('Thumbnail updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Thumbnail upload failed');
    } finally {
      setUploadingKind(null);
    }
  }

  async function handleThumbnailRemove() {
    if (!thumbnailResource) return;
    try {
      await removeResource(thumbnailResource.id);
      fetchResources();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove thumbnail.');
    }
  }

  // ── Reading Material (single PDF resource; resource_title doubles as the
  //    trainer-editable download button label; description stores the
  //    formatted file size) ───────────────────────────────────────────────────

  async function handleReadingUpload(file: File) {
    setUploadingKind('reading');
    try {
      const result = await uploadDocument(file);
      const sizeLabel = formatFileSize(file.size);
      if (readingMaterial) {
        await saveResource(readingMaterial.id, {
          lesson_id: readingMaterial.lesson_id,
          resource_title: readingMaterial.resource_title,
          resource_type: readingMaterial.resource_type,
          file_url: result.url,
          description: sizeLabel,
          display_order: readingMaterial.display_order,
          downloadable: readingMaterial.downloadable,
          active: readingMaterial.active,
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
      showToast(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingKind(null);
    }
  }

  async function handleReadingLabelChange(label: string) {
    if (!readingMaterial) return;
    setResources((prev) => prev.map((r) => (r.id === readingMaterial.id ? { ...r, resource_title: label } : r)));
    try {
      await saveResource(readingMaterial.id, {
        lesson_id: readingMaterial.lesson_id,
        resource_title: label,
        resource_type: readingMaterial.resource_type,
        file_url: readingMaterial.file_url,
        description: readingMaterial.description,
        display_order: readingMaterial.display_order,
        downloadable: readingMaterial.downloadable,
        active: readingMaterial.active,
      });
    } catch {
      // best-effort; next fetchResources() will resync if this failed
    }
  }

  async function handleReadingRemove() {
    if (!readingMaterial) return;
    try {
      await removeResource(readingMaterial.id);
      fetchResources();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove file.');
    }
  }

  // ── Images gallery (unlimited image resources) ─────────────────────────────

  async function handleGalleryUpload(file: File) {
    setUploadingKind('gallery');
    try {
      const result = await uploadImage(file);
      await createResource({
        lesson_id: activeLessonId,
        resource_title: file.name,
        resource_type: 'image',
        file_url: result.url,
        description: '',
        display_order: galleryImages.length + 1,
        downloadable: false,
        active: true,
      });
      fetchResources();
      showToast('Image added');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setUploadingKind(null);
    }
  }

  async function handleGalleryReplace(resourceId: string, file: File) {
    setUploadingKind('gallery');
    try {
      const result = await uploadImage(file);
      const existing = resources.find((r) => r.id === resourceId);
      if (existing) {
        await saveResource(resourceId, {
          lesson_id: existing.lesson_id,
          resource_title: existing.resource_title,
          resource_type: existing.resource_type,
          file_url: result.url,
          description: existing.description,
          display_order: existing.display_order,
          downloadable: existing.downloadable,
          active: existing.active,
        });
      }
      fetchResources();
      showToast('Image replaced');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setUploadingKind(null);
    }
  }

  async function handleGalleryRemove(resourceId: string) {
    try {
      await removeResource(resourceId);
      fetchResources();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove image.');
    }
  }

  // ── Video (lesson.video_url — YouTube URL pasted directly, or an uploaded
  //    MP4 saved through the existing uploadVideo() + updateLesson()) ────────

  async function handleVideoUpload(file: File) {
    if (!activeLesson) return;
    setUploadingKind('video');
    try {
      const result = await uploadVideo(file);
      await updateLesson(activeLesson.id, { video_url: result.url });
      fetchOutline();
      showToast('Video uploaded');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Video upload failed');
    } finally {
      setUploadingKind(null);
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

  // ── Preview ──────────────────────────────────────────────────────────────────

  function togglePreview() {
    if (!previewMode) setPreviewHtml(editorRef.current?.innerHTML ?? '');
    setPreviewMode((p) => !p);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const statusLabel: Record<SaveStatus, string> = {
    idle: '', saving: 'Saving…', saved: 'All changes saved', unsaved: 'Unsaved changes', error: saveError || 'Failed to save',
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) ?? null;

  return (
    <div className="min-h-screen rounded-2xl bg-slate-50">

      {/* TOP HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-slate-100 bg-white px-6 py-4">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-slate-900">{selectedCourse?.course_name || 'Course Authoring'}</p>
          <p className={`text-xs ${saveStatus === 'error' ? 'text-red-600' : saveStatus === 'unsaved' ? 'text-orange-600' : 'text-emerald-600'}`}>
            {saveStatus === 'saved' && <IconCheckCircle className="mr-1 inline h-3.5 w-3.5" />}
            {statusLabel[saveStatus]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton onClick={togglePreview}>
            <IconEye className="h-4 w-4" /> {previewMode ? 'Edit' : 'Preview'}
          </SecondaryButton>
          {activeLesson && (
            <AccentButton onClick={handlePublishToggle}>
              {activeLesson.active ? 'Unpublish' : 'Publish'}
            </AccentButton>
          )}
          <PrimaryButton onClick={handleManualSave} disabled={saveStatus === 'saving' || !activeLessonId}>
            {saveStatus === 'saving' ? <Spinner /> : <IconSave className="h-4 w-4" />} Save
          </PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_360px]">

        {/* LEFT SIDEBAR — Course Outline */}
        <aside className="rounded-2xl bg-white p-4 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] lg:sticky lg:top-24 lg:h-fit">
          <p className="mb-3 px-1 text-sm font-bold text-slate-800">Course Outline</p>

          {courses.length > 1 && (
            <select
              value={selectedCourseId}
              onChange={(e) => { setSelectedCourseId(e.target.value); setExpandedModuleIds(new Set()); }}
              className="mb-3 w-full rounded-lg bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            >
              {courses.map((c) => (<option key={c.id} value={c.id}>{c.course_name}</option>))}
            </select>
          )}

          {outlineLoading && <p className="px-1 text-xs text-slate-400">Loading outline…</p>}
          {outlineError && <p className="px-1 text-xs text-red-600">{outlineError}</p>}

          {!outlineLoading && !outlineError && (
            <div className="space-y-1">
              {courseModules.map((mod) => {
                const isExpanded = expandedModuleIds.has(mod.id);
                const pages = lessonsForModule(mod.id);
                return (
                  <div key={mod.id}>
                    <button
                      onClick={() => toggleModuleExpanded(mod.id)}
                      className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {isExpanded ? <IconChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" /> : <IconChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />}
                      <span className="truncate">{mod.module_name}</span>
                    </button>

                    {isExpanded && (
                      <div className="ml-4 space-y-0.5 border-l border-slate-100 pl-3">
                        {pages.map((page) => (
                          <button
                            key={page.id}
                            onClick={() => setActiveLessonId(page.id)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                              activeLessonId === page.id ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <PageIcon type={page.lesson_type} className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{page.lesson_title || pageTypeLabel(page.lesson_type)}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => handleAddPage(mod.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-indigo-600"
                        >
                          <IconPlus className="h-3.5 w-3.5" /> Add Page
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {!addingModule ? (
                <button
                  onClick={() => setAddingModule(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  <IconPlus className="h-4 w-4" /> Add Module
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-1 pt-1">
                  <input
                    autoFocus
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddModule(); if (e.key === 'Escape') setAddingModule(false); }}
                    placeholder="Module name…"
                    className="min-w-0 flex-1 rounded-lg bg-slate-50 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                  <button onClick={handleAddModule} disabled={savingModule} className="rounded-lg bg-indigo-600 p-1.5 text-white disabled:opacity-50">
                    {savingModule ? <Spinner className="h-3.5 w-3.5" /> : <IconPlus className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => setAddingModule(false)} className="rounded-lg bg-slate-100 p-1.5 text-slate-500">
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* CENTER — editing workspace */}
        <main className="min-w-0">
          {!activeLessonId && (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-24 text-center shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
              <IconPage className="mb-4 h-16 w-16 text-slate-200" />
              <p className="text-sm text-slate-400">Select a page from the Course Outline to start writing.</p>
            </div>
          )}

          {activeLessonId && loading && (
            <div className="space-y-4">
              <div className="h-14 animate-pulse rounded-2xl bg-white shadow-sm" />
              <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm" />
            </div>
          )}

          {activeLessonId && !loading && loadError && (
            <div className="rounded-2xl bg-red-50 p-6 text-sm text-red-700 shadow-sm">{loadError}</div>
          )}

          {activeLessonId && !loading && !loadError && (
            <div className="rounded-2xl bg-white p-8 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">

              {activeLesson && (
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-500">
                  <PageIcon type={activeLesson.lesson_type} className="h-3.5 w-3.5" />
                  {pageTypeLabel(activeLesson.lesson_type)}
                </div>
              )}

              <input
                value={pageTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Untitled page"
                className="mb-6 w-full border-none bg-transparent text-3xl font-bold text-slate-900 outline-none placeholder:text-slate-300"
              />

              {!previewMode ? (
                <>
                  {/* Slim formatting toolbar */}
                  <div className="mb-4 flex flex-wrap items-center gap-1 rounded-xl bg-slate-50 p-1.5">
                    <button onMouseDown={(e) => { e.preventDefault(); exec('undo'); }} disabled={!canUndo} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:shadow-sm disabled:opacity-30">
                      <IconRefresh className="h-4 w-4 -scale-x-100" />
                    </button>
                    <select
                      onChange={(e) => exec('formatBlock', e.target.value)}
                      defaultValue="<p>"
                      className="h-8 rounded-lg bg-white px-2 text-xs text-slate-700 shadow-sm"
                    >
                      <option value="<p>">Text</option>
                      <option value="<h1>">Heading 1</option>
                      <option value="<h2>">Heading 2</option>
                      <option value="<h3>">Heading 3</option>
                      <option value="<blockquote>">Quote</option>
                    </select>
                    <span className="mx-1 h-6 w-px bg-slate-200" />
                    <button onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} className={`rounded-lg px-2.5 py-1.5 text-sm font-bold ${activeFormats.bold ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}>B</button>
                    <button onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} className={`rounded-lg px-2.5 py-1.5 text-sm italic ${activeFormats.italic ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}>I</button>
                    <button onMouseDown={(e) => { e.preventDefault(); exec('underline'); }} className={`rounded-lg px-2.5 py-1.5 text-sm underline ${activeFormats.underline ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}>U</button>
                    <span className="mx-1 h-6 w-px bg-slate-200" />
                    <button onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }} className={`rounded-lg px-2.5 py-1.5 text-sm ${activeFormats.insertUnorderedList ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}>• List</button>
                    <button onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }} className={`rounded-lg px-2.5 py-1.5 text-sm ${activeFormats.insertOrderedList ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-white hover:shadow-sm'}`}>1. List</button>
                    <span className="mx-1 h-6 w-px bg-slate-200" />
                    <button onMouseDown={(e) => { e.preventDefault(); handleInsertLink(); }} className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-white hover:shadow-sm">Link</button>
                  </div>

                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onKeyDown={handleEditorKeyDown}
                    onKeyUp={() => { updateToolbarState(); saveSelection(); }}
                    onMouseUp={() => { updateToolbarState(); saveSelection(); }}
                    onPaste={handleEditorPaste}
                    onDragOver={handleEditorDragOver}
                    onDrop={handleEditorDrop}
                    className="prose prose-slate min-h-[420px] max-w-none text-[15px] leading-relaxed outline-none"
                  />
                </>
              ) : (
                <div className="prose prose-slate min-h-[420px] max-w-none text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              )}
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR */}
        {activeLessonId && !loading && !loadError && (
          <aside className="space-y-5 lg:col-span-2 xl:col-span-1 xl:col-start-3">

            {/* Card 1 — Thumbnail */}
            <Card title="Thumbnail" icon={<IconImage className="h-4 w-4 text-indigo-500" />}>
              {thumbnailResource ? (
                <div>
                  <img src={thumbnailResource.file_url} alt="Thumbnail" className="mb-3 h-40 w-full rounded-xl object-cover" />
                  <div className="flex gap-2">
                    <SecondaryButton onClick={() => thumbnailInputRef.current?.click()} className="flex-1 text-xs">
                      {uploadingKind === 'thumbnail' ? <Spinner className="h-3.5 w-3.5" /> : <IconRefresh className="h-3.5 w-3.5" />} Replace
                    </SecondaryButton>
                    <DangerButton onClick={handleThumbnailRemove} className="flex-1 text-xs">
                      <IconTrash className="h-3.5 w-3.5" /> Delete
                    </DangerButton>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => thumbnailInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-10 text-slate-400 transition hover:border-indigo-300 hover:text-indigo-500"
                >
                  {uploadingKind === 'thumbnail' ? <Spinner className="h-6 w-6" /> : <IconUpload className="h-6 w-6" />}
                  <span className="text-xs font-semibold">Upload Thumbnail</span>
                </button>
              )}
              <input ref={thumbnailInputRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleThumbnailUpload(f); }} />
            </Card>

            {/* Card 2 — Reading Material */}
            <Card title="Reading Material" icon={<IconPage className="h-4 w-4 text-red-500" />}>
              {readingMaterial ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-50">
                      <IconPage className="h-5 w-5 text-red-500" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <a href={readingMaterial.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-800 hover:underline">
                        {readingMaterial.file_url.split('/').pop()}
                        <IconDownload className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      </a>
                      <p className="text-xs text-slate-400">{readingMaterial.description}</p>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Button Label</label>
                    <input
                      value={readingMaterial.resource_title}
                      onChange={(e) => handleReadingLabelChange(e.target.value)}
                      placeholder="e.g. Download Brochure"
                      className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                    />
                  </div>
                  <div className="flex gap-2">
                    <SecondaryButton onClick={() => readingInputRef.current?.click()} className="flex-1 text-xs">
                      {uploadingKind === 'reading' ? <Spinner className="h-3.5 w-3.5" /> : <IconRefresh className="h-3.5 w-3.5" />} Replace
                    </SecondaryButton>
                    <DangerButton onClick={handleReadingRemove} className="flex-1 text-xs">
                      <IconTrash className="h-3.5 w-3.5" /> Delete
                    </DangerButton>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => readingInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-10 text-slate-400 transition hover:border-indigo-300 hover:text-indigo-500"
                >
                  {uploadingKind === 'reading' ? <Spinner className="h-6 w-6" /> : <IconUpload className="h-6 w-6" />}
                  <span className="text-xs font-semibold">Attach PDF</span>
                </button>
              )}
              <input ref={readingInputRef} type="file" accept={PDF_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleReadingUpload(f); }} />
            </Card>

            {/* Card 3 — Images gallery */}
            <Card title="Images" icon={<IconImage className="h-4 w-4 text-emerald-500" />}>
              {galleryImages.length > 0 && (
                <div className="mb-3 grid grid-cols-2 gap-2">
                  {galleryImages.map((img) => (
                    <div key={img.id} className="group relative overflow-hidden rounded-xl bg-slate-50">
                      <img src={img.file_url} alt={img.resource_title} className="h-24 w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-slate-900/0 opacity-0 transition group-hover:bg-slate-900/40 group-hover:opacity-100">
                        <label className="cursor-pointer rounded-lg bg-white p-1.5 shadow-sm">
                          <IconRefresh className="h-3.5 w-3.5 text-slate-700" />
                          <input type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleGalleryReplace(img.id, f); }} />
                        </label>
                        <button onClick={() => handleGalleryRemove(img.id)} className="rounded-lg bg-white p-1.5 shadow-sm">
                          <IconTrash className="h-3.5 w-3.5 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <SecondaryButton onClick={() => galleryInputRef.current?.click()} className="w-full text-xs">
                {uploadingKind === 'gallery' ? <Spinner className="h-3.5 w-3.5" /> : <IconUpload className="h-3.5 w-3.5" />} Upload Image
              </SecondaryButton>
              <input ref={galleryInputRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleGalleryUpload(f); }} />
            </Card>

            {/* Card 4 — Video */}
            <Card title="Video" icon={<IconVideo className="h-4 w-4 text-blue-500" />}>
              {activeLesson?.video_url ? (
                <div className="mb-3 overflow-hidden rounded-xl bg-black">
                  {youtubeEmbedId(activeLesson.video_url) ? (
                    <iframe
                      className="aspect-video w-full"
                      src={`https://www.youtube.com/embed/${youtubeEmbedId(activeLesson.video_url)}`}
                      title="Video preview"
                      allowFullScreen
                    />
                  ) : (
                    <video controls className="aspect-video w-full" src={activeLesson.video_url} />
                  )}
                </div>
              ) : (
                <div className="mb-3 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-10 text-slate-300">
                  <IconVideo className="h-8 w-8" />
                </div>
              )}
              <input
                defaultValue={activeLesson?.video_url ?? ''}
                onBlur={(e) => handleVideoUrlChange(e.target.value)}
                placeholder="Paste YouTube URL…"
                className="mb-2 w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
              <SecondaryButton onClick={() => videoInputRef.current?.click()} className="w-full text-xs">
                {uploadingKind === 'video' ? <Spinner className="h-3.5 w-3.5" /> : <IconUpload className="h-3.5 w-3.5" />} Upload Video
              </SecondaryButton>
              <input ref={videoInputRef} type="file" accept={VIDEO_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleVideoUpload(f); }} />
            </Card>

            {/* Card 5 — Assignment */}
            <Card title="Assignment" icon={<IconAssignment className="h-4 w-4 text-purple-500" />}>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Marks</label>
                  <input
                    type="number"
                    min={0}
                    value={meta.marks}
                    onChange={(e) => updateMeta({ marks: Number(e.target.value) })}
                    className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={meta.submissionRequired}
                    onChange={(e) => updateMeta({ submissionRequired: e.target.checked })}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400"
                  />
                  Submission Required
                </label>
                <p className="text-xs text-slate-400">Assignment name and instructions are written directly on the page.</p>
              </div>
            </Card>

            {/* Card 6 — Quiz */}
            <Card title="Quiz" icon={<IconQuiz className="h-4 w-4 text-amber-500" />}>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Linked Quiz</label>
                  <input
                    value={meta.quizName}
                    onChange={(e) => updateMeta({ quizName: e.target.value })}
                    placeholder="Quiz name…"
                    className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Pass %</label>
                    <input type="number" min={0} max={100} value={meta.passingPercent} onChange={(e) => updateMeta({ passingPercent: Number(e.target.value) })} className="w-full rounded-lg bg-slate-50 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Attempts</label>
                    <input type="number" min={1} value={meta.attempts} onChange={(e) => updateMeta({ attempts: Number(e.target.value) })} className="w-full rounded-lg bg-slate-50 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Timer (min)</label>
                    <input type="number" min={0} value={meta.timerMinutes} onChange={(e) => updateMeta({ timerMinutes: Number(e.target.value) })} className="w-full rounded-lg bg-slate-50 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
                  </div>
                </div>
              </div>
            </Card>

            {/* Card 7 — Visibility */}
            <Card title="Visibility" icon={<IconUsers className="h-4 w-4 text-blue-500" />}>
              <div className="space-y-2">
                {VISIBILITY_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={meta.visibility.includes(option)}
                      onChange={() => toggleVisibility(option)}
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </Card>

            {/* Card 8 — Estimated Reading Time */}
            <Card title="Estimated Reading Time" icon={<IconClock className="h-4 w-4 text-slate-400" />}>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  defaultValue={activeLesson?.duration_minutes ?? 0}
                  onBlur={(e) => activeLesson && updateLesson(activeLesson.id, { duration_minutes: Number(e.target.value) }).then(fetchOutline)}
                  className="w-24 rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
                <span className="text-sm text-slate-500">minutes</span>
              </div>
            </Card>

          </aside>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default ContentEditor;