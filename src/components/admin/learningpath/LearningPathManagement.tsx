// src/components/admin/learningpath/LearningPathManagement.tsx
//
// Professional Learning Path Management — reuses only existing, unmodified
// architecture. The backend for Learning Paths is already complete:
//   learningPathService           (LearningPath: name/description/
//                                  thumbnail/duration/difficulty/active/
//                                  published/display_order)
//   learningPathCourseService     (sequencing: sequence_no, mandatory,
//                                  unlock_previous — Sequential Learning)
//   learningPathEnrollmentService (targeting hierarchy: company/branch/
//                                  department/designation/employee,
//                                  mandatory, completion_required, status)
//   learningPathProgressService   (completed_courses/total_courses/
//                                  progress_percentage/status — real
//                                  Progress numbers)
// plus the existing company/branch/department/designation/employee/course
// services for every filter, target list, and joined display name.
//
// No repository/service/database changes. "Minimum Score" per course has
// no backing column anywhere, so it is kept as clearly-labelled,
// session-local UI state only — nothing fake is persisted.

import { useEffect, useMemo, useState } from 'react';

import {
  loadLearningPaths,
  createLearningPath,
  saveLearningPath,
  removeLearningPath,
  toggleActive as toggleLearningPathActive,
  togglePublished,
} from '../../../services/learningPath/learningPathService';
import {
  loadLearningPathCourses,
  createLearningPathCourse,
  saveLearningPathCourse,
  removeLearningPathCourse,
} from '../../../services/learningPathCourse/learningPathCourseService';
import {
  loadEnrollments as loadPathEnrollments,
  createEnrollment as createPathEnrollment,
  removeEnrollment as removePathEnrollment,
} from '../../../services/learningPathEnrollment/learningPathEnrollmentService';
import { loadProgress } from '../../../services/learningPathProgress/learningPathProgressService';

import { loadCompanies } from '../../../services/company/companyService';
import { branchService } from '../../../services/branch/branchService';
import { departmentService } from '../../../services/department/departmentService';
import { designationService } from '../../../services/designation/designationService';
import { employeeService } from '../../../services/employee/employeeService';
import { loadCourses } from '../../../services/course/courseService';
import { uploadImage } from '../../../services/contentEditor/contentEditorService';

import type { LearningPath, LearningPathForm, DifficultyLevel } from '../../../types/learningPath';
import type { LearningPathCourse, LearningPathCourseForm } from '../../../types/learningPathCourse';
import type { LearningPathEnrollment, EnrollmentType as PathEnrollmentType } from '../../../types/learningPathEnrollment';
import type { LearningPathProgress } from '../../../types/learningPathProgress';
import type { Company } from '../../../types/company';
import type { Branch } from '../../../types/branch';
import type { Department } from '../../../types/department';
import type { Designation } from '../../../types/designation';
import type { Employee } from '../../../types/employee';
import type { Course } from '../../../types/course';

