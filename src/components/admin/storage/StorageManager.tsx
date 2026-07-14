// src/components/admin/storage/StorageManager.tsx
//
// Central Storage Manager for the whole Training App's media. Reuses
// only existing, unmodified architecture:
//   lib/supabase (the existing shared client, same one every repository
//                 already imports) — used here for real, read-only
//                 listing of the existing `course-content` public
//                 bucket's real folders (images/ videos/ documents/), and
//                 for real move/rename/delete attempts on those objects.
//                 No new bucket, table, service, or repository is
//                 created; this is the same client every repository in
//                 this app already depends on.
//   contentEditorService.uploadImage/uploadVideo/uploadDocument — the
//                 existing, unmodified upload path (goes through the
//                 existing Edge Function with service_role, since this
//                 app's anon browser session can't write to Storage
//                 directly — confirmed in that service's own comments).
//   courseService, companyService, certificateService, resourceService,
//   lessonBuilderService, employeeService — used read-only to classify
//                 each real file into one of the nine named folders and
//                 to resolve a real "Uploaded By" name wherever a file is
//                 referenced by a real record's stored URL.
//   session.getCurrentUser() — for new uploads.
//
// This app's Storage buckets only physically have three folders today
// (images/ videos/ documents/); the nine named folders below are a
// logical view over those real files, classified by cross-referencing
// real data. A file that matches no known reference is shown under
// "Temporary Uploads" — a genuine, computed signal, not a fake category.
// Delete/Move/Rename attempt the real Storage call and surface the real
// result; nothing is faked if RLS rejects a write.

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { uploadImage, uploadVideo, uploadDocument } from '../../../services/contentEditor/contentEditorService';
import { loadCourses, saveCourse } from '../../../services/course/courseService';
import { loadCompanies, saveCompany } from '../../../services/company/companyService';
import { loadCertificates } from '../../../services/certificate/certificateService';
import { loadResources } from '../../../services/resource/resourceService';
import { loadLessons } from '../../../services/lessonBuilder/lessonBuilderService';
import { employeeService } from '../../../services/employee/employeeService';
import { getCurrentUser } from '../../../services/auth/session';

import type { Course } from '../../../types/course';
import type { Company } from '../../../types/company';
import type { Certificate } from '../../../types/certificate';
import type { Resource } from '../../../types/resource';
import type { Lesson } from '../../../types/lessonBuilder';
import type { Employee } from '../../../types/employee';

