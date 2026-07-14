// src/components/admin/coursebuilder/CourseAuthoringWorkspace.tsx
//
// Fully self-contained Course Authoring Workspace. Reuses only existing,
// unmodified architecture:
//   courseService, moduleService, lessonBuilderService, resourceService,
//   contentEditorService — exactly as used elsewhere in this app.
//   ContentEditor is reused unmodified for Page (text) lessons.
//
// No external sub-components are imported (no WorkspaceHeader,
// CourseOutline, PropertiesPanel, DeleteDialog, PreviewDialog) — every
// piece of UI lives in this one file. No lucide-react — every icon is
// inline SVG.

import { useEffect, useRef, useState } from 'react';

import ContentEditor from '../contenteditor/ContentEditor';

import { loadCourses } from '../../../services/course/courseService';
import { loadModules, createModule, saveModule, removeModule } from '../../../services/module/moduleService';
import {
  loadLessons,
  createLesson,
  updateLesson,
  deleteLesson,
} from '../../../services/lessonBuilder/lessonBuilderService';
import { loadLessonContent, uploadImage, uploadVideo, uploadDocument } from '../../../services/contentEditor/contentEditorService';
import {
  loadResources,
  createResource,
  saveResource,
  removeResource,
} from '../../../services/resource/resourceService';

import type { Lesson, LessonType } from '../../../types/lessonBuilder';
import type { Module, ModuleForm } from '../../../types/module';
import type { Course } from '../../../types/course';
import type { Resource } from '../../../types/resource';

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

function youtubeEmbedId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

interface AssignmentSettings {
  instructions:       string;
  marks:              number;
  submissionRequired: boolean;
}
const DEFAULT_ASSIGNMENT: AssignmentSettings = { instructions: '', marks: 0, submissionRequired: false };

interface QuizSettings {
  quizName:       string;
  passingPercent: number;
  attempts:       number;
  timerMinutes:   number;
}
const DEFAULT_QUIZ: QuizSettings = { quizName: '', passingPercent: 60, attempts: 1, timerMinutes: 0 };

// ─────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG only)
// ─────────────────────────────────────────────────────────────────────────────

function IconChevronDown({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>);
}
function IconChevronRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>);
}
function IconPlus({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>);
}
function IconTrash({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>);
}
function IconPencil({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>);
}
function IconDuplicate({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.29 48.29 0 0 1 1.927-.184" /></svg>);
}
function IconArrowUp({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" /></svg>);
}
function IconArrowDown({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>);
}
function IconEye({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>);
}
function IconSave({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>);
}
function IconX({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>);
}
function IconUpload({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>);
}
function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}
function IconPage({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>);
}
function IconVideo({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5 19.5 7.5v9l-3.75-3M4.5 6.75h9a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5v-7.5a1.5 1.5 0 0 1 1.5-1.5Z" /></svg>);
}
function IconAttachment({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" /></svg>);
}
function IconAssignment({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" /></svg>);
}
function IconQuiz({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 17.25h.008v.008H12v-.008Z" /></svg>);
}
function IconImage({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M8.25 6.75h.008v.008H8.25V6.75Z" /></svg>);
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
    <div className="rounded-2xl bg-white p-6 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
      <h3 className="mb-4 text-lg font-bold text-slate-900">{title}</h3>
      {children}
    </div>
  );
}
function PrimaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">
      {children}
    </button>
  );
}
function AccentButton({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.98]">
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
function DangerButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">
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
      <div className="absolute inset-0 bg-slate-900/40" onClick={!busy ? onCancel : undefined} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-1 text-lg font-bold text-slate-900">{title}</h3>
        <p className="mb-5 text-sm text-slate-500">
          Delete <span className="font-semibold text-slate-700">{name}</span>? This cannot be undone.
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
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Preview</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><IconX className="h-4 w-4" /></button>
        </div>
        <div className="prose prose-slate max-w-none text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Video / Reading Material / Assignment / Quiz panels
// ─────────────────────────────────────────────────────────────────────────────

function VideoEditorPanel({
  lesson, uploading, onUrlChange, onUpload,
}: { lesson: Lesson; uploading: boolean; onUrlChange: (url: string) => void; onUpload: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Card title="Video">
      {lesson.video_url ? (
        <div className="mb-4 overflow-hidden rounded-xl bg-black">
          {youtubeEmbedId(lesson.video_url) ? (
            <iframe className="aspect-video w-full" src={`https://www.youtube.com/embed/${youtubeEmbedId(lesson.video_url)}`} title="Video preview" allowFullScreen />
          ) : (
            <video controls className="aspect-video w-full" src={lesson.video_url} />
          )}
        </div>
      ) : (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-16 text-slate-300">
          <IconVideo className="h-6 w-6" /> No video yet
        </div>
      )}
      <label className="mb-1 block text-xs font-semibold text-slate-500">YouTube URL</label>
      <input
        key={lesson.id}
        defaultValue={lesson.video_url}
        onBlur={(e) => onUrlChange(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=…"
        className="mb-3 w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
      />
      <SecondaryButton onClick={() => inputRef.current?.click()}>
        {uploading ? <Spinner className="h-3.5 w-3.5" /> : <IconUpload className="h-4 w-4" />} {lesson.video_url ? 'Replace Video' : 'Upload Video (MP4)'}
      </SecondaryButton>
      <input ref={inputRef} type="file" accept=".mp4" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(f); }} />
    </Card>
  );
}

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
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500"><IconAttachment className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <a href={resource.file_url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-semibold text-slate-800 hover:underline">
                {resource.file_url.split('/').pop()}
              </a>
              <p className="text-xs text-slate-400">{resource.description}</p>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Download Button Label</label>
            <input
              value={resource.resource_title}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="e.g. Download Reading Material"
              className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </div>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => inputRef.current?.click()} className="flex-1">
              {uploading ? <Spinner className="h-3.5 w-3.5" /> : <IconUpload className="h-3.5 w-3.5" />} Replace
            </SecondaryButton>
            <DangerButton onClick={onRemove}><IconTrash className="h-3.5 w-3.5" /> Delete</DangerButton>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-16 text-slate-400 transition hover:border-indigo-300 hover:text-indigo-500"
        >
          {uploading ? <Spinner className="h-6 w-6" /> : <IconUpload className="h-6 w-6" />}
          <span className="text-sm font-semibold">Attach PDF</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(f); }} />
    </Card>
  );
}

