// src/components/superadmin/AssignTrainingManagement.tsx
//
// One simple screen for "who gets what training": pick an employee, then
// tick/untick Learning Paths and individual Courses — no separate
// Add/Remove modal, no Save button, each checkbox is the action.
// Reuses the exact same underlying assignment logic already built for
// LearningPathEnrollmentManagement.tsx (resolve-to-employee, auto-enroll
// into the path's courses, duration-based deadline, notification) and
// superadmin/EnrollmentManagement.tsx (direct course assignment) — this
// screen is just a faster, checkbox-first way to reach the same actions.

import { useEffect, useMemo, useState } from 'react';
import { employeeService } from '../../services/employee/employeeService';
import { loadCompanies } from '../../services/company/companyService';
import { loadCourses } from '../../services/course/courseService';
import { loadLearningPaths } from '../../services/learningPath/learningPathService';
import { loadLearningPathCourses } from '../../services/learningPathCourse/learningPathCourseService';
import {
  loadEnrollments as loadCourseEnrollments,
  createEnrollment as createCourseEnrollment,
  toggleIsActive as toggleCourseActive,
} from '../../services/enrollment/enrollmentService';
import {
  loadEnrollments as loadPathEnrollments,
  createEnrollment as createPathEnrollment,
  toggleActive as togglePathActive,
} from '../../services/learningPathEnrollment/learningPathEnrollmentService';
import { notifyCourseAssigned, notifyLearningPathAssigned } from '../../services/notification/notificationService';
import { getCurrentUser } from '../../services/auth/session';
import DurationPicker from '../shared/DurationPicker';
import { computeDeadline } from '../../utils/deadline';
import type { DurationUnit } from '../../utils/deadline';

import type { Employee } from '../../types/employee';
import type { Company } from '../../types/company';
import type { Course, CourseLevel } from '../../types/course';
import type { LearningPath } from '../../types/learningPath';
import type { LearningPathCourse } from '../../types/learningPathCourse';
import type { Enrollment } from '../../types/enrollment';
import type { LearningPathEnrollment } from '../../types/learningPathEnrollment';

// ─────────────────────────────────────────────────────────────────────────────
// Small UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function IconCheck({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.106A4.114 4.114 0 0 0 12.4 15.101m2.6 4.027v.106A9.337 9.337 0 0 1 12 21c-2.135 0-4.1-.739-5.653-1.977M15 19.128v-.106A4.114 4.114 0 0 0 12.4 15.101M12 21c-2.135 0-4.1-.739-5.653-1.977M12 21v-.106a4.114 4.114 0 0 0-2.6-3.816M6.347 19.023A4.125 4.125 0 0 1 9 15.101m-2.653 3.922V19c0-.606.023-1.207.068-1.802M9 15.101a4.125 4.125 0 0 0-7.533 2.493A9.337 9.337 0 0 0 5.588 18.6M9 15.101a4.125 4.125 0 0 1 7.533 0M9 15.101c-.132-.005-.263-.005-.395 0M15.533 15.1c.132-.005.263-.005.395 0m-.395 0a5.63 5.63 0 0 0-.913-1.564M9 15.1a5.63 5.63 0 0 1 .913-1.564M12 12.75a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      </svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

// A checkbox row that IS the action — no separate save. Shows a small
// spinner over the checkbox while its own toggle is in flight.
function AssignRow({
  label, sub, checked, busy, onToggle,
}: { label: string; sub?: string; checked: boolean; busy: boolean; onToggle: () => void }) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
      checked ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'
    } ${busy ? 'opacity-60' : ''}`}>
      <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition ${
        checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'
      }`}>
        {busy ? <Spinner className="h-3 w-3" /> : checked ? <IconCheck /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-800">{label}</span>
        {sub && <span className="block truncate text-xs text-slate-400">{sub}</span>}
      </span>
      <input type="checkbox" checked={checked} disabled={busy} onChange={onToggle} className="sr-only" />
    </label>
  );
}

const LEVEL_LABELS: Record<CourseLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};
const LEVEL_ORDER: CourseLevel[] = ['beginner', 'intermediate', 'advanced'];

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

function AssignTrainingManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [pathCourses, setPathCourses] = useState<LearningPathCourse[]>([]);
  const [courseEnrollments, setCourseEnrollments] = useState<Enrollment[]>([]);
  const [pathEnrollments, setPathEnrollments] = useState<LearningPathEnrollment[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [companyFilter, setCompanyFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  const [duration, setDuration] = useState(0);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days');

  const [busyKey, setBusyKey] = useState<string | null>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2500);
  }

  function load() {
    setLoading(true);
    setError('');
    Promise.all([
      employeeService.getAll(),
      loadCompanies(),
      loadCourses(),
      loadLearningPaths(),
      loadLearningPathCourses(),
      loadCourseEnrollments(),
      loadPathEnrollments(),
    ])
      .then(([empData, coData, courseData, pathData, pathCourseData, ceData, peData]) => {
        setEmployees(empData);
        setCompanies(coData);
        setCourses(courseData);
        setLearningPaths(pathData);
        setPathCourses(pathCourseData);
        setCourseEnrollments(ceData);
        setPathEnrollments(peData);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load data.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const searchTerm = search.trim().toLowerCase();
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (!e.active) return false;
      if (companyFilter !== 'all' && e.company_id !== companyFilter) return false;
      if (searchTerm) {
        const fullName = `${e.first_name} ${e.last_name}`.toLowerCase();
        if (!fullName.includes(searchTerm) && !e.employee_code.toLowerCase().includes(searchTerm)) return false;
      }
      return true;
    });
  }, [employees, companyFilter, searchTerm]);

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) ?? null;

  const activeCoursesForCompany = useMemo(
    () => courses.filter((c) => c.active && (!selectedEmployee || c.company_id === selectedEmployee.company_id)),
    [courses, selectedEmployee]
  );
  const coursesByLevel = useMemo(() => {
    const map = new Map<CourseLevel, Course[]>();
    LEVEL_ORDER.forEach((lvl) => map.set(lvl, []));
    activeCoursesForCompany.forEach((c) => {
      const list = map.get(c.level) ?? [];
      list.push(c);
      map.set(c.level, list);
    });
    return map;
  }, [activeCoursesForCompany]);

  const activePathsForCompany = useMemo(
    () => learningPaths.filter((p) => p.active && p.published),
    [learningPaths]
  );

  const assignedCourseIdsByEmployee = useMemo(() => {
    const map = new Map<string, Set<string>>();
    courseEnrollments.filter((e) => e.is_active).forEach((e) => {
      const set = map.get(e.employee_id) ?? new Set<string>();
      set.add(e.course_id);
      map.set(e.employee_id, set);
    });
    return map;
  }, [courseEnrollments]);

  const assignedPathIdsByEmployee = useMemo(() => {
    const map = new Map<string, Set<string>>();
    pathEnrollments.filter((e) => e.active && e.enrollment_type === 'employee').forEach((e) => {
      const set = map.get(e.employee_id) ?? new Set<string>();
      set.add(e.learning_path_id);
      map.set(e.employee_id, set);
    });
    return map;
  }, [pathEnrollments]);

  const assignedCourseIds = selectedEmployeeId ? (assignedCourseIdsByEmployee.get(selectedEmployeeId) ?? new Set<string>()) : new Set<string>();
  const assignedPathIds = selectedEmployeeId ? (assignedPathIdsByEmployee.get(selectedEmployeeId) ?? new Set<string>()) : new Set<string>();

  // ── Course toggle ────────────────────────────────────────────────────────────

  async function handleToggleCourse(course: Course) {
    if (!selectedEmployee) return;
    setBusyKey(`course-${course.id}`);
    try {
      const isAssigned = assignedCourseIds.has(course.id);
      if (isAssigned) {
        const row = courseEnrollments.find((e) => e.employee_id === selectedEmployee.id && e.course_id === course.id && e.is_active);
        if (row) await toggleCourseActive(row.id, false);
        showToast(`Removed "${course.course_name}"`);
      } else {
        const user = getCurrentUser();
        const deadline = duration > 0 ? computeDeadline(duration, durationUnit) : null;
        await createCourseEnrollment({
          company_id: selectedEmployee.company_id,
          branch_id: selectedEmployee.branch_id || null,
          employee_id: selectedEmployee.id,
          course_id: course.id,
          learning_path_id: null,
          assignment_type: 'MANUAL',
          enrollment_type: 'COURSE',
          status: 'PENDING',
          assigned_by: null,
          assigned_at: new Date().toISOString(),
          start_date: null,
          due_date: deadline,
          completed_at: null,
          expiry_date: null,
          completion_percentage: 0,
          certificate_id: null,
          remarks: '',
          is_active: true,
        } as unknown as Parameters<typeof createCourseEnrollment>[0]);
        if (user) {
          await notifyCourseAssigned(
            selectedEmployee.company_id, user.id, `${user.firstName} ${user.lastName}`.trim(),
            course.id, course.course_name, [selectedEmployee.id], deadline
          );
        }
        showToast(`Assigned "${course.course_name}"`);
      }
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update assignment.');
    } finally {
      setBusyKey(null);
    }
  }

  // ── Learning Path toggle ─────────────────────────────────────────────────────

  async function handleTogglePath(path: LearningPath) {
    if (!selectedEmployee) return;
    setBusyKey(`path-${path.id}`);
    try {
      const isAssigned = assignedPathIds.has(path.id);
      if (isAssigned) {
        const row = pathEnrollments.find((e) => e.employee_id === selectedEmployee.id && e.learning_path_id === path.id && e.active);
        if (row) await togglePathActive(row.id, false);
        showToast(`Removed "${path.path_name}"`);
      } else {
        const user = getCurrentUser();
        const deadline = duration > 0 ? computeDeadline(duration, durationUnit) : null;
        await createPathEnrollment({
          learning_path_id: path.id,
          company_id: selectedEmployee.company_id,
          branch_id: selectedEmployee.branch_id || null,
          department_id: selectedEmployee.department_id || null,
          designation_id: selectedEmployee.designation_id || null,
          employee_id: selectedEmployee.id,
          enrollment_type: 'employee',
          enrolled_date: new Date().toISOString(),
          start_date: '',
          end_date: deadline ?? '',
          mandatory: false,
          active: true,
          completion_required: false,
          status: 'assigned',
          remarks: '',
        } as unknown as Parameters<typeof createPathEnrollment>[0]);

        const coursesInPath = pathCourses.filter((pc) => pc.learning_path_id === path.id && pc.active);
        const existingCourseIds = assignedCourseIdsByEmployee.get(selectedEmployee.id) ?? new Set<string>();
        for (const pc of coursesInPath) {
          if (existingCourseIds.has(pc.course_id)) continue;
          await createCourseEnrollment({
            company_id: selectedEmployee.company_id,
            branch_id: selectedEmployee.branch_id || null,
            employee_id: selectedEmployee.id,
            course_id: pc.course_id,
            learning_path_id: null,
            assignment_type: 'AUTO',
            enrollment_type: 'COURSE',
            status: 'PENDING',
            assigned_by: null,
            assigned_at: new Date().toISOString(),
            start_date: null,
            due_date: deadline,
            completed_at: null,
            expiry_date: null,
            completion_percentage: 0,
            certificate_id: null,
            remarks: '',
            is_active: true,
          } as unknown as Parameters<typeof createCourseEnrollment>[0]);
        }

        if (user) {
          await notifyLearningPathAssigned(
            selectedEmployee.company_id, user.id, `${user.firstName} ${user.lastName}`.trim(),
            path.path_name, [selectedEmployee.id], deadline
          );
        }
        showToast(`Assigned "${path.path_name}"`);
      }
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update assignment.');
    } finally {
      setBusyKey(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-semibold">Failed to load data</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800">Assign Training</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick an employee, then tick the Learning Paths and Courses they should get. Untick to remove — every checkbox acts instantly, nothing to save.
        </p>
        <div className="mt-4 max-w-xs">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Complete Within (applies to new assignments below)</label>
          <DurationPicker
            value={duration}
            unit={durationUnit}
            onChange={(v, u) => { setDuration(v); setDurationUnit(u); }}
            inputClassName="rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">

        {/* Employee list */}
        <div className="rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <div className="mb-3 space-y-2">
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            >
              <option value="all">All Companies</option>
              {companies.map((c) => (<option key={c.id} value={c.id}>{c.company_name}</option>))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee…"
              className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </div>

          {filteredEmployees.length === 0 ? (
            <EmptyState message="No employees match these filters." />
          ) : (
            <div className="max-h-[560px] space-y-1 overflow-y-auto">
              {filteredEmployees.map((emp) => {
                const isActive = selectedEmployeeId === emp.id;
                const pathCount = assignedPathIdsByEmployee.get(emp.id)?.size ?? 0;
                const courseCount = assignedCourseIdsByEmployee.get(emp.id)?.size ?? 0;
                return (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedEmployeeId(emp.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                      isActive ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{emp.first_name} {emp.last_name}</p>
                      <p className="truncate text-xs text-slate-400">{emp.employee_code}</p>
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      {pathCount + courseCount}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Assignment checklists */}
        <div className="space-y-6">
          {!selectedEmployee ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <EmptyState message="Select an employee to see and manage their training." />
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-800">{selectedEmployee.first_name} {selectedEmployee.last_name}</h3>
                <p className="text-xs text-slate-400">{selectedEmployee.employee_code}</p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Learning Paths</h3>
                {activePathsForCompany.length === 0 ? (
                  <EmptyState message="No published learning paths yet." />
                ) : (
                  <div className="space-y-2">
                    {activePathsForCompany.map((path) => (
                      <AssignRow
                        key={path.id}
                        label={path.path_name}
                        sub={path.path_code}
                        checked={assignedPathIds.has(path.id)}
                        busy={busyKey === `path-${path.id}`}
                        onToggle={() => handleTogglePath(path)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Individual Courses</h3>
                {activeCoursesForCompany.length === 0 ? (
                  <EmptyState message="No courses available for this company yet." />
                ) : (
                  <div className="space-y-5">
                    {LEVEL_ORDER.map((lvl) => {
                      const list = coursesByLevel.get(lvl) ?? [];
                      if (list.length === 0) return null;
                      return (
                        <div key={lvl}>
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-500">{LEVEL_LABELS[lvl]}</p>
                          <div className="space-y-2">
                            {list.map((course) => (
                              <AssignRow
                                key={course.id}
                                label={course.course_name}
                                sub={course.course_code}
                                checked={assignedCourseIds.has(course.id)}
                                busy={busyKey === `course-${course.id}`}
                                onToggle={() => handleToggleCourse(course)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default AssignTrainingManagement;
