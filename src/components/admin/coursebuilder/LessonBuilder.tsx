// src/components/admin/lessonbuilder/LessonBuilder.tsx
//
// Module Builder — converted from the original Lesson Builder.
//
// Hierarchy: Course -> Module -> Sections (unlimited).
// "Sections" are the existing `lessons` table rows (renamed in the UI
// only — no database rename was required or performed). Every existing
// service/repository is reused as-is:
//   - courseService      (Course dropdown)
//   - moduleService       (Module CRUD — title/description/thumbnail/
//                          duration/active already existed as real columns)
//   - lessonBuilderService (Section CRUD — the existing `lessons` table)
//   - resourceService      (Image/PDF/Download attachments per Section —
//                          the existing `learning_resources` table)
//   - contentEditorService (Section rich text body + real Storage uploads,
//                          via the existing Content Editor component)
//
// No new tables or columns were required: `modules` already had
// description/thumbnail/estimated_minutes/active, and `learning_resources`
// already supports arbitrary attachments per lesson (section). Everything
// stays inside this one screen — no separate Resources/Images/PDF pages.

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  loadLessons,
  createLesson,
  updateLesson,
  deleteLesson,
} from '../../../services/lessonBuilder/lessonBuilderService';
import {
  loadModules,
  createModule,
  saveModule,
  removeModule,
} from '../../../services/module/moduleService';
import { loadCourses } from '../../../services/course/courseService';
import {
  loadResources,
  createResource,
  removeResource,
  toggleResourceStatus,
} from '../../../services/resource/resourceService';
import { uploadImage, uploadDocument } from '../../../services/contentEditor/contentEditorService';
import ContentEditor from '../contenteditor/ContentEditor';

import type {
  Lesson,
  LessonForm,
  LessonType,
  LessonBuilderForm,
} from '../../../types/lessonBuilder';
import { defaultLessonBuilderForm, lessonStatusFromActive } from '../../../types/lessonBuilder';
import type { Module, ModuleForm } from '../../../types/module';
import { defaultModuleForm } from '../../../types/module';
import type { Course } from '../../../types/course';
import type { Resource, ResourceForm, ResourceType } from '../../../types/resource';

// ─────────────────────────────────────────────────────────────────────────────
// Cross-component authoring sync (unchanged mechanism from before)
// ─────────────────────────────────────────────────────────────────────────────

const COURSES_CHANGED_EVENT = 'sk:courses-changed';
const LESSONS_CHANGED_EVENT = 'sk:lessons-changed';