const BUCKET = 'course-content';
const PHYSICAL_FOLDERS = ['images', 'videos', 'documents'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Logical folder taxonomy — derived from real cross-referenced data
// ─────────────────────────────────────────────────────────────────────────────

type LogicalFolder =
  | 'Course Thumbnails' | 'Course Videos' | 'Reading Material' | 'Assignments' | 'Certificates'
  | 'Company Logos' | 'Branding Assets' | 'Profile Photos' | 'Temporary Uploads';

const LOGICAL_FOLDERS: LogicalFolder[] = [
  'Course Thumbnails', 'Course Videos', 'Reading Material', 'Assignments', 'Certificates',
  'Company Logos', 'Branding Assets', 'Profile Photos', 'Temporary Uploads',
];

type FileKind = 'image' | 'video' | 'document' | 'other';

interface FileEntry {
  path:         string;
  name:         string;
  publicUrl:    string;
  folder:       LogicalFolder;
  physicalDir:  string;
  kind:         FileKind;
  sizeBytes:    number;
  createdAt:    string;
  uploadedBy:   string;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function kindFromExt(name: string): FileKind {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm'].includes(ext)) return 'video';
  if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip'].includes(ext)) return 'document';
  return 'other';
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons + shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
function IconUpload({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
function IconTrash({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
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
function IconX({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}
function IconImage({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M8.25 6.75h.008v.008H8.25V6.75Z" />
    </svg>
  );
}
function IconVideo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5 19.5 7.5v9l-3.75-3M4.5 6.75h9a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5v-7.5a1.5 1.5 0 0 1 1.5-1.5Z" />
    </svg>
  );
}
function IconDoc({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
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

function PrimaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}
function SecondaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}
function DangerButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function FileKindIcon({ kind, className }: { kind: FileKind; className?: string }) {
  if (kind === 'image') return <IconImage className={className} />;
  if (kind === 'video') return <IconVideo className={className} />;
  return <IconDoc className={className} />;
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load storage</p>
      <p className="mt-1">{message}</p>
      <SecondaryButton onClick={onRetry} className="mt-4 px-4 py-2 text-sm">Try Again</SecondaryButton>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-19.5 0v6a2.25 2.25 0 0 0 2.25 2.25h15a2.25 2.25 0 0 0 2.25-2.25v-6m-19.5 0h19.5" />
      </svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main StorageManager
// ─────────────────────────────────────────────────────────────────────────────

function StorageManager() {
  const user = getCurrentUser();

  const [courses, setCourses] = useState<Course[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [folderFilter, setFolderFilter] = useState<'all' | LogicalFolder>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | FileKind>('all');
  const [uploaderFilter, setUploaderFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | FileEntry[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busyPath, setBusyPath] = useState('');
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2600);
  }

  function classify(publicUrl: string, physicalDir: string): { folder: LogicalFolder; uploadedBy: string } {
    const course = courses.find((c) => c.thumbnail === publicUrl);
    if (course) {
      const emp = employees.find((e) => e.id === course.created_by);
      return { folder: 'Course Thumbnails', uploadedBy: emp ? `${emp.first_name} ${emp.last_name}` : '—' };
    }
    const company = companies.find((c) => c.logo === publicUrl || c.favicon === publicUrl);
    if (company) return { folder: 'Company Logos', uploadedBy: '—' };

    const certificate = certificates.find((c) => c.certificate_url === publicUrl || c.qr_code_url === publicUrl);
    if (certificate) {
      const emp = employees.find((e) => e.id === certificate.employee_id);
      return { folder: 'Certificates', uploadedBy: emp ? `${emp.first_name} ${emp.last_name}` : '—' };
    }

    const resource = resources.find((r) => r.file_url === publicUrl);
    if (resource) {
      const lesson = lessons.find((l) => l.id === resource.lesson_id);
      return { folder: lesson?.lesson_type === 'assignment' ? 'Assignments' : 'Reading Material', uploadedBy: '—' };
    }

    if (physicalDir === 'videos') return { folder: 'Course Videos', uploadedBy: '—' };
    if (physicalDir === 'images') return { folder: 'Branding Assets', uploadedBy: '—' };
    return { folder: 'Temporary Uploads', uploadedBy: '—' };
  }

  async function fetchAll() {
    setLoading(true);
    setError('');
    try {
      const [courseRows, companyRows, certificateRows, resourceRows, lessonRows, employeeRows] = await Promise.all([
        loadCourses(), loadCompanies(), loadCertificates(), loadResources(), loadLessons(), employeeService.getAll(),
      ]);
      setCourses(courseRows);
      setCompanies(companyRows);
      setCertificates(certificateRows);
      setResources(resourceRows);
      setLessons(lessonRows);
      setEmployees(employeeRows);

      const allFiles: FileEntry[] = [];
      for (const dir of PHYSICAL_FOLDERS) {
        const { data, error: listError } = await supabase.storage.from(BUCKET).list(dir, {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' },
        });
        if (listError) continue;
        (data ?? []).forEach((obj) => {
          if (!obj.name || obj.id === null) return;
          const path = `${dir}/${obj.name}`;
          const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
          const { folder, uploadedBy } = classify(urlData.publicUrl, dir);
          allFiles.push({
            path,
            name: obj.name,
            publicUrl: urlData.publicUrl,
            folder,
            physicalDir: dir,
            kind: kindFromExt(obj.name),
            sizeBytes: (obj.metadata as { size?: number } | null)?.size ?? 0,
            createdAt: obj.created_at ?? '',
            uploadedBy,
          });
        });
      }
      setFiles(allFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storage.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── File actions ─────────────────────────────────────────────────────────────

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const kind = kindFromExt(file.name);
      if (kind === 'image') await uploadImage(file);
      else if (kind === 'video') await uploadVideo(file);
      else if (kind === 'document') await uploadDocument(file);
      else throw new Error('Unsupported file type.');
      await fetchAll();
      showToast('File uploaded');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleReplace(target: FileEntry, file: File) {
    setBusyPath(target.path);
    try {
      const kind = kindFromExt(file.name);
      let result;
      if (kind === 'image') result = await uploadImage(file);
      else if (kind === 'video') result = await uploadVideo(file);
      else if (kind === 'document') result = await uploadDocument(file);
      else throw new Error('Unsupported file type.');

      if (target.folder === 'Course Thumbnails') {
        const course = courses.find((c) => c.thumbnail === target.publicUrl);
        if (course && result) await saveCourse(course.id, { thumbnail: result.url });
      } else if (target.folder === 'Company Logos') {
        const company = companies.find((c) => c.logo === target.publicUrl || c.favicon === target.publicUrl);
        if (company && result) {
          if (company.logo === target.publicUrl) await saveCompany(company.id, { logo: result.url });
          else await saveCompany(company.id, { favicon: result.url });
        }
      }
      await supabase.storage.from(BUCKET).remove([target.path]);
      await fetchAll();
      showToast('File replaced');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Replace failed.');
    } finally {
      setBusyPath('');
    }
  }

  async function handleRenameConfirm() {
    if (!renameTarget || !renameValue.trim()) return;
    setBusyPath(renameTarget.path);
    try {
      const newPath = `${renameTarget.physicalDir}/${renameValue.trim()}`;
      const { error: moveError } = await supabase.storage.from(BUCKET).move(renameTarget.path, newPath);
      if (moveError) throw new Error(moveError.message);
      setRenameTarget(null);
      await fetchAll();
      showToast('File renamed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Rename failed — storage permissions may not allow this yet.');
    } finally {
      setBusyPath('');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const targets = Array.isArray(deleteTarget) ? deleteTarget : [deleteTarget];
    setDeleting(true);
    try {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove(targets.map((t) => t.path));
      if (removeError) throw new Error(removeError.message);
      setDeleteTarget(null);
      setSelectedPaths(new Set());
      await fetchAll();
      showToast(`Deleted ${targets.length} file(s)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed — storage permissions may not allow this yet.');
    } finally {
      setDeleting(false);
    }
  }

  function handleDownload(file: FileEntry) {
    const a = document.createElement('a');
    a.href = file.publicUrl;
    a.download = file.name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function handleBulkDownload() {
    files.filter((f) => selectedPaths.has(f.path)).forEach((f) => handleDownload(f));
  }

  async function handleCopyUrl(file: FileEntry) {
    try {
      await navigator.clipboard.writeText(file.publicUrl);
      showToast('URL copied');
    } catch {
      showToast('Could not copy — copy manually.');
    }
  }

  function handleOpen(file: FileEntry) {
    window.open(file.publicUrl, '_blank', 'noopener,noreferrer');
  }

  async function handleMoveSelected(targetDir: string) {
    const targets = files.filter((f) => selectedPaths.has(f.path));
    let moved = 0;
    for (const f of targets) {
      const newPath = `${targetDir}/${f.name}`;
      const { error: moveError } = await supabase.storage.from(BUCKET).move(f.path, newPath);
      if (!moveError) moved += 1;
    }
    setSelectedPaths(new Set());
    await fetchAll();
    showToast(`Moved ${moved} of ${targets.length} file(s)`);
  }

  function toggleSelected(path: string) {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }

  // ── Filtering / summary ──────────────────────────────────────────────────────

  const uploaderNames = useMemo(() => Array.from(new Set(files.map((f) => f.uploadedBy).filter((n) => n !== '—'))), [files]);
  const searchTerm = search.trim().toLowerCase();

  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      if (folderFilter !== 'all' && f.folder !== folderFilter) return false;
      if (typeFilter !== 'all' && f.kind !== typeFilter) return false;
      if (uploaderFilter !== 'all' && f.uploadedBy !== uploaderFilter) return false;
      if (dateFrom && new Date(f.createdAt).getTime() < new Date(dateFrom).getTime()) return false;
      if (dateTo && new Date(f.createdAt).getTime() > new Date(dateTo).getTime() + 86400000) return false;
      if (searchTerm && !f.name.toLowerCase().includes(searchTerm)) return false;
      return true;
    });
  }, [files, folderFilter, typeFilter, uploaderFilter, dateFrom, dateTo, searchTerm]);

  const summary = useMemo(() => {
    const totalBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
    return {
      total: files.length,
      used: formatBytes(totalBytes),
      images: files.filter((f) => f.kind === 'image').length,
      videos: files.filter((f) => f.kind === 'video').length,
      documents: files.filter((f) => f.kind === 'document').length,
    };
  }, [files]);

  const folderCounts = useMemo(() => {
    const map = new Map<LogicalFolder, number>();
    files.forEach((f) => map.set(f.folder, (map.get(f.folder) ?? 0) + 1));
    return map;
  }, [files]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  const allSelected = filteredFiles.length > 0 && filteredFiles.every((f) => selectedPaths.has(f.path));

  return (
    <div className="space-y-6">

      {/* TOP SUMMARY */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        <SummaryCard label="Total Files" value={summary.total} accent="border-slate-200" />
        <SummaryCard label="Storage Used" value={summary.used} accent="border-indigo-200" />
        <SummaryCard label="Available Storage" value="Not tracked" accent="border-slate-200" />
        <SummaryCard label="Images" value={summary.images} accent="border-blue-200" />
        <SummaryCard label="Videos" value={summary.videos} accent="border-amber-200" />
        <SummaryCard label="Documents" value={summary.documents} accent="border-emerald-200" />
      </div>

      {/* FILTERS + UPLOAD */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search filename…" className="min-w-[180px] flex-1 rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | FileKind)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="document">Documents</option>
        </select>
        <select value={uploaderFilter} onChange={(e) => setUploaderFilter(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Uploaders</option>
          {uploaderNames.map((n) => (<option key={n} value={n}>{n}</option>))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
        <span className="text-xs text-slate-400">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
        <PrimaryButton onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <IconSpinner className="h-3.5 w-3.5" /> : <IconUpload className="h-3.5 w-3.5" />} Upload
        </PrimaryButton>
        {user && <span className="text-xs text-slate-400">as {user.firstName} {user.lastName}</span>}
        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleUpload(f); }} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">

        {/* FOLDER SIDEBAR */}
        <aside className="rounded-2xl bg-white p-3 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <button
            onClick={() => setFolderFilter('all')}
            className={`mb-1 flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition ${folderFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            All Files <span className="text-xs opacity-75">{files.length}</span>
          </button>
          {LOGICAL_FOLDERS.map((folder) => (
            <button
              key={folder}
              onClick={() => setFolderFilter(folder)}
              className={`mb-1 flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition ${folderFilter === folder ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <span className="truncate">{folder}</span>
              <span className="flex-shrink-0 text-xs opacity-75">{folderCounts.get(folder) ?? 0}</span>
            </button>
          ))}
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-400">
            Categories are inferred from real usage where possible; unmatched files appear as Temporary Uploads.
          </p>
        </aside>

        {/* FILE GRID */}
        <div className="space-y-4">
          {selectedPaths.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-indigo-50 p-3">
              <span className="text-sm font-semibold text-indigo-700">{selectedPaths.size} selected</span>
              <SecondaryButton onClick={handleBulkDownload}>Download</SecondaryButton>
              <select onChange={(e) => { if (e.target.value) { void handleMoveSelected(e.target.value); e.target.value = ''; } }} defaultValue="" className="rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm">
                <option value="">Move to…</option>
                {PHYSICAL_FOLDERS.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
              <DangerButton onClick={() => setDeleteTarget(files.filter((f) => selectedPaths.has(f.path)))}>
                <IconTrash /> Delete
              </DangerButton>
              <SecondaryButton onClick={() => setSelectedPaths(new Set())}>Clear</SecondaryButton>
            </div>
          )}

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            {filteredFiles.length === 0 ? (
              <EmptyState message="No files match these filters yet." />
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setSelectedPaths(allSelected ? new Set() : new Set(filteredFiles.map((f) => f.path)))}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400"
                  />
                  <span className="text-xs font-semibold text-slate-400">Select All</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredFiles.map((f) => (
                    <div key={f.path} className="group relative rounded-2xl border border-slate-100 p-3 transition hover:shadow-md">
                      <div className="mb-2 flex items-start justify-between">
                        <input
                          type="checkbox"
                          checked={selectedPaths.has(f.path)}
                          onChange={() => toggleSelected(f.path)}
                          className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400"
                        />
                        <button onClick={() => setPreviewFile(f)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600">
                          <IconEye />
                        </button>
                      </div>

                      <button onClick={() => setPreviewFile(f)} className="mb-2 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-50">
                        {f.kind === 'image' ? (
                          <img src={f.publicUrl} alt={f.name} className="h-full w-full object-cover" />
                        ) : (
                          <FileKindIcon kind={f.kind} className="h-8 w-8 text-slate-300" />
                        )}
                      </button>

                      <p className="truncate text-sm font-semibold text-slate-800">{f.name}</p>
                      <p className="truncate text-xs text-slate-400">{f.folder}</p>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{formatBytes(f.sizeBytes)}</span>
                        <span>{f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '—'}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">By {f.uploadedBy}</p>

                      <div className="mt-2 flex flex-wrap gap-1">
                        <SecondaryButton onClick={() => handleDownload(f)}>Download</SecondaryButton>
                        <SecondaryButton onClick={() => handleCopyUrl(f)}>Copy URL</SecondaryButton>
                        <SecondaryButton onClick={() => handleOpen(f)}>Open</SecondaryButton>
                        <label className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50">
                          {busyPath === f.path ? <IconSpinner className="h-3 w-3" /> : <IconDuplicate />} Replace
                          <input type="file" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void handleReplace(f, file); }} />
                        </label>
                        <SecondaryButton onClick={() => { setRenameTarget(f); setRenameValue(f.name); }}>Rename</SecondaryButton>
                        <DangerButton onClick={() => setDeleteTarget(f)}><IconTrash /> Delete</DangerButton>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setPreviewFile(null)} />
          <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="truncate text-lg font-bold text-slate-900">{previewFile.name}</h3>
              <button onClick={() => setPreviewFile(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><IconX /></button>
            </div>
            <div className="flex items-center justify-center rounded-xl bg-slate-50 p-4">
              {previewFile.kind === 'image' && <img src={previewFile.publicUrl} alt={previewFile.name} className="max-h-[60vh] rounded-lg object-contain" />}
              {previewFile.kind === 'video' && <video src={previewFile.publicUrl} controls className="max-h-[60vh] w-full rounded-lg" />}
              {previewFile.kind === 'document' && previewFile.name.toLowerCase().endsWith('.pdf') && (
                <iframe src={previewFile.publicUrl} title={previewFile.name} className="h-[60vh] w-full rounded-lg" />
              )}
              {previewFile.kind === 'document' && !previewFile.name.toLowerCase().endsWith('.pdf') && (
                <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                  <IconDoc className="h-10 w-10" />
                  <p className="text-sm">No inline preview for this file type.</p>
                  <SecondaryButton onClick={() => handleOpen(previewFile)}>Open File</SecondaryButton>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <SecondaryButton onClick={() => handleDownload(previewFile)}>Download</SecondaryButton>
              <SecondaryButton onClick={() => handleCopyUrl(previewFile)}>Copy URL</SecondaryButton>
              <SecondaryButton onClick={() => handleOpen(previewFile)}>Open</SecondaryButton>
            </div>
          </div>
        </div>
      )}

      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setRenameTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Rename File</h3>
            <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="mb-4 w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setRenameTarget(null)} className="px-4 py-2 text-sm">Cancel</SecondaryButton>
              <PrimaryButton onClick={handleRenameConfirm} disabled={busyPath === renameTarget.path} className="px-4 py-2 text-sm">
                {busyPath === renameTarget.path ? <IconSpinner className="h-3.5 w-3.5" /> : null} Rename
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-slate-900">Delete {Array.isArray(deleteTarget) ? `${deleteTarget.length} Files` : 'File'}</h3>
            <p className="mb-5 text-sm text-slate-500">This permanently removes the file(s) from storage. Continue?</p>
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm" disabled={deleting}>Cancel</SecondaryButton>
              <DangerButton onClick={handleDeleteConfirm} disabled={deleting} className="px-4 py-2 text-sm">
                {deleting ? <IconSpinner className="h-3.5 w-3.5" /> : <IconTrash />} Delete
              </DangerButton>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default StorageManager;
