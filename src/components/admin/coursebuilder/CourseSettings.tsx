// src/components/admin/coursebuilder/CourseSettings.tsx
//
// Complete Course Settings module. Reuses only existing, unmodified
// architecture:
//   courseService   (loadCourses / saveCourse)                   — Course
//                    Information, Release (Active/Inactive), Certificate
//                    Enabled, Passing Percentage, SEO Short Description
//   categoryService (loadCategories)                             — Category
//   employeeService (getAll)                                     — resolves
//                    Created By (course.created_by) to a real employee name
//   contentEditorService.uploadImage                             — real
//                    Course Thumbnail upload
//
// Every field listed in the brief that has NO backing column anywhere in
// the reachable schema (Department, Language, Course Banner, Access
// Control targeting, Release scheduling/Archived, all Learning Rules,
// Assessment/Assignment/Certificate/Notification defaults beyond the two
// real course columns, Tags/Keywords) is kept as clearly-labelled,
// session-local UI state only — nothing fake is persisted, and each such
// section says so explicitly.

import { useEffect, useRef, useState } from 'react';
import { loadCourses, saveCourse } from '../../../services/course/courseService';
import { loadCategories } from '../../../services/category/categoryService';
import { employeeService } from '../../../services/employee/employeeService';
import { uploadImage } from '../../../services/contentEditor/contentEditorService';

import type { Course, CourseForm, CourseLevel } from '../../../types/course';
import type { Category } from '../../../types/category';
import type { Employee } from '../../../types/employee';

// ─────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG only)
// ─────────────────────────────────────────────────────────────────────────────