function notifyLessonsChanged() {
  window.dispatchEvent(new CustomEvent(LESSONS_CHANGED_EVENT));
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

const CLS_INPUT =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 disabled:cursor-not-allowed disabled:bg-slate-50';

const CLS_SELECT = CLS_INPUT;
const CLS_TEXTAREA = `${CLS_INPUT} resize-none`;

const LESSON_TYPES: LessonType[] = [
  'video', 'text', 'document', 'audio', 'ppt', 'pdf', 'image', 'youtube', 'scorm', 'assignment', 'quiz', 'live',
];

function FL({
  label,
  required,
  error,
  children,
}: {
  label:     string;
  required?: boolean;
  error?:    string;
  children:  React.ReactNode;
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
  const status = lessonStatusFromActive(active);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        status === 'published'
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
          : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'published' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {status === 'published' ? 'Published' : 'Draft'}
    </span>
  );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? 'bg-yellow-500' : 'bg-slate-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function capitalize(str: string): string {
  if (!str) return '—';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function Thumbnail({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className={`flex items-center justify-center rounded-xl bg-slate-100 ${className ?? 'h-24 w-full'}`}>
        <svg className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292v-14.25" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      className={`rounded-xl object-cover ${className ?? 'h-24 w-full'}`}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton / Empty / Error
// ─────────────────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Something went wrong</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

function EmptyState({ message, actionLabel, onAction }: { message: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
      <p className="mb-4 text-sm text-slate-500">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete confirmation dialog (generic, reused for Module / Section)
// ─────────────────────────────────────────────────────────────────────────────

function DeleteDialog({
  title,
  name,
  busy,
  onConfirm,
  onCancel,
}: {
  title:     string;
  name:      string;
  busy:      boolean;
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!busy ? onCancel : undefined} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h3 className="mb-1 text-lg font-semibold text-slate-800">{title}</h3>
        <p className="mb-6 text-sm text-slate-500">
          Are you sure you want to delete <span className="font-semibold text-slate-700">{name}</span>? This action cannot be undone.
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
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Module form modal (Title / Description / Thumbnail / Duration / Active)
// ─────────────────────────────────────────────────────────────────────────────

interface ModuleErrs {
  module_code?: string;
  module_name?: string;
  estimated_minutes?: string;
  module_order?: string;
}

function ModuleFormModal({
  editing,
  courseId,
  nextOrder,
  saving,
  onSave,
  onClose,
}: {
  editing:   Module | null;
  courseId:  string;
  nextOrder: number;
  saving:    boolean;
  onSave:    (data: ModuleForm) => void;
  onClose:   () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<ModuleForm>(() =>
    isEdit
      ? {
          course_id:          editing.course_id,
          module_code:        editing.module_code,
          module_name:        editing.module_name,
          description:        editing.description,
          module_order:       editing.module_order,
          estimated_minutes:  editing.estimated_minutes,
          thumbnail:          editing.thumbnail,
          active:             editing.active,
        }
      : { ...defaultModuleForm, course_id: courseId, module_order: nextOrder }
  );

  const [errs, setErrs] = useState<ModuleErrs>({});
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !saving) onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  function field<K extends keyof ModuleForm>(key: K, val: ModuleForm[K]) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: ModuleErrs = {};
    if (!form.module_code.trim()) e.module_code = 'Module Code is required.';
    if (!form.module_name.trim()) e.module_name = 'Module Title is required.';
    if (form.estimated_minutes < 1) e.estimated_minutes = 'Must be at least 1.';
    if (form.module_order < 1) e.module_order = 'Must be at least 1.';
    setErrs(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    onSave(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-5 text-lg font-semibold text-slate-800">{isEdit ? 'Edit Module' : 'Add Module'}</h3>

        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FL label="Module Code" required error={errs.module_code}>
              <input
                ref={firstRef}
                className={CLS_INPUT}
                value={form.module_code}
                onChange={(e) => field('module_code', e.target.value)}
                disabled={saving}
              />
            </FL>
            <FL label="Module Title" required error={errs.module_name}>
              <input
                className={CLS_INPUT}
                value={form.module_name}
                onChange={(e) => field('module_name', e.target.value)}
                disabled={saving}
              />
            </FL>
          </div>

          <FL label="Module Description">
            <textarea
              className={CLS_TEXTAREA}
              rows={3}
              value={form.description}
              onChange={(e) => field('description', e.target.value)}
              disabled={saving}
            />
          </FL>

          <FL label="Module Thumbnail URL">
            <input
              className={CLS_INPUT}
              value={form.thumbnail}
              onChange={(e) => field('thumbnail', e.target.value)}
              placeholder="https://…"
              disabled={saving}
            />
            {form.thumbnail && <Thumbnail src={form.thumbnail} alt="Thumbnail preview" className="mt-2 h-24 w-40" />}
          </FL>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FL label="Estimated Duration (min)" required error={errs.estimated_minutes}>
              <input
                type="number"
                min={1}
                className={CLS_INPUT}
                value={form.estimated_minutes}
                onChange={(e) => field('estimated_minutes', Number(e.target.value))}
                disabled={saving}
              />
            </FL>
            <FL label="Display Order" required error={errs.module_order}>
              <input
                type="number"
                min={1}
                className={CLS_INPUT}
                value={form.module_order}
                onChange={(e) => field('module_order', Number(e.target.value))}
                disabled={saving}
              />
            </FL>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Active</p>
              <p className="text-xs text-slate-400">Inactive modules are hidden from learners.</p>
            </div>
            <Toggle on={form.active} onChange={() => field('active', !form.active)} disabled={saving} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:opacity-50 active:scale-95"
          >
            {saving && <Spinner />}
            {isEdit ? 'Save Module' : 'Create Module'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section form modal (Section Heading / Type / Duration / Order / Active)
// ─────────────────────────────────────────────────────────────────────────────

interface SectionErrs {
  lesson_title?:     string;
  duration_minutes?: string;
  display_order?:    string;
}

function SectionFormModal({
  editing,
  moduleId,
  nextOrder,
  saving,
  onSave,
  onClose,
}: {
  editing:   Lesson | null;
  moduleId:  string;
  nextOrder: number;
  saving:    boolean;
  onSave:    (data: LessonBuilderForm) => void;
  onClose:   () => void;
}) {
  const isEdit = editing !== null;

  const [form, setForm] = useState<LessonBuilderForm>(() =>
    isEdit
      ? {
          ...defaultLessonBuilderForm,
          module_id:        editing.module_id,
          lesson_title:     editing.lesson_title,
          lesson_type:      editing.lesson_type,
          content:          editing.content,
          video_url:        editing.video_url,
          duration_minutes: editing.duration_minutes,
          display_order:    editing.display_order,
          downloadable:     editing.downloadable,
          active:           editing.active,
        }
      : { ...defaultLessonBuilderForm, module_id: moduleId, display_order: nextOrder }
  );

  const [errs, setErrs] = useState<SectionErrs>({});
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !saving) onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  function field<K extends keyof LessonBuilderForm>(key: K, val: LessonBuilderForm[K]) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrs((p) => ({ ...p, [key]: undefined }));
  }

  function validate(): boolean {
    const e: SectionErrs = {};
    if (!form.lesson_title.trim()) e.lesson_title = 'Section Heading is required.';
    if (form.duration_minutes < 0) e.duration_minutes = 'Cannot be negative.';
    if (form.display_order < 1) e.display_order = 'Must be at least 1.';
    setErrs(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    onSave(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!saving ? onClose : undefined} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-5 text-lg font-semibold text-slate-800">{isEdit ? 'Edit Section' : 'Add Section'}</h3>

        <div className="space-y-5">
          <FL label="Section Heading" required error={errs.lesson_title}>
            <input
              ref={firstRef}
              className={CLS_INPUT}
              value={form.lesson_title}
              onChange={(e) => field('lesson_title', e.target.value)}
              disabled={saving}
            />
          </FL>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FL label="Section Type" required>
              <select
                className={CLS_SELECT}
                value={form.lesson_type}
                onChange={(e) => field('lesson_type', e.target.value as LessonType)}
                disabled={saving}
              >
                {LESSON_TYPES.map((t) => (
                  <option key={t} value={t}>{capitalize(t)}</option>
                ))}
              </select>
            </FL>

            <FL label="Estimated Duration (min)" error={errs.duration_minutes}>
              <input
                type="number"
                min={0}
                className={CLS_INPUT}
                value={form.duration_minutes}
                onChange={(e) => field('duration_minutes', Number(e.target.value))}
                disabled={saving}
              />
            </FL>

            <FL label="Display Order" error={errs.display_order}>
              <input
                type="number"
                min={1}
                className={CLS_INPUT}
                value={form.display_order}
                onChange={(e) => field('display_order', Number(e.target.value))}
                disabled={saving}
              />
            </FL>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Downloadable</p>
              <p className="text-xs text-slate-400">Allow learners to download this section's content.</p>
            </div>
            <Toggle on={form.downloadable} onChange={() => field('downloadable', !form.downloadable)} disabled={saving} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
            <div>
              <p className="text-sm font-medium text-slate-700">Active</p>
              <p className="text-xs text-slate-400">Inactive sections are hidden from learners.</p>
            </div>
            <Toggle on={form.active} onChange={() => field('active', !form.active)} disabled={saving} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:opacity-50 active:scale-95"
          >
            {saving && <Spinner />}
            {isEdit ? 'Save Section' : 'Add Section'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Attachments panel (Image Upload / PDF Upload / Download Attachment)
// Lives inline inside an expanded Section — no separate Resources page.
// ─────────────────────────────────────────────────────────────────────────────

function attachmentIcon(type: ResourceType): string {
  if (type === 'image') return '🖼️';
  if (type === 'pdf') return '📄';
  return '📎';
}

function AttachmentsPanel({
  sectionId,
  resources,
  onChanged,
}: {
  sectionId: string;
  resources: Resource[];
  onChanged: () => void;
}) {
  const [uploadingKind, setUploadingKind] = useState<'image' | 'pdf' | 'file' | null>(null);
  const [error, setError] = useState('');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nextOrder = useMemo(
    () => (resources.length > 0 ? Math.max(...resources.map((r) => r.display_order)) + 1 : 1),
    [resources]
  );

  async function handleUpload(
    kind: 'image' | 'pdf' | 'file',
    file: File,
    resourceType: ResourceType,
    downloadable: boolean
  ) {
    setUploadingKind(kind);
    setError('');
    try {
      const result = kind === 'image' ? await uploadImage(file) : await uploadDocument(file);
      const payload: ResourceForm = {
        lesson_id:      sectionId,
        resource_title: file.name,
        resource_type:  resourceType,
        file_url:       result.url,
        description:    '',
        display_order:  nextOrder,
        downloadable,
        active:         true,
      };
      await createResource(payload);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingKind(null);
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void handleUpload('image', file, 'image', false);
  }

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void handleUpload('pdf', file, 'pdf', true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void handleUpload('file', file, 'other', true);
  }

  async function handleDelete(resourceId: string) {
    try {
      await removeResource(resourceId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete attachment.');
    }
  }

  async function handleToggle(resource: Resource) {
    try {
      await toggleResourceStatus(resource.id, !resource.active);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update attachment.');
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Attachments</p>

      {error && <p className="mb-3 text-xs text-red-600">{error}</p>}

      {resources.length === 0 ? (
        <p className="mb-3 text-sm text-slate-400">No attachments yet.</p>
      ) : (
        <div className="mb-3 space-y-2">
          {resources.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span>{attachmentIcon(r.resource_type)}</span>
                <a
                  href={r.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-sm font-medium text-blue-700 hover:underline"
                >
                  {r.resource_title}
                </a>
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                <Toggle on={r.active} onChange={() => handleToggle(r)} />
                <button
                  onClick={() => handleDelete(r.id)}
                  aria-label="Delete attachment"
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => imageInputRef.current?.click()}
          disabled={uploadingKind !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {uploadingKind === 'image' ? <Spinner /> : '🖼️'} Upload Image
        </button>
        <input ref={imageInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif" className="hidden" onChange={handleImageChange} />

        <button
          onClick={() => pdfInputRef.current?.click()}
          disabled={uploadingKind !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {uploadingKind === 'pdf' ? <Spinner /> : '📄'} Upload PDF
        </button>
        <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfChange} />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingKind !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {uploadingKind === 'file' ? <Spinner /> : '📎'} Add Download Attachment
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section accordion item
// ─────────────────────────────────────────────────────────────────────────────

function SectionAccordionItem({
  section,
  resources,
  isFirst,
  isLast,
  isExpanded,
  reordering,
  onToggleExpand,
  onEdit,
  onDelete,
  onReorder,
  onResourcesChanged,
}: {
  section:    Lesson;
  resources:  Resource[];
  isFirst:    boolean;
  isLast:     boolean;
  isExpanded: boolean;
  reordering: boolean;
  onToggleExpand: () => void;
  onEdit:         () => void;
  onDelete:       () => void;
  onReorder:      (direction: 'up' | 'down') => void;
  onResourcesChanged: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex flex-col">
          <button
            onClick={() => onReorder('up')}
            disabled={isFirst || reordering}
            aria-label="Move up"
            className="text-slate-400 transition hover:text-yellow-600 disabled:opacity-30"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
            </svg>
          </button>
          <button
            onClick={() => onReorder('down')}
            disabled={isLast || reordering}
            aria-label="Move down"
            className="text-slate-400 transition hover:text-yellow-600 disabled:opacity-30"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>

        <button onClick={onToggleExpand} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <svg
            className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800">{section.lesson_title}</p>
            <p className="text-xs text-slate-400">
              {capitalize(section.lesson_type)} · {section.duration_minutes} min · {resources.length} attachment{resources.length === 1 ? '' : 's'}
            </p>
          </div>
        </button>

        <StatusPill active={section.active} />

        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={onEdit}
            aria-label="Edit section"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-yellow-50 hover:text-yellow-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            aria-label="Delete section"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 border-t border-slate-100 p-4">
          <ContentEditor lessonId={section.id} />
          <AttachmentsPanel sectionId={section.id} resources={resources} onChanged={onResourcesChanged} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Module card
// ─────────────────────────────────────────────────────────────────────────────

function ModuleCard({
  module: mod,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  children,
}: {
  module: Module;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit:   () => void;
  onDelete: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:flex-row">
        <Thumbnail src={mod.thumbnail} alt={mod.module_name} className="h-24 w-full flex-shrink-0 sm:w-40" />

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-800">{mod.module_name}</p>
              <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                {mod.module_code}
              </span>
            </div>
            <StatusPill active={mod.active} />
          </div>
          {mod.description && <p className="mb-2 line-clamp-2 text-sm text-slate-500">{mod.description}</p>}
          <p className="text-xs text-slate-400">Estimated Duration: {mod.estimated_minutes} min</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={onToggleExpand}
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
            >
              {isExpanded ? 'Hide Sections' : 'Manage Sections'}
            </button>
            <button
              onClick={onEdit}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Edit Module
            </button>
            <button
              onClick={onDelete}
              className="rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {isExpanded && <div className="space-y-3 border-t border-slate-100 p-5">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main LessonBuilder (Module Builder)
// ─────────────────────────────────────────────────────────────────────────────

function LessonBuilder() {
  const [courses,   setCourses]   = useState<Course[]>([]);
  const [modules,   setModules]   = useState<Module[]>([]);
  const [sections,  setSections]  = useState<Lesson[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const [selectedCourseId,  setSelectedCourseId]  = useState('');
  const [expandedModuleId,  setExpandedModuleId]  = useState<string | null>(null);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule,   setEditingModule]   = useState<Module | null>(null);
  const [savingModule,    setSavingModule]    = useState(false);
  const [deleteModuleTarget, setDeleteModuleTarget] = useState<Module | null>(null);
  const [deletingModule,     setDeletingModule]     = useState(false);

  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSection,   setEditingSection]   = useState<Lesson | null>(null);
  const [sectionModuleId,  setSectionModuleId]  = useState('');
  const [savingSection,    setSavingSection]    = useState(false);
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<Lesson | null>(null);
  const [deletingSection,     setDeletingSection]     = useState(false);
  const [reorderingSectionId, setReorderingSectionId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [courseRows, moduleRows, sectionRows, resourceRows] = await Promise.all([
        loadCourses(),
        loadModules(),
        loadLessons(),
        loadResources(),
      ]);
      setCourses(courseRows);
      setModules(moduleRows);
      setSections(sectionRows);
      setResources(resourceRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Module Builder data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleCoursesChanged() { refresh(); }
    function handleFocusOrVisible() {
      if (document.visibilityState === 'hidden') return;
      refresh();
    }
    window.addEventListener(COURSES_CHANGED_EVENT, handleCoursesChanged);
    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    return () => {
      window.removeEventListener(COURSES_CHANGED_EVENT, handleCoursesChanged);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const courseModules = useMemo(
    () =>
      modules
        .filter((m) => m.course_id === selectedCourseId)
        .sort((a, b) => a.module_order - b.module_order),
    [modules, selectedCourseId]
  );

  function sectionsForModule(moduleId: string): Lesson[] {
    return sections
      .filter((s) => s.module_id === moduleId)
      .sort((a, b) => a.display_order - b.display_order);
  }

  function resourcesForSection(sectionId: string): Resource[] {
    return resources
      .filter((r) => r.lesson_id === sectionId)
      .sort((a, b) => a.display_order - b.display_order);
  }

  // ── Module handlers ─────────────────────────────────────────────────────────

  function openAddModule() {
    setEditingModule(null);
    setModuleModalOpen(true);
  }
  function openEditModule(mod: Module) {
    setEditingModule(mod);
    setModuleModalOpen(true);
  }

  async function handleSaveModule(data: ModuleForm) {
    setSavingModule(true);
    try {
      if (editingModule) {
        await saveModule(editingModule.id, data);
      } else {
        await createModule(data);
      }
      setModuleModalOpen(false);
      setEditingModule(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save module.');
    } finally {
      setSavingModule(false);
    }
  }

  async function handleDeleteModule() {
    if (!deleteModuleTarget) return;
    setDeletingModule(true);
    try {
      await removeModule(deleteModuleTarget.id);
      if (expandedModuleId === deleteModuleTarget.id) setExpandedModuleId(null);
      setDeleteModuleTarget(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete module.');
    } finally {
      setDeletingModule(false);
    }
  }

  // ── Section handlers ────────────────────────────────────────────────────────

  function openAddSection(moduleId: string) {
    setEditingSection(null);
    setSectionModuleId(moduleId);
    setSectionModalOpen(true);
  }
  function openEditSection(section: Lesson) {
    setEditingSection(section);
    setSectionModuleId(section.module_id);
    setSectionModalOpen(true);
  }

  async function handleSaveSection(data: LessonBuilderForm) {
    setSavingSection(true);
    try {
      const payload: LessonForm = {
        module_id:        data.module_id,
        lesson_title:     data.lesson_title.trim(),
        lesson_type:      data.lesson_type,
        content:          data.content,
        video_url:        data.video_url,
        duration_minutes: data.duration_minutes,
        display_order:    data.display_order,
        downloadable:     data.downloadable,
        active:           data.active,
      };
      if (editingSection) {
        await updateLesson(editingSection.id, payload);
      } else {
        await createLesson(payload);
      }
      setSectionModalOpen(false);
      setEditingSection(null);
      await refresh();
      notifyLessonsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save section.');
    } finally {
      setSavingSection(false);
    }
  }

  async function handleDeleteSection() {
    if (!deleteSectionTarget) return;
    setDeletingSection(true);
    try {
      await deleteLesson(deleteSectionTarget.id);
      if (expandedSectionId === deleteSectionTarget.id) setExpandedSectionId(null);
      setDeleteSectionTarget(null);
      await refresh();
      notifyLessonsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete section.');
    } finally {
      setDeletingSection(false);
    }
  }

  async function handleReorderSection(section: Lesson, direction: 'up' | 'down') {
    const siblings = sectionsForModule(section.module_id);
    const index = siblings.findIndex((s) => s.id === section.id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;
    const target = siblings[targetIndex];

    setReorderingSectionId(section.id);
    try {
      await Promise.all([
        updateLesson(section.id, { display_order: target.display_order }),
        updateLesson(target.id, { display_order: section.display_order }),
      ]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder sections.');
    } finally {
      setReorderingSectionId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Module Builder</h2>
          <p className="mt-1 text-slate-500">Course → Module → Sections. Build unlimited sections per module.</p>
        </div>
      </div>

      <div className="mb-6 max-w-sm">
        <FL label="Course">
          <select
            className={CLS_SELECT}
            value={selectedCourseId}
            onChange={(e) => {
              setSelectedCourseId(e.target.value);
              setExpandedModuleId(null);
              setExpandedSectionId(null);
            }}
          >
            <option value="">Select a course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.course_name}</option>
            ))}
          </select>
        </FL>
      </div>

      {error && <div className="mb-6"><ErrorState message={error} /></div>}

      {loading && <CardSkeleton />}

      {!loading && !selectedCourseId && (
        <EmptyState message="Select a course above to manage its modules." />
      )}

      {!loading && selectedCourseId && (
        <>
          <div className="mb-4 flex justify-end">
            <button
              onClick={openAddModule}
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Module
            </button>
          </div>

          {courseModules.length === 0 ? (
            <EmptyState message="No modules yet for this course." actionLabel="Add Module" onAction={openAddModule} />
          ) : (
            <div className="space-y-4">
              {courseModules.map((mod) => {
                const isExpanded = expandedModuleId === mod.id;
                const moduleSections = sectionsForModule(mod.id);
                return (
                  <ModuleCard
                    key={mod.id}
                    module={mod}
                    isExpanded={isExpanded}
                    onToggleExpand={() => setExpandedModuleId(isExpanded ? null : mod.id)}
                    onEdit={() => openEditModule(mod)}
                    onDelete={() => setDeleteModuleTarget(mod)}
                  >
                    {moduleSections.length === 0 ? (
                      <EmptyState
                        message="No sections yet in this module."
                        actionLabel="+ Add Section"
                        onAction={() => openAddSection(mod.id)}
                      />
                    ) : (
                      moduleSections.map((section, idx) => (
                        <SectionAccordionItem
                          key={section.id}
                          section={section}
                          resources={resourcesForSection(section.id)}
                          isFirst={idx === 0}
                          isLast={idx === moduleSections.length - 1}
                          isExpanded={expandedSectionId === section.id}
                          reordering={reorderingSectionId === section.id}
                          onToggleExpand={() =>
                            setExpandedSectionId(expandedSectionId === section.id ? null : section.id)
                          }
                          onEdit={() => openEditSection(section)}
                          onDelete={() => setDeleteSectionTarget(section)}
                          onReorder={(direction) => handleReorderSection(section, direction)}
                          onResourcesChanged={refresh}
                        />
                      ))
                    )}

                    {moduleSections.length > 0 && (
                      <button
                        onClick={() => openAddSection(mod.id)}
                        className="w-full rounded-xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 transition hover:border-yellow-400 hover:text-yellow-600"
                      >
                        + Add Section
                      </button>
                    )}
                  </ModuleCard>
                );
              })}
            </div>
          )}
        </>
      )}

      {moduleModalOpen && (
        <ModuleFormModal
          editing={editingModule}
          courseId={selectedCourseId}
          nextOrder={courseModules.length + 1}
          saving={savingModule}
          onSave={handleSaveModule}
          onClose={() => { setModuleModalOpen(false); setEditingModule(null); }}
        />
      )}

      {sectionModalOpen && (
        <SectionFormModal
          editing={editingSection}
          moduleId={sectionModuleId}
          nextOrder={sectionsForModule(sectionModuleId).length + 1}
          saving={savingSection}
          onSave={handleSaveSection}
          onClose={() => { setSectionModalOpen(false); setEditingSection(null); }}
        />
      )}

      {deleteModuleTarget && (
        <DeleteDialog
          title="Delete Module"
          name={deleteModuleTarget.module_name}
          busy={deletingModule}
          onConfirm={handleDeleteModule}
          onCancel={() => setDeleteModuleTarget(null)}
        />
      )}

      {deleteSectionTarget && (
        <DeleteDialog
          title="Delete Section"
          name={deleteSectionTarget.lesson_title}
          busy={deletingSection}
          onConfirm={handleDeleteSection}
          onCancel={() => setDeleteSectionTarget(null)}
        />
      )}
    </div>
  );
}

export default LessonBuilder;