// ─────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG only)
// ─────────────────────────────────────────────────────────────────────────────

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
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
function IconTrash({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
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
function IconUpload({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
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

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <IconSpinner className={className} />;
}

function PrimaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
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

function AccentButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
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

function SecondaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
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

function DangerButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
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

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition ${on ? 'bg-indigo-600' : 'bg-slate-300'}`}
    >
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

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load learning path data</p>
      <p className="mt-1">{message}</p>
      <SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292v-14.25" />
      </svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

function ConfirmDialog({
  title, message, busy, confirmLabel, onConfirm, onCancel,
}: { title: string; message: string; busy: boolean; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={!busy ? onCancel : undefined} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-1 text-lg font-bold text-slate-900">{title}</h3>
        <p className="mb-5 text-sm text-slate-500">{message}</p>
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onCancel} disabled={busy}>Cancel</SecondaryButton>
          <DangerButton onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner className="h-3.5 w-3.5" /> : <IconTrash />} {confirmLabel}
          </DangerButton>
        </div>
      </div>
    </div>
  );
}

function PreviewDialog({ path, courses, onClose }: { path: LearningPath; courses: { name: string; mandatory: boolean }[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Preview</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><IconX className="h-4 w-4" /></button>
        </div>
        {path.thumbnail_url && <img src={path.thumbnail_url} alt="" className="mb-4 h-40 w-full rounded-xl object-cover" />}
        <h4 className="text-xl font-bold text-slate-800">{path.path_name}</h4>
        <p className="mt-1 text-sm text-slate-500">{path.description}</p>
        <p className="mt-2 text-xs text-slate-400">{path.estimated_duration}h · {path.difficulty_level}</p>
        <div className="mt-5 space-y-1.5">
          {courses.map((c, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-700">{i + 1}. {c.name}</span>
              <span className={`text-xs font-semibold ${c.mandatory ? 'text-indigo-600' : 'text-slate-400'}`}>{c.mandatory ? 'Mandatory' : 'Optional'}</span>
            </div>
          ))}
          {courses.length === 0 && <p className="text-sm text-slate-400">No courses added yet.</p>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main LearningPathManagement
// ─────────────────────────────────────────────────────────────────────────────

const DIFFICULTY_OPTIONS: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced'];

function pathStatusLabel(path: LearningPath): 'Archived' | 'Published' | 'Draft' {
  if (!path.active) return 'Archived';
  if (path.published) return 'Published';
  return 'Draft';
}

function pathStatusStyles(path: LearningPath): string {
  const label = pathStatusLabel(path);
  if (label === 'Published') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (label === 'Archived') return 'bg-slate-100 text-slate-500 ring-1 ring-slate-200';
  return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
}

function LearningPathManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [pathCourses, setPathCourses] = useState<LearningPathCourse[]>([]);
  const [pathEnrollments, setPathEnrollments] = useState<LearningPathEnrollment[]>([]);
  const [pathProgress, setPathProgress] = useState<LearningPathProgress[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all');
  const [activePathId, setActivePathId] = useState('');

  const [creatingPath, setCreatingPath] = useState(false);
  const [savingField, setSavingField] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LearningPath | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [courseSearch, setCourseSearch] = useState('');
  const [minimumScoreById, setMinimumScoreById] = useState<Record<string, number>>({});
  const [busyCourseId, setBusyCourseId] = useState('');

  const [assignType, setAssignType] = useState<PathEnrollmentType>('employee');
  const [assignTargetId, setAssignTargetId] = useState('');
  const [assignMandatory, setAssignMandatory] = useState(false);
  const [assignCompletionRequired, setAssignCompletionRequired] = useState(false);
  const [assigning, setAssigning] = useState(false);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([
      loadCompanies(),
      branchService.getAll(),
      departmentService.getAll(),
      designationService.getAll(),
      employeeService.getAll(),
      loadCourses(),
      loadLearningPaths(),
      loadLearningPathCourses(),
      loadPathEnrollments(),
      loadProgress(),
    ])
      .then(([companyRows, branchRows, departmentRows, designationRows, employeeRows, courseRows, pathRows, pathCourseRows, enrollmentRows, progressRows]) => {
        setCompanies(companyRows);
        setBranches(branchRows);
        setDepartments(departmentRows);
        setDesignations(designationRows);
        setEmployees(employeeRows);
        setCourses(courseRows);
        setPaths(pathRows);
        setPathCourses(pathCourseRows);
        setPathEnrollments(enrollmentRows);
        setPathProgress(progressRows);
        setActivePathId((prev) => prev || pathRows[0]?.id || '');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load learning path data.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  // ── Derived lookups ──────────────────────────────────────────────────────────

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const activePath = paths.find((p) => p.id === activePathId) ?? null;

  const filteredPaths = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return paths.filter((p) => {
      const matchesSearch = !kw || p.path_name.toLowerCase().includes(kw) || p.path_code.toLowerCase().includes(kw);
      const label = pathStatusLabel(p).toLowerCase();
      const matchesStatus = statusFilter === 'all' || label === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [paths, search, statusFilter]);

  const assignedCourses = useMemo(
    () => pathCourses.filter((pc) => pc.learning_path_id === activePathId).sort((a, b) => a.sequence_no - b.sequence_no),
    [pathCourses, activePathId]
  );

  const availableCourses = useMemo(() => {
    const assignedIds = new Set(assignedCourses.map((pc) => pc.course_id));
    const kw = courseSearch.trim().toLowerCase();
    return courses.filter((c) => c.active && !assignedIds.has(c.id) && (!kw || c.course_name.toLowerCase().includes(kw)));
  }, [courses, assignedCourses, courseSearch]);

  const pathEnrollmentsForActive = useMemo(
    () => pathEnrollments.filter((e) => e.learning_path_id === activePathId),
    [pathEnrollments, activePathId]
  );

  const pathProgressForActive = useMemo(
    () => pathProgress.filter((p) => p.learning_path_id === activePathId),
    [pathProgress, activePathId]
  );

  const progressStats = useMemo(() => {
    const totalEmployees = pathEnrollmentsForActive.length;
    const started = pathProgressForActive.filter((p) => p.status !== 'not_started').length;
    const inProgress = pathProgressForActive.filter((p) => p.status === 'in_progress').length;
    const completed = pathProgressForActive.filter((p) => p.status === 'completed').length;
    const avgProgress = pathProgressForActive.length > 0
      ? Math.round(pathProgressForActive.reduce((sum, p) => sum + p.progress_percentage, 0) / pathProgressForActive.length)
      : 0;
    return { totalEmployees, started, inProgress, completed, avgProgress };
  }, [pathEnrollmentsForActive, pathProgressForActive]);

  // ── Top summary (across all learning paths) ─────────────────────────────────

  const topSummary = useMemo(() => {
    const total = paths.length;
    const published = paths.filter((p) => p.active && p.published).length;
    const draft = paths.filter((p) => p.active && !p.published).length;
    const employeesAssigned = new Set(pathEnrollments.map((e) => e.employee_id)).size;
    const completed = pathProgress.filter((p) => p.status === 'completed').length;
    return { total, published, draft, employeesAssigned, completed };
  }, [paths, pathEnrollments, pathProgress]);

  // ── Learning Path CRUD ───────────────────────────────────────────────────────

  async function handleCreatePath() {
    setCreatingPath(true);
    try {
      const created = await createLearningPath({
        path_code: `LP-${Date.now().toString(36).toUpperCase()}`,
        path_name: 'Untitled Learning Path',
        description: '',
        thumbnail_url: '',
        estimated_duration: 0,
        difficulty_level: 'beginner',
        prerequisite_path_id: null,
        certificate_template_id: null,
        active: true,
        published: false,
        display_order: paths.length + 1,
      });
      fetchAll();
      setActivePathId(created.id);
      showToast('Learning path created');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create learning path.');
    } finally {
      setCreatingPath(false);
    }
  }

  async function handleDuplicatePath(path: LearningPath) {
    try {
      const created = await createLearningPath({
        path_code: `LP-${Date.now().toString(36).toUpperCase()}`,
        path_name: `${path.path_name} (Copy)`,
        description: path.description,
        thumbnail_url: path.thumbnail_url,
        estimated_duration: path.estimated_duration,
        difficulty_level: path.difficulty_level,
        prerequisite_path_id: path.prerequisite_path_id,
        certificate_template_id: path.certificate_template_id,
        active: true,
        published: false,
        display_order: paths.length + 1,
      });

      const sourceCourses = pathCourses.filter((pc) => pc.learning_path_id === path.id);
      for (const pc of sourceCourses) {
        await createLearningPathCourse({
          learning_path_id: created.id,
          course_id: pc.course_id,
          sequence_no: pc.sequence_no,
          mandatory: pc.mandatory,
          unlock_previous: pc.unlock_previous,
          estimated_duration: pc.estimated_duration,
          active: pc.active,
        });
      }

      fetchAll();
      setActivePathId(created.id);
      showToast('Learning path duplicated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to duplicate learning path.');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeLearningPath(deleteTarget.id);
      if (activePathId === deleteTarget.id) setActivePathId('');
      setDeleteTarget(null);
      fetchAll();
      showToast('Learning path deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete learning path.');
    } finally {
      setDeleting(false);
    }
  }

  function toLearningPathForm(p: LearningPath): LearningPathForm {
    return {
      path_code:               p.path_code,
      path_name:               p.path_name,
      description:             p.description,
      thumbnail_url:           p.thumbnail_url,
      estimated_duration:      p.estimated_duration,
      difficulty_level:        p.difficulty_level,
      prerequisite_path_id:    p.prerequisite_path_id,
      certificate_template_id: p.certificate_template_id,
      active:                  p.active,
      published:               p.published,
      display_order:           p.display_order,
    };
  }

  function toLearningPathCourseForm(pc: LearningPathCourse): LearningPathCourseForm {
    return {
      learning_path_id:   pc.learning_path_id,
      course_id:          pc.course_id,
      sequence_no:        pc.sequence_no,
      mandatory:          pc.mandatory,
      unlock_previous:    pc.unlock_previous,
      estimated_duration: pc.estimated_duration,
      active:             pc.active,
    };
  }

  async function updatePathField(patch: Partial<LearningPathForm>) {
    if (!activePath) return;
    setSavingField(true);
    try {
      const merged: LearningPathForm = { ...toLearningPathForm(activePath), ...patch };
      await saveLearningPath(activePath.id, merged);
      fetchAll();
      showToast('Saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSavingField(false);
    }
  }

  async function handleThumbnailUpload(file: File) {
    if (!activePath) return;
    setUploadingThumbnail(true);
    try {
      const result = await uploadImage(file);
      const merged: LearningPathForm = { ...toLearningPathForm(activePath), thumbnail_url: result.url };
      await saveLearningPath(activePath.id, merged);
      fetchAll();
      showToast('Thumbnail updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Thumbnail upload failed.');
    } finally {
      setUploadingThumbnail(false);
    }
  }

  async function handleTogglePublish() {
    if (!activePath) return;
    try {
      await togglePublished(activePath.id, !activePath.published);
      fetchAll();
      showToast(activePath.published ? 'Unpublished' : 'Published');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update publish state.');
    }
  }

  async function handleToggleArchive() {
    if (!activePath) return;
    try {
      await toggleLearningPathActive(activePath.id, !activePath.active);
      fetchAll();
      showToast(activePath.active ? 'Archived' : 'Restored');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update archive state.');
    }
  }

  // ── Course Builder ───────────────────────────────────────────────────────────

  async function handleAddCourse(courseId: string) {
    if (!activePath) return;
    try {
      await createLearningPathCourse({
        learning_path_id: activePath.id,
        course_id: courseId,
        sequence_no: assignedCourses.length + 1,
        mandatory: false,
        unlock_previous: false,
        estimated_duration: 0,
        active: true,
      });
      fetchAll();
      showToast('Course added');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add course.');
    }
  }

  async function handleRemoveCourse(pc: LearningPathCourse) {
    try {
      await removeLearningPathCourse(pc.id);
      fetchAll();
      showToast('Course removed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove course.');
    }
  }

  async function handleMoveCourse(pc: LearningPathCourse, direction: 'up' | 'down') {
    const index = assignedCourses.findIndex((c) => c.id === pc.id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= assignedCourses.length) return;
    const target = assignedCourses[targetIndex];
    setBusyCourseId(pc.id);
    try {
      await Promise.all([
        saveLearningPathCourse(pc.id, { ...toLearningPathCourseForm(pc), sequence_no: target.sequence_no }),
        saveLearningPathCourse(target.id, { ...toLearningPathCourseForm(target), sequence_no: pc.sequence_no }),
      ]);
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reorder courses.');
    } finally {
      setBusyCourseId('');
    }
  }

  async function handleToggleMandatory(pc: LearningPathCourse) {
    try {
      await saveLearningPathCourse(pc.id, { ...toLearningPathCourseForm(pc), mandatory: !pc.mandatory });
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update course.');
    }
  }

  async function handleToggleSequential(pc: LearningPathCourse) {
    try {
      await saveLearningPathCourse(pc.id, { ...toLearningPathCourseForm(pc), unlock_previous: !pc.unlock_previous });
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update course.');
    }
  }

  function setMinimumScore(pathCourseId: string, score: number) {
    setMinimumScoreById((prev) => ({ ...prev, [pathCourseId]: score }));
  }

  // ── Assignment ───────────────────────────────────────────────────────────────

  function resolveAssignTargets(): Employee[] {
    if (assignType === 'employee') {
      return employees.filter((e) => e.id === assignTargetId);
    }
    if (assignType === 'company') {
      return employees.filter((e) => e.company_id === assignTargetId);
    }
    if (assignType === 'branch') {
      return employees.filter((e) => e.branch_id === assignTargetId);
    }
    if (assignType === 'department') {
      return employees.filter((e) => e.department_id === assignTargetId);
    }
    if (assignType === 'designation') {
      return employees.filter((e) => e.designation_id === assignTargetId);
    }
    return [];
  }

  async function handleAssign() {
    if (!activePath || !assignTargetId) return;
    setAssigning(true);
    try {
      const targets = resolveAssignTargets();
      let count = 0;
      for (const emp of targets) {
        const already = pathEnrollmentsForActive.some((e) => e.employee_id === emp.id);
        if (already) continue;
        await createPathEnrollment({
          learning_path_id: activePath.id,
          company_id: emp.company_id,
          branch_id: emp.branch_id,
          department_id: emp.department_id,
          designation_id: emp.designation_id,
          employee_id: emp.id,
          enrollment_type: assignType,
          enrolled_date: new Date().toISOString(),
          start_date: '',
          end_date: '',
          mandatory: assignMandatory,
          active: true,
          completion_required: assignCompletionRequired,
          status: 'assigned',
          remarks: '',
        });
        count += 1;
      }
      fetchAll();
      setAssignTargetId('');
      showToast(`Assigned to ${count} employee(s)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign learning path.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemoveAssignment(enrollment: LearningPathEnrollment) {
    try {
      await removePathEnrollment(enrollment.id);
      fetchAll();
      showToast('Assignment removed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove assignment.');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">

      {/* TOP SUMMARY */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SummaryCard label="Total Learning Paths" value={topSummary.total} accent="border-slate-200" />
        <SummaryCard label="Published" value={topSummary.published} accent="border-emerald-200" />
        <SummaryCard label="Draft" value={topSummary.draft} accent="border-amber-200" />
        <SummaryCard label="Employees Assigned" value={topSummary.employeesAssigned} accent="border-blue-200" />
        <SummaryCard label="Completed" value={topSummary.completed} accent="border-indigo-200" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">

        {/* LEFT PANEL */}
        <div className="rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">Learning Paths</p>
            <PrimaryButton onClick={handleCreatePath} disabled={creatingPath} className="px-2.5 py-1.5 text-xs">
              {creatingPath ? <Spinner className="h-3.5 w-3.5" /> : <IconPlus className="h-3.5 w-3.5" />} New
            </PrimaryButton>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search learning path…"
            className={`${INPUT_CLS} mb-2`}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className={`${INPUT_CLS} mb-3`}
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>

          {filteredPaths.length === 0 ? (
            <EmptyState message="No learning paths match these filters." />
          ) : (
            <div className="max-h-[500px] space-y-1 overflow-y-auto">
              {filteredPaths.map((p) => (
                <div
                  key={p.id}
                  className={`group flex items-center gap-1 rounded-xl px-2 py-2 transition ${activePathId === p.id ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}
                >
                  <button onClick={() => setActivePathId(p.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium text-slate-800">{p.path_name}</p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${pathStatusStyles(p)}`}>
                      {pathStatusLabel(p)}
                    </span>
                  </button>
                  <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => handleDuplicatePath(p)} title="Duplicate" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600">
                      <IconDuplicate />
                    </button>
                    <button onClick={() => setDeleteTarget(p)} title="Delete" className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <IconTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CENTER */}
        <div className="space-y-6">
          {!activePath ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <EmptyState message="Select or create a learning path to begin." />
            </div>
          ) : (
            <>
              {/* Builder */}
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${pathStatusStyles(activePath)}`}>
                    {pathStatusLabel(activePath)}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {savingField && <span className="flex items-center gap-1.5 text-xs text-slate-400"><Spinner className="h-3.5 w-3.5" /> Saving…</span>}
                    <SecondaryButton onClick={() => setPreviewOpen(true)}><IconEye className="h-3.5 w-3.5" /> Preview</SecondaryButton>
                    <AccentButton onClick={handleTogglePublish}>{activePath.published ? 'Unpublish' : 'Publish'}</AccentButton>
                    <SecondaryButton onClick={handleToggleArchive}>{activePath.active ? 'Archive' : 'Restore'}</SecondaryButton>
                    <DangerButton onClick={() => setDeleteTarget(activePath)}>Delete</DangerButton>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Learning Path Name">
                    <input key={`${activePath.id}-name`} defaultValue={activePath.path_name} onBlur={(e) => updatePathField({ path_name: e.target.value })} className={INPUT_CLS} />
                  </Field>
                  <Field label="Difficulty">
                    <select value={activePath.difficulty_level} onChange={(e) => updatePathField({ difficulty_level: e.target.value as DifficultyLevel })} className={INPUT_CLS}>
                      {DIFFICULTY_OPTIONS.map((d) => (<option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>))}
                    </select>
                  </Field>
                  <Field label="Estimated Duration (hours)">
                    <input key={`${activePath.id}-dur`} type="number" min={0} defaultValue={activePath.estimated_duration} onBlur={(e) => updatePathField({ estimated_duration: Number(e.target.value) })} className={INPUT_CLS} />
                  </Field>
                  <Field label="Certificate Template ID">
                    <input
                      key={`${activePath.id}-cert`}
                      defaultValue={activePath.certificate_template_id ?? ''}
                      onBlur={(e) => updatePathField({ certificate_template_id: e.target.value || null })}
                      placeholder="Optional"
                      className={INPUT_CLS}
                    />
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label="Description">
                    <textarea key={`${activePath.id}-desc`} defaultValue={activePath.description} onBlur={(e) => updatePathField({ description: e.target.value })} rows={3} className={`${INPUT_CLS} resize-none`} />
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label="Thumbnail">
                    <div className="flex items-center gap-3">
                      {activePath.thumbnail_url ? (
                        <img src={activePath.thumbnail_url} alt="" className="h-16 w-24 flex-shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-300"><IconUpload className="h-5 w-5" /></div>
                      )}
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50">
                        {uploadingThumbnail ? <Spinner className="h-3.5 w-3.5" /> : <IconUpload className="h-3.5 w-3.5" />} Upload Thumbnail
                        <input type="file" accept=".jpg,.jpeg,.png,.webp,.gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleThumbnailUpload(f); }} />
                      </label>
                    </div>
                  </Field>
                </div>
              </div>

              {/* COURSE BUILDER */}
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Course Builder</h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-500">Available Courses</p>
                    <input
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      placeholder="Search course…"
                      className={`${INPUT_CLS} mb-2`}
                    />
                    <div className="max-h-72 space-y-1 overflow-y-auto">
                      {availableCourses.length === 0 ? (
                        <EmptyState message="No available courses." />
                      ) : (
                        availableCourses.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => handleAddCourse(c.id)}
                            className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <span className="truncate">{c.course_name}</span>
                            <IconPlus className="h-3.5 w-3.5 flex-shrink-0" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-500">Assigned Courses (sequence order)</p>
                    <div className="max-h-72 space-y-2 overflow-y-auto">
                      {assignedCourses.length === 0 ? (
                        <EmptyState message="No courses assigned yet." />
                      ) : (
                        assignedCourses.map((pc, idx) => {
                          const course = courseById.get(pc.course_id);
                          return (
                            <div key={pc.id} className="rounded-xl border border-slate-100 p-3">
                              <div className="mb-2 flex items-center gap-2">
                                <div className="flex flex-col">
                                  <button onClick={() => handleMoveCourse(pc, 'up')} disabled={idx === 0 || busyCourseId === pc.id} className="text-slate-300 transition hover:text-indigo-600 disabled:opacity-30"><IconArrowUp /></button>
                                  <button onClick={() => handleMoveCourse(pc, 'down')} disabled={idx === assignedCourses.length - 1 || busyCourseId === pc.id} className="text-slate-300 transition hover:text-indigo-600 disabled:opacity-30"><IconArrowDown /></button>
                                </div>
                                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{idx + 1}. {course?.course_name ?? 'Unknown'}</p>
                                <button onClick={() => handleRemoveCourse(pc)} className="flex-shrink-0 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><IconTrash /></button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <ToggleRow label="Mandatory" on={pc.mandatory} onChange={() => handleToggleMandatory(pc)} />
                                <ToggleRow label="Sequential" hint="Unlocks after previous" on={pc.unlock_previous} onChange={() => handleToggleSequential(pc)} />
                              </div>
                              <div className="mt-2">
                                <label className="mb-1 block text-[11px] font-semibold text-slate-400">Minimum Score % (session only)</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={minimumScoreById[pc.id] ?? 0}
                                  onChange={(e) => setMinimumScore(pc.id, Number(e.target.value))}
                                  className="w-24 rounded-lg bg-slate-50 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ASSIGNMENT */}
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Assign Learning Path</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Assign By">
                    <select
                      value={assignType}
                      onChange={(e) => { setAssignType(e.target.value as PathEnrollmentType); setAssignTargetId(''); }}
                      className={INPUT_CLS}
                    >
                      <option value="company">Company</option>
                      <option value="branch">Branch</option>
                      <option value="department">Department</option>
                      <option value="designation">Role / Designation</option>
                      <option value="employee">Employee</option>
                    </select>
                  </Field>
                  <Field label={assignType === 'employee' ? 'Employee' : assignType[0].toUpperCase() + assignType.slice(1)}>
                    <select value={assignTargetId} onChange={(e) => setAssignTargetId(e.target.value)} className={INPUT_CLS}>
                      <option value="">Select…</option>
                      {assignType === 'company' && companies.map((c) => (<option key={c.id} value={c.id}>{c.company_name}</option>))}
                      {assignType === 'branch' && branches.map((b) => (<option key={b.id} value={b.id}>{b.branch_name}</option>))}
                      {assignType === 'department' && departments.map((d) => (<option key={d.id} value={d.id}>{d.department_name}</option>))}
                      {assignType === 'designation' && designations.map((d) => (<option key={d.id} value={d.id}>{d.designation_name}</option>))}
                      {assignType === 'employee' && employees.map((e) => (<option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>))}
                    </select>
                  </Field>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ToggleRow label="Mandatory" on={assignMandatory} onChange={() => setAssignMandatory((v) => !v)} />
                  <ToggleRow label="Completion Required" on={assignCompletionRequired} onChange={() => setAssignCompletionRequired((v) => !v)} />
                </div>
                <PrimaryButton onClick={handleAssign} disabled={!assignTargetId || assigning} className="mt-4">
                  {assigning ? <Spinner className="h-3.5 w-3.5" /> : null} Assign Learning Path
                </PrimaryButton>

                {pathEnrollmentsForActive.length > 0 && (
                  <div className="mt-5 max-h-56 space-y-1.5 overflow-y-auto border-t border-slate-100 pt-4">
                    {pathEnrollmentsForActive.map((en) => {
                      const emp = employees.find((e) => e.id === en.employee_id);
                      return (
                        <div key={en.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          <span className="truncate text-slate-700">{emp ? `${emp.first_name} ${emp.last_name}` : en.employee_id}</span>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            <span className="text-xs text-slate-400">{en.status.replace('_', ' ')}</span>
                            <button onClick={() => handleRemoveAssignment(en)} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><IconTrash /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* PROGRESS */}
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Progress</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                  <SummaryCard label="Total Employees" value={progressStats.totalEmployees} accent="border-slate-200" />
                  <SummaryCard label="Started" value={progressStats.started} accent="border-blue-200" />
                  <SummaryCard label="In Progress" value={progressStats.inProgress} accent="border-amber-200" />
                  <SummaryCard label="Completed" value={progressStats.completed} accent="border-emerald-200" />
                  <SummaryCard label="Average Progress" value={progressStats.avgProgress} accent="border-indigo-200" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Learning Path"
          message={`Delete "${deleteTarget.path_name}"? This cannot be undone.`}
          busy={deleting}
          confirmLabel="Delete"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {previewOpen && activePath && (
        <PreviewDialog
          path={activePath}
          courses={assignedCourses.map((pc) => ({ name: courseById.get(pc.course_id)?.course_name ?? 'Unknown', mandatory: pc.mandatory }))}
          onClose={() => setPreviewOpen(false)}
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

export default LearningPathManagement;