function AssignmentPanel({
  settings, onChange,
}: { settings: AssignmentSettings; onChange: (patch: Partial<AssignmentSettings>) => void }) {
  return (
    <Card title="Assignment">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Instructions</label>
          <textarea
            value={settings.instructions}
            onChange={(e) => onChange({ instructions: e.target.value })}
            rows={6}
            placeholder="Describe what learners need to submit…"
            className="w-full resize-none rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Marks</label>
            <input type="number" min={0} value={settings.marks} onChange={(e) => onChange({ marks: Number(e.target.value) })} className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={settings.submissionRequired} onChange={(e) => onChange({ submissionRequired: e.target.checked })} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400" />
              Submission Required
            </label>
          </div>
        </div>
        <p className="text-xs text-slate-400">Assignment settings are not backed by a dedicated table yet — kept for this session only.</p>
      </div>
    </Card>
  );
}

function QuizPanel({
  settings, onChange,
}: { settings: QuizSettings; onChange: (patch: Partial<QuizSettings>) => void }) {
  return (
    <Card title="Quiz">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Linked Quiz</label>
          <input value={settings.quizName} onChange={(e) => onChange({ quizName: e.target.value })} placeholder="Quiz name…" className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Pass %</label>
            <input type="number" min={0} max={100} value={settings.passingPercent} onChange={(e) => onChange({ passingPercent: Number(e.target.value) })} className="w-full rounded-lg bg-slate-50 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Attempts</label>
            <input type="number" min={1} value={settings.attempts} onChange={(e) => onChange({ attempts: Number(e.target.value) })} className="w-full rounded-lg bg-slate-50 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Timer (min)</label>
            <input type="number" min={0} value={settings.timerMinutes} onChange={(e) => onChange({ timerMinutes: Number(e.target.value) })} className="w-full rounded-lg bg-slate-50 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
          </div>
        </div>
        <p className="text-xs text-slate-400">Quiz settings are not backed by a dedicated table yet — kept for this session only.</p>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Properties panel — right sidebar
// ─────────────────────────────────────────────────────────────────────────────

function ModuleProperties({
  module: mod, uploadingThumbnail, onChange, onThumbnailUpload,
}: {
  module: Module;
  uploadingThumbnail: boolean;
  onChange: (patch: Partial<Module>) => void;
  onThumbnailUpload: (file: File) => void;
}) {
  const thumbInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Title</label>
        <input key={mod.id} defaultValue={mod.module_name} onBlur={(e) => onChange({ module_name: e.target.value })} className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Description</label>
        <textarea key={`${mod.id}-desc`} defaultValue={mod.description} onBlur={(e) => onChange({ description: e.target.value })} rows={4} className="w-full resize-none rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Duration (min)</label>
          <input key={`${mod.id}-dur`} type="number" min={0} defaultValue={mod.estimated_minutes} onBlur={(e) => onChange({ estimated_minutes: Number(e.target.value) })} className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Release Order</label>
          <input key={`${mod.id}-order`} type="number" min={1} defaultValue={mod.module_order} onBlur={(e) => onChange({ module_order: Number(e.target.value) })} className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
        </div>
      </div>
      <div>
        <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><IconImage className="h-3.5 w-3.5" /> Thumbnail</label>
        <div className="flex gap-2">
          <input key={`${mod.id}-thumb`} defaultValue={mod.thumbnail} onBlur={(e) => onChange({ thumbnail: e.target.value })} placeholder="https://… or upload below" className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
          <SecondaryButton onClick={() => thumbInputRef.current?.click()} className="flex-shrink-0 px-3">
            {uploadingThumbnail ? <Spinner className="h-3.5 w-3.5" /> : <IconUpload className="h-3.5 w-3.5" />}
          </SecondaryButton>
        </div>
        <input ref={thumbInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onThumbnailUpload(f); }} />
        {mod.thumbnail && <img src={mod.thumbnail} alt="" className="mt-2 h-20 w-full rounded-lg object-cover" />}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
        <span className="text-sm font-medium text-slate-700">Visible</span>
        <button onClick={() => onChange({ active: !mod.active })} className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition ${mod.active ? 'bg-indigo-600' : 'bg-slate-300'}`}>
          <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white transition ${mod.active ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </button>
      </div>
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
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500">Title</label>
        <input key={lesson.id} defaultValue={lesson.lesson_title} onBlur={(e) => onLessonChange({ lesson_title: e.target.value })} className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
      </div>
      {showDescription && (
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Description</label>
          <textarea key={`${lesson.id}-desc`} defaultValue={lesson.content} onBlur={(e) => onLessonChange({ content: e.target.value })} rows={4} placeholder="Short description shown to learners…" className="w-full resize-none rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Estimated Time (min)</label>
          <input key={`${lesson.id}-dur`} type="number" min={0} defaultValue={lesson.duration_minutes} onBlur={(e) => onLessonChange({ duration_minutes: Number(e.target.value) })} className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Release Order</label>
          <input key={`${lesson.id}-order`} type="number" min={1} defaultValue={lesson.display_order} onBlur={(e) => onLessonChange({ display_order: Number(e.target.value) })} className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
        <span className="text-sm font-medium text-slate-700">Mandatory</span>
        <button onClick={() => onMandatoryChange(!mandatory)} className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition ${mandatory ? 'bg-indigo-600' : 'bg-slate-300'}`}>
          <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white transition ${mandatory ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
        <span className="text-sm font-medium text-slate-700">Visible</span>
        <button onClick={() => onLessonChange({ active: !lesson.active })} className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition ${lesson.active ? 'bg-indigo-600' : 'bg-slate-300'}`}>
          <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white transition ${lesson.active ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <p className="text-xs text-slate-400">Mandatory is a session-only flag — no dedicated column exists for it yet.</p>
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
      <div className="rounded-2xl bg-white p-6 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Properties</h3>
        {selectedModule && (
          <ModuleProperties
            module={selectedModule}
            uploadingThumbnail={uploadingThumbnail}
            onChange={onModuleChange}
            onThumbnailUpload={onThumbnailUpload}
          />
        )}
        {selectedItem && (
          <ItemProperties lesson={selectedItem} mandatory={mandatory} onLessonChange={onLessonChange} onMandatoryChange={onMandatoryChange} />
        )}
        {!selectedModule && !selectedItem && (
          <p className="text-sm text-slate-400">Select a module or item to edit its properties.</p>
        )}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main CourseAuthoringWorkspace
// ─────────────────────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saved';

function CourseAuthoringWorkspace() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(new Set());

  const [addingModule, setAddingModule] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
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
  const [quizSettingsById, setQuizSettingsById] = useState<Record<string, QuizSettings>>({});
  const [mandatoryById, setMandatoryById] = useState<Record<string, boolean>>({});

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2200);
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

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) ?? null;
  const activeLesson = lessons.find((l) => l.id === activeLessonId) ?? null;
  const selectedModule = modules.find((m) => m.id === selectedModuleId) ?? null;

  const courseModules = modules
    .filter((m) => m.course_id === selectedCourseId)
    .sort((a, b) => a.module_order - b.module_order);

  function lessonsForModule(moduleId: string): Lesson[] {
    return lessons.filter((l) => l.module_id === moduleId).sort((a, b) => a.display_order - b.display_order);
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

  function selectModule(mod: Module) {
    setSelectedModuleId(mod.id);
    setActiveLessonId('');
  }
  function selectItem(item: Lesson) {
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
    setDeletingModule(true);
    try {
      await removeModule(deleteModuleTarget.id);
      if (lessonsForModule(deleteModuleTarget.id).some((p) => p.id === activeLessonId)) setActiveLessonId('');
      if (selectedModuleId === deleteModuleTarget.id) setSelectedModuleId('');
      setDeleteModuleTarget(null);
      fetchOutline();
      notifyLessonsChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete module.');
    } finally {
      setDeletingModule(false);
    }
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
    setDeletingPage(true);
    try {
      await deleteLesson(deletePageTarget.id);
      if (activeLessonId === deletePageTarget.id) setActiveLessonId('');
      setDeletePageTarget(null);
      fetchOutline();
      notifyLessonsChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete item.');
    } finally {
      setDeletingPage(false);
    }
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

  function getMandatory(lessonId: string): boolean { return mandatoryById[lessonId] ?? false; }
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

  // ── Assignment / Quiz — temporary local UI state only (no backend table) ──

  function getAssignmentSettings(lessonId: string): AssignmentSettings {
    return assignmentSettingsById[lessonId] ?? DEFAULT_ASSIGNMENT;
  }
  function updateAssignmentSettings(lessonId: string, patch: Partial<AssignmentSettings>) {
    setAssignmentSettingsById((prev) => ({ ...prev, [lessonId]: { ...getAssignmentSettings(lessonId), ...patch } }));
  }
  function getQuizSettings(lessonId: string): QuizSettings {
    return quizSettingsById[lessonId] ?? DEFAULT_QUIZ;
  }
  function updateQuizSettings(lessonId: string, patch: Partial<QuizSettings>) {
    setQuizSettingsById((prev) => ({ ...prev, [lessonId]: { ...getQuizSettings(lessonId), ...patch } }));
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
    showToast('Saved');
    setTimeout(() => setSaveStatus('idle'), 1500);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen rounded-2xl bg-slate-50">

      {/* TOP TOOLBAR */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="min-w-0">
          {courses.length > 1 ? (
            <select
              value={selectedCourseId}
              onChange={(e) => { setSelectedCourseId(e.target.value); setExpandedModuleIds(new Set()); setActiveLessonId(''); setSelectedModuleId(''); }}
              className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            >
              {courses.map((c) => (<option key={c.id} value={c.id}>{c.course_name}</option>))}
            </select>
          ) : (
            <p className="truncate text-lg font-bold text-slate-900">{selectedCourse?.course_name || 'Course Authoring Workspace'}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {selectedCourse && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${selectedCourse.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                Course: {selectedCourse.active ? 'Published' : 'Draft'}
              </span>
            )}
            {activeLesson && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${activeLesson.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {activeLesson.active ? 'Published' : 'Draft'}
              </span>
            )}
            {saveStatus === 'saved' && <span className="text-emerald-600">Saved</span>}
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
            <IconSave className="h-4 w-4" /> Save
          </PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_320px]">

        {/* LEFT PANEL — Course Outline */}
        <aside className="rounded-2xl bg-white p-4 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] lg:sticky lg:top-24 lg:h-fit">
          <p className="mb-3 px-1 text-sm font-bold text-slate-800">Course Outline</p>

          {loading && <p className="px-1 text-xs text-slate-400">Loading course structure…</p>}
          {error && <p className="px-1 text-xs text-red-600">{error}</p>}

          {!loading && !error && (
            <div className="space-y-1">
              {courseModules.map((mod, modIndex) => {
                const isExpanded = expandedModuleIds.has(mod.id);
                const items = lessonsForModule(mod.id);
                const isEditingModule = editingModuleId === mod.id;
                const progress = moduleProgress(mod.id);
                const isModuleSelected = selectedModuleId === mod.id;
                return (
                  <div key={mod.id} className={`rounded-xl transition ${isModuleSelected ? 'bg-indigo-50/60 ring-1 ring-indigo-200' : ''}`}>
                    <div className="group flex items-center gap-1 rounded-xl px-1 py-1.5 hover:bg-slate-50">
                      <div className="flex flex-col">
                        <button onClick={() => moveModule(mod, 'up')} disabled={modIndex === 0} aria-label="Move module up" className="text-slate-300 transition hover:text-indigo-600 disabled:opacity-30"><IconArrowUp /></button>
                        <button onClick={() => moveModule(mod, 'down')} disabled={modIndex === courseModules.length - 1} aria-label="Move module down" className="text-slate-300 transition hover:text-indigo-600 disabled:opacity-30"><IconArrowDown /></button>
                      </div>
                      <button onClick={() => toggleModuleExpanded(mod.id)} aria-label={isExpanded ? 'Collapse module' : 'Expand module'} className="flex-shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                        {isExpanded ? <IconChevronDown className="h-3.5 w-3.5" /> : <IconChevronRight className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => selectModule(mod)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left">
                        {isEditingModule ? (
                          <input
                            autoFocus
                            value={editingModuleName}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditingModuleName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitRenameModule(); if (e.key === 'Escape') setEditingModuleId(null); }}
                            onBlur={commitRenameModule}
                            className="min-w-0 flex-1 rounded-md bg-white px-1.5 py-0.5 text-sm ring-1 ring-indigo-300 focus:outline-none"
                          />
                        ) : (
                          <span className={`truncate text-sm font-semibold ${isModuleSelected ? 'text-indigo-700' : 'text-slate-700'}`}>{mod.module_name}</span>
                        )}
                        {!isEditingModule && progress.total > 0 && (
                          <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{progress.published}/{progress.total}</span>
                        )}
                      </button>
                      {!isEditingModule && (
                        <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                          <button onClick={() => startRenameModule(mod)} title="Rename Module" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><IconPencil /></button>
                          <button onClick={() => handleDuplicateModule(mod)} title="Duplicate Module" disabled={duplicatingModuleId === mod.id} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-50">
                            {duplicatingModuleId === mod.id ? <Spinner className="h-3.5 w-3.5" /> : <IconDuplicate />}
                          </button>
                          <button onClick={() => setDeleteModuleTarget(mod)} title="Delete Module" className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><IconTrash className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="ml-4 space-y-0.5 border-l border-slate-100 pl-3 pb-2">
                        {items.map((item, itemIndex) => {
                          const isEditingItem = editingPageId === item.id;
                          const isItemSelected = activeLessonId === item.id;
                          return (
                            <div key={item.id} className={`group flex items-center gap-1 rounded-lg ${isItemSelected ? 'bg-indigo-50' : ''}`}>
                              <div className="flex flex-col">
                                <button onClick={() => movePage(mod.id, item, 'up')} disabled={itemIndex === 0} aria-label="Move item up" className="text-slate-300 transition hover:text-indigo-600 disabled:opacity-30"><IconArrowUp className="h-3 w-3" /></button>
                                <button onClick={() => movePage(mod.id, item, 'down')} disabled={itemIndex === items.length - 1} aria-label="Move item down" className="text-slate-300 transition hover:text-indigo-600 disabled:opacity-30"><IconArrowDown className="h-3 w-3" /></button>
                              </div>
                              <button onClick={() => selectItem(item)} className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm transition ${isItemSelected ? 'font-medium text-indigo-700' : 'text-slate-600'}`}>
                                <PageTypeIcon type={item.lesson_type} className="h-3.5 w-3.5 flex-shrink-0" />
                                {isEditingItem ? (
                                  <input
                                    autoFocus
                                    value={editingPageName}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => setEditingPageName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') commitRenamePage(); if (e.key === 'Escape') setEditingPageId(null); }}
                                    onBlur={commitRenamePage}
                                    className="min-w-0 flex-1 rounded-md bg-white px-1.5 py-0.5 text-sm ring-1 ring-indigo-300 focus:outline-none"
                                  />
                                ) : (
                                  <span className="truncate">{item.lesson_title || pageTypeLabel(item.lesson_type)}</span>
                                )}
                              </button>
                              {!isEditingItem && (
                                <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                                  <button onClick={() => startRenamePage(item)} title="Rename" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"><IconPencil className="h-3 w-3" /></button>
                                  <button onClick={() => handleDuplicatePage(mod.id, item)} title="Duplicate" disabled={duplicatingPageId === item.id} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-50">
                                    {duplicatingPageId === item.id ? <Spinner className="h-3 w-3" /> : <IconDuplicate className="h-3 w-3" />}
                                  </button>
                                  <button onClick={() => setDeletePageTarget(item)} title="Delete" className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><IconTrash className="h-3 w-3" /></button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        <div className="grid grid-cols-1 gap-0.5 pt-1">
                          <button onClick={() => handleAddItem(mod.id, 'text', 'Page')} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-indigo-600"><IconPlus className="h-3.5 w-3.5" /> <IconPage className="h-3.5 w-3.5" /> Add Page</button>
                          <button onClick={() => handleAddItem(mod.id, 'video', 'Video')} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-indigo-600"><IconPlus className="h-3.5 w-3.5" /> <IconVideo className="h-3.5 w-3.5" /> Add Video</button>
                          <button onClick={() => handleAddItem(mod.id, 'document', 'Reading Material')} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-indigo-600"><IconPlus className="h-3.5 w-3.5" /> <IconAttachment className="h-3.5 w-3.5" /> Add Reading Material</button>
                          <button onClick={() => handleAddItem(mod.id, 'assignment', 'Assignment')} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-indigo-600"><IconPlus className="h-3.5 w-3.5" /> <IconAssignment className="h-3.5 w-3.5" /> Add Assignment</button>
                          <button onClick={() => handleAddItem(mod.id, 'quiz', 'Quiz')} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-indigo-600"><IconPlus className="h-3.5 w-3.5" /> <IconQuiz className="h-3.5 w-3.5" /> Add Quiz</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {!addingModule ? (
                <button onClick={() => setAddingModule(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-indigo-600 hover:bg-indigo-50"><IconPlus /> Add Module</button>
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
                  <button onClick={() => setAddingModule(false)} className="rounded-lg bg-slate-100 p-1.5 text-slate-500"><IconX className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* CENTER — type-specific panel */}
        <main className="min-w-0">
          {!activeLessonId && !selectedModuleId && (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-24 text-center shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
              <p className="text-sm text-slate-400">Select an item from the Course Outline to start editing.</p>
            </div>
          )}

          {selectedModuleId && !activeLessonId && (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-24 text-center shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
              <p className="text-sm text-slate-400">Edit this module's properties on the right, or select an item inside it.</p>
            </div>
          )}

          {activeLessonId && activeLesson?.lesson_type === 'text' && (
            <ContentEditor lessonId={activeLessonId} />
          )}

          {activeLessonId && activeLesson?.lesson_type === 'video' && (
            <VideoEditorPanel lesson={activeLesson} uploading={uploadingVideo} onUrlChange={handleVideoUrlChange} onUpload={handleVideoUpload} />
          )}

          {activeLessonId && activeLesson?.lesson_type === 'document' && (
            <ReadingMaterialPanel resource={readingResource} uploading={uploadingReading} onUpload={handleReadingUpload} onLabelChange={handleReadingLabelChange} onRemove={handleReadingRemove} />
          )}

          {activeLessonId && activeLesson?.lesson_type === 'assignment' && (
            <AssignmentPanel settings={getAssignmentSettings(activeLessonId)} onChange={(patch) => updateAssignmentSettings(activeLessonId, patch)} />
          )}

          {activeLessonId && activeLesson?.lesson_type === 'quiz' && (
            <QuizPanel settings={getQuizSettings(activeLessonId)} onChange={(patch) => updateQuizSettings(activeLessonId, patch)} />
          )}

          {activeLessonId && activeLesson &&
            !['text', 'video', 'document', 'assignment', 'quiz'].includes(activeLesson.lesson_type) && (
              <ContentEditor lessonId={activeLessonId} />
          )}
        </main>

        {/* RIGHT PANEL — Properties */}
        {(selectedModule || activeLesson) && (
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

      {previewOpen && <PreviewDialog html={previewHtml} onClose={() => setPreviewOpen(false)} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default CourseAuthoringWorkspace;