function IconChevronDown({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session-local settings — no backend column exists anywhere for these.
// Kept in memory only, per course id, clearly labelled in the UI.
// ─────────────────────────────────────────────────────────────────────────────

interface LocalCourseSettings {
  // Access Control
  visibleToFreshers:      boolean;
  visibleToExperienced:   boolean;
  visibleToTeamLeaders:   boolean;
  visibleToManagers:      boolean;
  customRole:             string;
  customDepartment:       string;
  customBranch:           string;
  customCompany:          string;

  // Release Settings
  releaseMode:            'immediate' | 'scheduled';
  scheduledDate:          string;
  archived:                boolean;

  // Learning Rules
  sequentialLearning:      boolean;
  allowSkip:               boolean;
  mandatoryCompletion:     boolean;
  minimumProgressPercent:  number;
  assessmentMandatory:     boolean;
  assignmentMandatory:     boolean;
  certificateMandatory:    boolean;

  // Assessment Settings (course-level defaults only)
  attemptsAllowed:         number;
  questionShuffle:         boolean;
  optionShuffle:           boolean;
  negativeMarking:         boolean;
  timerEnabled:            boolean;
  timePerQuestionSeconds:  number;
  showResultImmediately:   boolean;
  allowReview:             boolean;

  // Assignment Settings
  submissionRequired:      boolean;
  resubmissionAllowed:     boolean;
  maxFileSizeMb:           number;
  allowedFileTypes:        string;
  dueDate:                 string;

  // Certificate Settings
  certificateTemplate:     string;
  certificatePrefix:       string;
  certificateNumberFormat: string;
  issueAutomatically:      boolean;

  // Notifications
  notifyOnEnrollment:      boolean;
  notifyOnCompletion:      boolean;
  notifyTrainer:           boolean;
  reminderBeforeDueDays:   number;

  // SEO
  tags:                    string;
  keywords:                string;
}

const DEFAULT_LOCAL_SETTINGS: LocalCourseSettings = {
  visibleToFreshers: false,
  visibleToExperienced: false,
  visibleToTeamLeaders: false,
  visibleToManagers: false,
  customRole: '',
  customDepartment: '',
  customBranch: '',
  customCompany: '',

  releaseMode: 'immediate',
  scheduledDate: '',
  archived: false,

  sequentialLearning: false,
  allowSkip: true,
  mandatoryCompletion: false,
  minimumProgressPercent: 100,
  assessmentMandatory: false,
  assignmentMandatory: false,
  certificateMandatory: false,

  attemptsAllowed: 3,
  questionShuffle: false,
  optionShuffle: false,
  negativeMarking: false,
  timerEnabled: false,
  timePerQuestionSeconds: 60,
  showResultImmediately: true,
  allowReview: true,

  submissionRequired: true,
  resubmissionAllowed: true,
  maxFileSizeMb: 10,
  allowedFileTypes: '.pdf,.doc,.docx,.jpg,.png',
  dueDate: '',

  certificateTemplate: 'Default Template',
  certificatePrefix: 'CERT',
  certificateNumberFormat: 'CERT-{YEAR}-{SEQ}',
  issueAutomatically: true,

  notifyOnEnrollment: true,
  notifyOnCompletion: true,
  notifyTrainer: true,
  reminderBeforeDueDays: 2,

  tags: '',
  keywords: '',
};

const LEVEL_OPTIONS: CourseLevel[] = ['beginner', 'intermediate', 'advanced'];

function toCourseForm(c: Course): CourseForm {
  return {
    company_id: c.company_id,
    category_id: c.category_id,
    course_code: c.course_code,
    course_name: c.course_name,
    short_description: c.short_description,
    full_description: c.full_description,
    thumbnail: c.thumbnail,
    level: c.level,
    duration_days: c.duration_days,
    duration_hours: c.duration_hours,
    passing_percentage: c.passing_percentage,
    certificate_enabled: c.certificate_enabled,
    active: c.active,created_by: "",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <IconSpinner className={className} />;
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

function LocalStateNotice() {
  return (
    <p className="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
      These settings aren't backed by a dedicated table yet — kept for this session only, and won't survive a page reload.
    </p>
  );
}

function Section({
  title, description, defaultOpen, children,
}: { title: string; description?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-2xl bg-white shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left"
      >
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
        </div>
        <IconChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="space-y-4 px-6 pb-6">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main CourseSettings
// ─────────────────────────────────────────────────────────────────────────────

interface CourseSettingsProps {
  courseId?: string;
}

function CourseSettings({ courseId }: CourseSettingsProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedCourseId, setSelectedCourseId] = useState(courseId ?? '');
  const [localSettingsById, setLocalSettingsById] = useState<Record<string, LocalCourseSettings>>({});
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [savingField, setSavingField] = useState(false);
  const [toast, setToast] = useState('');

  const thumbInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2200);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([loadCourses(), loadCategories(), employeeService.getAll()])
      .then(([courseRows, categoryRows, employeeRows]) => {
        setCourses(courseRows);
        setCategories(categoryRows);
        setEmployees(employeeRows);
        setSelectedCourseId((prev) => prev || courseRows[0]?.id || '');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load course settings.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (courseId) setSelectedCourseId(courseId);
  }, [courseId]);

  const course = courses.find((c) => c.id === selectedCourseId) ?? null;
  
  const creator = course ? employees.find((e) => e.id === course.created_by) ?? null : null;

  const local = localSettingsById[selectedCourseId] ?? DEFAULT_LOCAL_SETTINGS;

  function updateLocal(patch: Partial<LocalCourseSettings>) {
    if (!selectedCourseId) return;
    setLocalSettingsById((prev) => ({
      ...prev,
      [selectedCourseId]: { ...(prev[selectedCourseId] ?? DEFAULT_LOCAL_SETTINGS), ...patch },
    }));
  }

  async function updateCourseField(patch: Record<string, unknown>) {
    if (!course) return;
    setSavingField(true);
    try {
      await saveCourse(course.id, { ...toCourseForm(course), ...patch });
      fetchAll();
      showToast('Saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSavingField(false);
    }
  }

  async function handleThumbnailUpload(file: File) {
    if (!course) return;
    setUploadingThumbnail(true);
    try {
      const result = await uploadImage(file);
      await saveCourse(course.id, { ...toCourseForm(course), thumbnail: result.url });
      fetchAll();
      showToast('Thumbnail updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Thumbnail upload failed.');
    } finally {
      setUploadingThumbnail(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen rounded-2xl bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-900">Course Settings</h2>
            <p className="mt-0.5 text-sm text-slate-500">{course?.course_name || 'Select a course to configure'}</p>
          </div>
          {courses.length > 1 && (
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            >
              {courses.map((c) => (<option key={c.id} value={c.id}>{c.course_name}</option>))}
            </select>
          )}
          {savingField && <span className="flex items-center gap-1.5 text-xs text-slate-400"><Spinner className="h-3.5 w-3.5" /> Saving…</span>}
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-white shadow-sm" />)}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            <p className="font-semibold">Failed to load course settings</p>
            <p className="mt-1">{error}</p>
            <SecondaryButton onClick={fetchAll} className="mt-4">Try Again</SecondaryButton>
          </div>
        )}

        {!loading && !error && !course && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center text-sm text-slate-400">
            No course selected.
          </div>
        )}

        {!loading && !error && course && (
          <>
            {/* COURSE INFORMATION */}
            <Section title="Course Information" description="Core details learners and admins see everywhere." defaultOpen>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Course Name">
                  <input
                    key={`${course.id}-name`}
                    defaultValue={course.course_name}
                    onBlur={(e) => updateCourseField({ course_name: e.target.value })}
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label="Course Code">
                  <input
                    key={`${course.id}-code`}
                    defaultValue={course.course_code}
                    onBlur={(e) => updateCourseField({ course_code: e.target.value })}
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label="Category">
                  <select
                    value={course.category_id}
                    onChange={(e) => updateCourseField({ category_id: e.target.value })}
                    className={INPUT_CLS}
                  >
                    {categories.map((c) => (<option key={c.id} value={c.id}>{c.category_name}</option>))}
                  </select>
                </Field>
                <Field label="Difficulty Level">
                  <select
                    value={course.level}
                    onChange={(e) => updateCourseField({ level: e.target.value })}
                    className={INPUT_CLS}
                  >
                    {LEVEL_OPTIONS.map((lvl) => (<option key={lvl} value={lvl}>{lvl[0].toUpperCase() + lvl.slice(1)}</option>))}
                  </select>
                </Field>
                <Field label="Duration (days)">
                  <input
                    key={`${course.id}-days`}
                    type="number"
                    min={0}
                    defaultValue={course.duration_days}
                    onBlur={(e) => updateCourseField({ duration_days: Number(e.target.value) })}
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label="Duration (hours)">
                  <input
                    key={`${course.id}-hours`}
                    type="number"
                    min={0}
                    defaultValue={course.duration_hours}
                    onBlur={(e) => updateCourseField({ duration_hours: Number(e.target.value) })}
                    className={INPUT_CLS}
                  />
                </Field>
                <Field label="Passing Percentage">
                  <input
                    key={`${course.id}-pass`}
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={course.passing_percentage}
                    onBlur={(e) => updateCourseField({ passing_percentage: Number(e.target.value) })}
                    className={INPUT_CLS}
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  key={`${course.id}-desc`}
                  defaultValue={course.full_description}
                  onBlur={(e) => updateCourseField({ full_description: e.target.value })}
                  rows={4}
                  className={`${INPUT_CLS} resize-none`}
                />
              </Field>

              <ToggleRow
                label="Certificate Enabled"
                hint="Learners can earn a certificate on completion."
                on={course.certificate_enabled}
                onChange={() => updateCourseField({ certificate_enabled: !course.certificate_enabled })}
              />
              <ToggleRow
                label="Active"
                hint="Inactive courses are hidden from learners."
                on={course.active}
                onChange={() => updateCourseField({ active: !course.active })}
              />

              <Field label="Course Thumbnail">
                <div className="flex items-center gap-3">
                  {course.thumbnail ? (
                    <img src={course.thumbnail} alt="" className="h-16 w-24 flex-shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-300">
                      <IconUpload className="h-5 w-5" />
                    </div>
                  )}
                  <SecondaryButton onClick={() => thumbInputRef.current?.click()}>
                    {uploadingThumbnail ? <Spinner className="h-3.5 w-3.5" /> : <IconUpload className="h-3.5 w-3.5" />} Upload Thumbnail
                  </SecondaryButton>
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.gif"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleThumbnailUpload(f); }}
                  />
                </div>
              </Field>

              <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-400">
                Department, Language, and a separate Course Banner have no dedicated columns yet, so they're not shown here.
              </p>
            </Section>

            {/* ACCESS CONTROL */}
            <Section title="Access Control" description="Who can see and enrol in this course.">
              <LocalStateNotice />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ToggleRow label="Freshers" on={local.visibleToFreshers} onChange={() => updateLocal({ visibleToFreshers: !local.visibleToFreshers })} />
                <ToggleRow label="Experienced Employees" on={local.visibleToExperienced} onChange={() => updateLocal({ visibleToExperienced: !local.visibleToExperienced })} />
                <ToggleRow label="Team Leaders" on={local.visibleToTeamLeaders} onChange={() => updateLocal({ visibleToTeamLeaders: !local.visibleToTeamLeaders })} />
                <ToggleRow label="Managers" on={local.visibleToManagers} onChange={() => updateLocal({ visibleToManagers: !local.visibleToManagers })} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Custom Role"><input value={local.customRole} onChange={(e) => updateLocal({ customRole: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Custom Department"><input value={local.customDepartment} onChange={(e) => updateLocal({ customDepartment: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Custom Branch"><input value={local.customBranch} onChange={(e) => updateLocal({ customBranch: e.target.value })} className={INPUT_CLS} /></Field>
                <Field label="Custom Company"><input value={local.customCompany} onChange={(e) => updateLocal({ customCompany: e.target.value })} className={INPUT_CLS} /></Field>
              </div>
            </Section>

            {/* RELEASE SETTINGS */}
            <Section title="Release Settings" description="Control when and how this course goes live.">
              <ToggleRow
                label={course.active ? 'Published' : 'Draft'}
                hint="This is the real, persisted publish state."
                on={course.active}
                onChange={() => updateCourseField({ active: !course.active })}
              />
              <LocalStateNotice />
              <div className="flex gap-2">
                <SecondaryButton
                  onClick={() => updateLocal({ releaseMode: 'immediate' })}
                  className={local.releaseMode === 'immediate' ? 'ring-2 ring-indigo-400' : ''}
                >
                  Immediate
                </SecondaryButton>
                <SecondaryButton
                  onClick={() => updateLocal({ releaseMode: 'scheduled' })}
                  className={local.releaseMode === 'scheduled' ? 'ring-2 ring-indigo-400' : ''}
                >
                  Scheduled
                </SecondaryButton>
              </div>
              {local.releaseMode === 'scheduled' && (
                <Field label="Scheduled Date">
                  <input type="date" value={local.scheduledDate} onChange={(e) => updateLocal({ scheduledDate: e.target.value })} className={INPUT_CLS} />
                </Field>
              )}
              <ToggleRow label="Archived" hint="Session-only archive flag." on={local.archived} onChange={() => updateLocal({ archived: !local.archived })} />
            </Section>

            {/* LEARNING RULES */}
            <Section title="Learning Rules" description="How learners progress through this course.">
              <LocalStateNotice />
              <ToggleRow label="Sequential Learning" hint="Learners must follow the module order." on={local.sequentialLearning} onChange={() => updateLocal({ sequentialLearning: !local.sequentialLearning })} />
              <ToggleRow label="Allow Skip" on={local.allowSkip} onChange={() => updateLocal({ allowSkip: !local.allowSkip })} />
              <ToggleRow label="Mandatory Completion" on={local.mandatoryCompletion} onChange={() => updateLocal({ mandatoryCompletion: !local.mandatoryCompletion })} />
              <Field label="Minimum Progress %">
                <input type="number" min={0} max={100} value={local.minimumProgressPercent} onChange={(e) => updateLocal({ minimumProgressPercent: Number(e.target.value) })} className={INPUT_CLS} />
              </Field>
              <ToggleRow label="Assessment Mandatory" on={local.assessmentMandatory} onChange={() => updateLocal({ assessmentMandatory: !local.assessmentMandatory })} />
              <ToggleRow label="Assignment Mandatory" on={local.assignmentMandatory} onChange={() => updateLocal({ assignmentMandatory: !local.assignmentMandatory })} />
              <ToggleRow label="Certificate Mandatory" on={local.certificateMandatory} onChange={() => updateLocal({ certificateMandatory: !local.certificateMandatory })} />
            </Section>

            {/* ASSESSMENT SETTINGS */}
            <Section title="Assessment Settings" description="Default rules suggested for assessments in this course.">
              <Field label="Passing Percentage">
                <input
                  key={`${course.id}-assess-pass`}
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={course.passing_percentage}
                  onBlur={(e) => updateCourseField({ passing_percentage: Number(e.target.value) })}
                  className={INPUT_CLS}
                />
              </Field>
              <LocalStateNotice />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Attempts Allowed">
                  <input type="number" min={1} value={local.attemptsAllowed} onChange={(e) => updateLocal({ attemptsAllowed: Number(e.target.value) })} className={INPUT_CLS} />
                </Field>
                <Field label="Time Per Question (sec)">
                  <input type="number" min={0} value={local.timePerQuestionSeconds} onChange={(e) => updateLocal({ timePerQuestionSeconds: Number(e.target.value) })} className={INPUT_CLS} disabled={!local.timerEnabled} />
                </Field>
              </div>
              <ToggleRow label="Question Shuffle" on={local.questionShuffle} onChange={() => updateLocal({ questionShuffle: !local.questionShuffle })} />
              <ToggleRow label="Option Shuffle" on={local.optionShuffle} onChange={() => updateLocal({ optionShuffle: !local.optionShuffle })} />
              <ToggleRow label="Negative Marking" on={local.negativeMarking} onChange={() => updateLocal({ negativeMarking: !local.negativeMarking })} />
              <ToggleRow label="Timer" on={local.timerEnabled} onChange={() => updateLocal({ timerEnabled: !local.timerEnabled })} />
              <ToggleRow label="Show Result Immediately" on={local.showResultImmediately} onChange={() => updateLocal({ showResultImmediately: !local.showResultImmediately })} />
              <ToggleRow label="Allow Review" on={local.allowReview} onChange={() => updateLocal({ allowReview: !local.allowReview })} />
            </Section>

            {/* ASSIGNMENT SETTINGS */}
            <Section title="Assignment Settings" description="Default rules suggested for assignments in this course.">
              <LocalStateNotice />
              <ToggleRow label="Submission Required" on={local.submissionRequired} onChange={() => updateLocal({ submissionRequired: !local.submissionRequired })} />
              <ToggleRow label="Resubmission Allowed" on={local.resubmissionAllowed} onChange={() => updateLocal({ resubmissionAllowed: !local.resubmissionAllowed })} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Maximum File Size (MB)">
                  <input type="number" min={1} value={local.maxFileSizeMb} onChange={(e) => updateLocal({ maxFileSizeMb: Number(e.target.value) })} className={INPUT_CLS} />
                </Field>
                <Field label="Due Date">
                  <input type="date" value={local.dueDate} onChange={(e) => updateLocal({ dueDate: e.target.value })} className={INPUT_CLS} />
                </Field>
              </div>
              <Field label="Allowed File Types">
                <input value={local.allowedFileTypes} onChange={(e) => updateLocal({ allowedFileTypes: e.target.value })} placeholder=".pdf,.doc,.docx" className={INPUT_CLS} />
              </Field>
            </Section>

            {/* CERTIFICATE SETTINGS */}
            <Section title="Certificate Settings" description="How certificates are issued for this course.">
              <ToggleRow
                label="Certificate Enabled"
                hint="Real, persisted setting — same as Course Information above."
                on={course.certificate_enabled}
                onChange={() => updateCourseField({ certificate_enabled: !course.certificate_enabled })}
              />
              <LocalStateNotice />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Certificate Template">
                  <input value={local.certificateTemplate} onChange={(e) => updateLocal({ certificateTemplate: e.target.value })} className={INPUT_CLS} />
                </Field>
                <Field label="Certificate Prefix">
                  <input value={local.certificatePrefix} onChange={(e) => updateLocal({ certificatePrefix: e.target.value })} className={INPUT_CLS} />
                </Field>
              </div>
              <Field label="Certificate Number Format">
                <input value={local.certificateNumberFormat} onChange={(e) => updateLocal({ certificateNumberFormat: e.target.value })} className={INPUT_CLS} />
              </Field>
              <ToggleRow label="Issue Automatically" on={local.issueAutomatically} onChange={() => updateLocal({ issueAutomatically: !local.issueAutomatically })} />
            </Section>

            {/* NOTIFICATIONS */}
            <Section title="Notifications" description="Who gets notified, and when.">
              <LocalStateNotice />
              <ToggleRow label="Notify on Enrollment" on={local.notifyOnEnrollment} onChange={() => updateLocal({ notifyOnEnrollment: !local.notifyOnEnrollment })} />
              <ToggleRow label="Notify on Completion" on={local.notifyOnCompletion} onChange={() => updateLocal({ notifyOnCompletion: !local.notifyOnCompletion })} />
              <ToggleRow label="Notify Trainer" on={local.notifyTrainer} onChange={() => updateLocal({ notifyTrainer: !local.notifyTrainer })} />
              <Field label="Reminder Before Due Date (days)">
                <input type="number" min={0} value={local.reminderBeforeDueDays} onChange={(e) => updateLocal({ reminderBeforeDueDays: Number(e.target.value) })} className={INPUT_CLS} />
              </Field>
            </Section>

            {/* SEO / SEARCH */}
            <Section title="SEO / Search" description="Helps learners and search find this course.">
              <Field label="Short Description">
                <textarea
                  key={`${course.id}-short`}
                  defaultValue={course.short_description}
                  onBlur={(e) => updateCourseField({ short_description: e.target.value })}
                  rows={2}
                  className={`${INPUT_CLS} resize-none`}
                />
              </Field>
              <LocalStateNotice />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Tags">
                  <input value={local.tags} onChange={(e) => updateLocal({ tags: e.target.value })} placeholder="comma, separated, tags" className={INPUT_CLS} />
                </Field>
                <Field label="Keywords">
                  <input value={local.keywords} onChange={(e) => updateLocal({ keywords: e.target.value })} placeholder="comma, separated, keywords" className={INPUT_CLS} />
                </Field>
              </div>
            </Section>

            {/* AUDIT */}
            <Section title="Audit" description="Who created and last touched this course.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Created By">
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {creator ? `${creator.first_name} ${creator.last_name}` : course.created_by || '—'}
                  </p>
                </Field>
                <Field label="Created Date">
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {course.created_at ? new Date(course.created_at).toLocaleString() : '—'}
                  </p>
                </Field>
                <Field label="Modified Date">
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {course.updated_at ? new Date(course.updated_at).toLocaleString() : '—'}
                  </p>
                </Field>
              </div>
              <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-400">
                There's no separate "Modified By" column yet — only who created the course and when it was last updated are tracked.
              </p>
            </Section>
          </>
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

export default CourseSettings;
