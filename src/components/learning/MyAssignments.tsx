// src/components/learning/MyAssignments.tsx
//
// Professional Training App Assignment Module — Dashboard + Assignment
// Workspace, self-contained in this one file.
//
// Reuses only existing, unmodified architecture:
//   lessonBuilderService.loadLessons()   — assignments are the existing
//                                          `lessons` rows with
//                                          lesson_type === 'assignment'
//   moduleService.loadModules()          — resolves Module Name
//   resourceService (loadResources / createResource / saveResource /
//                    removeResource)     — the existing `learning_resources`
//                                          table doubles as both admin
//                                          authored attachments AND this
//                                          learner's own submission, kept
//                                          separate via a `description`
//                                          marker (the same technique
//                                          already used for Thumbnail /
//                                          Reading Material elsewhere) —
//                                          not a new table, not fake data.
//   contentEditorService.uploadDocument / uploadImage — the existing,
//                                          unmodified Storage upload path.
//   session.getCurrentUser()             — existing auth/session service.
//
// There is no due-date, maximum-marks, or trainer-review column/table
// anywhere in the reachable backend. Per instructions, those sections are
// gracefully hidden rather than faked. Review (Marks / Feedback / Reviewed
// Date / Status) is read from an optional review-marker resource, which
// today is never written by any existing trainer tool — so it will
// naturally stay hidden until such a tool exists, which is the correct,
// honest behaviour rather than inventing numbers.

import { useEffect, useMemo, useState } from 'react';
import { loadLessons } from '../../services/lessonBuilder/lessonBuilderService';
import { loadModules } from '../../services/module/moduleService';
import {
  loadResources,
  createResource,
  saveResource,
  removeResource,
} from '../../services/resource/resourceService';
import { uploadDocument, uploadImage } from '../../services/contentEditor/contentEditorService';
import { getCurrentUser } from '../../services/auth/session';

import type { Lesson } from '../../types/lessonBuilder';
import type { Module } from '../../types/module';
import type { Resource, ResourceType } from '../../types/resource';

// ─────────────────────────────────────────────────────────────────────────────
// Constants / markers
// ─────────────────────────────────────────────────────────────────────────────

const UPLOAD_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif';
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

function submissionMarker(employeeId: string): string {
  return `submission:${employeeId}`;
}

function reviewPrefix(employeeId: string): string {
  return `review:${employeeId}:`;
}

interface ReviewData {
  marks:      number;
  maxMarks:   number;
  feedback:   string;
  status:     'passed' | 'failed';
  reviewedAt: string;
}

function parseReview(resource: Resource, employeeId: string): ReviewData | null {
  const prefix = reviewPrefix(employeeId);
  if (!resource.description.startsWith(prefix)) return null;
  try {
    const parsed = JSON.parse(resource.description.slice(prefix.length));
    return {
      marks:      Number(parsed.marks) || 0,
      maxMarks:   Number(parsed.maxMarks) || 0,
      feedback:   String(parsed.feedback ?? ''),
      status:     parsed.status === 'failed' ? 'failed' : 'passed',
      reviewedAt: resource.created_at,
    };
  } catch {
    return null;
  }
}

function classifyUploadType(fileName: string): ResourceType {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (ext === 'doc' || ext === 'docx') return 'word';
  return 'pdf';
}

function fileNameFromUrl(url: string): string {
  return url.split('/').pop() ?? 'file';
}

function formatDate(value: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Assignment model (view-layer only)
// ─────────────────────────────────────────────────────────────────────────────

type AssignmentStatus = 'pending' | 'submitted' | 'reviewed';

interface MyAssignmentItem {
  lessonId:     string;
  title:        string;
  moduleName:   string;
  instructions: string;
  attachments:  Resource[];
  submission:   Resource | null;
  review:       ReviewData | null;
  status:       AssignmentStatus;
}

function buildAssignments(lessons: Lesson[], modules: Module[], resources: Resource[], employeeId: string): MyAssignmentItem[] {
  return lessons
    .filter((l) => l.lesson_type === 'assignment')
    .map((lesson) => {
      const mod = modules.find((m) => m.id === lesson.module_id);
      const lessonResources = resources.filter((r) => r.lesson_id === lesson.id);
      const attachments = lessonResources.filter(
        (r) => !r.description.startsWith('submission:') && !r.description.startsWith('review:')
      );
      const submission = lessonResources.find((r) => r.description === submissionMarker(employeeId)) ?? null;
      const review = lessonResources
        .map((r) => parseReview(r, employeeId))
        .find((r): r is ReviewData => r !== null) ?? null;

      const status: AssignmentStatus = review ? 'reviewed' : submission ? 'submitted' : 'pending';

      return {
        lessonId:     lesson.id,
        title:        lesson.lesson_title || 'Untitled Assignment',
        moduleName:   mod?.module_name ?? '—',
        instructions: lesson.content,
        attachments,
        submission,
        review,
        status,
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

function statusLabel(item: MyAssignmentItem): string {
  if (item.status === 'reviewed') return item.review?.status === 'failed' ? 'Failed' : 'Passed';
  if (item.status === 'submitted') return 'Submitted';
  return 'Pending';
}

function statusStyles(item: MyAssignmentItem): string {
  if (item.status === 'reviewed') {
    return item.review?.status === 'failed'
      ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
      : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  }
  if (item.status === 'submitted') return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
  return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
}

function StatusBadge({ item }: { item: MyAssignmentItem }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles(item)}`}>
      {statusLabel(item)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading / Empty / Error states
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load assignments</p>
      <p className="mt-1">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium transition hover:bg-red-100"
      >
        Try Again
      </button>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-20 text-center text-slate-400">
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <p className="font-medium">
        {search ? `No assignments match "${search}".` : 'No assignments assigned yet. Your trainer will assign work shortly.'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assignment card (dashboard)
// ─────────────────────────────────────────────────────────────────────────────

function AssignmentCard({ item, onOpen }: { item: MyAssignmentItem; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-base font-semibold text-slate-800">{item.title}</p>
        <StatusBadge item={item} />
      </div>

      <p className="mb-4 truncate text-sm text-slate-500">{item.moduleName}</p>

      <div className="mb-4 space-y-2 text-xs text-slate-500">
        {item.submission && (
          <div>
            <p className="text-slate-400">Submission Date</p>
            <p className="font-medium text-slate-700">{formatDate(item.submission.created_at)}</p>
          </div>
        )}
        {item.review && (
          <div>
            <p className="text-slate-400">Marks Obtained</p>
            <p className="font-medium text-slate-700">
              {item.review.marks}{item.review.maxMarks > 0 ? ` / ${item.review.maxMarks}` : ''}
            </p>
          </div>
        )}
        {item.review?.feedback && (
          <div>
            <p className="text-slate-400">Trainer Feedback</p>
            <p className="line-clamp-2 font-medium text-slate-700">{item.review.feedback}</p>
          </div>
        )}
      </div>

      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-yellow-600">
        Open Assignment
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirmation dialog
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmDialog({
  title, message, busy, confirmLabel, onConfirm, onCancel,
}: {
  title: string; message: string; busy: boolean; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={!busy ? onCancel : undefined} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-1 text-lg font-bold text-slate-900">{title}</h3>
        <p className="mb-6 text-sm text-slate-500">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-yellow-400 disabled:opacity-50 active:scale-95"
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Attachment row
// ─────────────────────────────────────────────────────────────────────────────

function AttachmentRow({ resource }: { resource: Resource }) {
  return (
    <a
      href={resource.file_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50"
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{resource.resource_title || fileNameFromUrl(resource.file_url)}</p>
      </div>
      <svg className="h-4 w-4 flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assignment Workspace
// ─────────────────────────────────────────────────────────────────────────────

function AssignmentWorkspace({
  item, employeeId, onBack, onChanged,
}: {
  item:       MyAssignmentItem;
  employeeId: string;
  onBack:     () => void;
  onChanged:  () => void;
}) {
  const [pendingFile, setPendingFile] = useState<{ file: File; url: string } | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeOpen,  setRemoveOpen]  = useState(false);
  const [toast,       setToast]       = useState('');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2500);
  }

  const locked = item.status === 'reviewed';

  async function handleFileSelected(file: File) {
    setUploading(true);
    try {
      const kind = classifyUploadType(file.name);
      const result = kind === 'image' ? await uploadImage(file) : await uploadDocument(file);
      setPendingFile({ file, url: result.url });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function handleRemovePendingFile() {
    setPendingFile(null);
  }

  async function handleSubmit() {
    if (!pendingFile) return;
    setSubmitting(true);
    try {
      const kind = classifyUploadType(pendingFile.file.name);
      if (item.submission) {
        await saveResource(item.submission.id, {
          lesson_id:      item.submission.lesson_id,
          resource_title: pendingFile.file.name,
          resource_type:  kind,
          file_url:       pendingFile.url,
          description:    submissionMarker(employeeId),
          display_order:  item.submission.display_order,
          downloadable:   true,
          active:         true,
        });
      } else {
        await createResource({
          lesson_id:      item.lessonId,
          resource_title: pendingFile.file.name,
          resource_type:  kind,
          file_url:       pendingFile.url,
          description:    submissionMarker(employeeId),
          display_order:  1,
          downloadable:   true,
          active:         true,
        });
      }
      setPendingFile(null);
      setConfirmOpen(false);
      showToast('Assignment submitted');
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to submit assignment.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveSubmission() {
    if (!item.submission) return;
    setSubmitting(true);
    try {
      await removeResource(item.submission.id);
      setRemoveOpen(false);
      showToast('Submission removed');
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove submission.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to My Assignments
      </button>

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-6">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-slate-800">{item.title}</h2>
          <p className="mt-1 text-slate-500">{item.moduleName}</p>
        </div>
        <StatusBadge item={item} />
      </div>

      {/* Content */}
      {item.instructions && (
        <div className="mb-8">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Instructions</h3>
          <div
            className="prose prose-slate max-w-none rounded-2xl bg-slate-50 p-6 text-sm leading-relaxed text-slate-700"
            dangerouslySetInnerHTML={{ __html: item.instructions }}
          />
        </div>
      )}

      {item.attachments.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Attachments</h3>
          <div className="space-y-2">
            {item.attachments.map((r) => <AttachmentRow key={r.id} resource={r} />)}
          </div>
        </div>
      )}

      {/* Review */}
      {item.review && (
        <div className="mb-8 rounded-2xl border border-slate-200 p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Trainer Review</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-400">Marks</p>
              <p className="font-semibold text-slate-800">
                {item.review.marks}{item.review.maxMarks > 0 ? ` / ${item.review.maxMarks}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <p className={`font-semibold ${item.review.status === 'failed' ? 'text-red-600' : 'text-emerald-600'}`}>
                {item.review.status === 'failed' ? 'Failed' : 'Passed'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Reviewed Date</p>
              <p className="font-semibold text-slate-800">{formatDate(item.review.reviewedAt)}</p>
            </div>
          </div>
          {item.review.feedback && (
            <div className="mt-4">
              <p className="text-xs text-slate-400">Feedback</p>
              <p className="mt-1 text-sm text-slate-700">{item.review.feedback}</p>
            </div>
          )}
        </div>
      )}

      {/* Submission */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Your Submission</h3>

        {locked && (
          <p className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            This assignment has been reviewed and can no longer be edited.
          </p>
        )}

        {!locked && item.submission && !pendingFile && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 p-4">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <a href={item.submission.file_url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-semibold text-slate-800 hover:underline">
                {item.submission.resource_title || fileNameFromUrl(item.submission.file_url)}
              </a>
              <p className="text-xs text-slate-400">Submitted {formatDate(item.submission.created_at)}</p>
            </div>
          </div>
        )}

        {!locked && pendingFile && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-yellow-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{pendingFile.file.name}</p>
              <p className="text-xs text-yellow-700">Ready to submit</p>
            </div>
          </div>
        )}

        {!locked && (
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50">
              {uploading ? 'Uploading…' : pendingFile || item.submission ? 'Replace File' : 'Choose File'}
              <input
                type="file"
                accept={UPLOAD_ACCEPT}
                className="hidden"
                disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleFileSelected(f); }}
              />
            </label>

            {pendingFile && (
              <button
                onClick={handleRemovePendingFile}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50"
              >
                Remove File
              </button>
            )}

            {!pendingFile && item.submission && (
              <button
                onClick={() => setRemoveOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50"
              >
                Remove Submission
              </button>
            )}

            {pendingFile && (
              <button
                onClick={() => setConfirmOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-yellow-400 active:scale-95"
              >
                {item.submission ? 'Resubmit' : 'Submit Assignment'}
              </button>
            )}
          </div>
        )}
      </div>

      {confirmOpen && (
        <ConfirmDialog
          title={item.submission ? 'Resubmit Assignment' : 'Submit Assignment'}
          message="Once submitted, your trainer will be notified to review your work. Continue?"
          busy={submitting}
          confirmLabel={item.submission ? 'Resubmit' : 'Submit'}
          onConfirm={handleSubmit}
          onCancel={() => setConfirmOpen(false)}
        />
      )}

      {removeOpen && (
        <ConfirmDialog
          title="Remove Submission"
          message="This will remove your submitted file. You can upload a new one afterwards. Continue?"
          busy={submitting}
          confirmLabel="Remove"
          onConfirm={handleRemoveSubmission}
          onCancel={() => setRemoveOpen(false)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main MyAssignments
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'pending' | 'submitted' | 'reviewed';

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'pending',   label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'reviewed',  label: 'Reviewed' },
];

function MyAssignments() {
  const user = getCurrentUser();

  const [items,   setItems]   = useState<MyAssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [activeLessonId, setActiveLessonId] = useState('');

  function fetchAssignments() {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    Promise.all([loadLessons(), loadModules(), loadResources()])
      .then(([lessons, modules, resources]) => {
        setItems(buildAssignments(lessons, modules, resources, user.id));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load assignments.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !kw || item.title.toLowerCase().includes(kw) || item.moduleName.toLowerCase().includes(kw);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'reviewed' ? item.status === 'reviewed' : item.status === statusFilter);
      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  const activeItem = items.find((i) => i.lessonId === activeLessonId) ?? null;

  if (activeItem && user?.id) {
    return (
      <AssignmentWorkspace
        item={activeItem}
        employeeId={user.id}
        onBack={() => setActiveLessonId('')}
        onChanged={fetchAssignments}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">My Assignments</h2>
          <p className="mt-1 text-slate-500">All assignments from your training program.</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          className="min-w-[220px] flex-1 rounded-xl border border-slate-200 p-3 text-sm focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-100"
          placeholder="Search by assignment title or module..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                statusFilter === opt.value
                  ? 'bg-yellow-500 text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchAssignments} />}

      {loading && <Skeleton />}

      {!loading && !error && filtered.length === 0 && <EmptyState search={search} />}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <AssignmentCard key={item.lessonId} item={item} onOpen={() => setActiveLessonId(item.lessonId)} />
          ))}
        </div>
      )}

    </div>
  );
}

export default MyAssignments;
