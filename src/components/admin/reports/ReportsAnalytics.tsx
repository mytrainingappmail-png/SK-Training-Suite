// src/components/admin/reports/ReportsAnalytics.tsx
//
// Professional Reports & Analytics. Every number and chart here is
// computed client-side from data returned by existing, unmodified
// services — nothing fake, nothing hardcoded:
//   companyService, branchService, departmentService, roleService,
//   employeeRoleService, employeeService     — org structure + filters
//   courseService, enrollmentService         — course completion, hours
//   assessmentService, assessmentResultService — scores, pass/fail
//   trainerAssignmentService                  — trainer identification
//   certificateService                        — certificates issued
//   learningPathService, learningPathEnrollmentService,
//   learningPathProgressService               — learning path report
//   lessonBuilderService, resourceService      — assignment lessons +
//                                                submission markers
//                                                (same technique already
//                                                used in MyAssignments.tsx)
//
// Charts are pure CSS/Tailwind bars — no chart library, no new
// dependency. Export uses native Blob (CSV / Excel-compatible HTML
// table) and window.print() — no new dependency. No repository,
// service, or database changes.

import { useEffect, useMemo, useState } from 'react';

import { loadCompanies } from '../../../services/company/companyService';
import { branchService } from '../../../services/branch/branchService';
import { departmentService } from '../../../services/department/departmentService';
import { loadRoles } from '../../../services/role/roleService';
import { loadEmployeeRoles } from '../../../services/employeeRole/employeeRoleService';
import { employeeService } from '../../../services/employee/employeeService';
import { loadCourses } from '../../../services/course/courseService';
import { loadEnrollments } from '../../../services/enrollment/enrollmentService';
import { loadAssessments } from '../../../services/assessment/assessmentService';
import { loadResults } from '../../../services/assessmentResult/assessmentResultService';
import { loadTrainerAssignments } from '../../../services/trainerAssignment/trainerAssignmentService';
import { loadCertificates } from '../../../services/certificate/certificateService';
import { loadLearningPaths } from '../../../services/learningPath/learningPathService';
import { loadEnrollments as loadPathEnrollments } from '../../../services/learningPathEnrollment/learningPathEnrollmentService';
import { loadProgress as loadPathProgress } from '../../../services/learningPathProgress/learningPathProgressService';
import { loadLessons } from '../../../services/lessonBuilder/lessonBuilderService';
import { loadResources } from '../../../services/resource/resourceService';

import type { Company } from '../../../types/company';
import type { Branch } from '../../../types/branch';
import type { Department } from '../../../types/department';
import type { Role } from '../../../types/role';
import type { EmployeeRole } from '../../../types/employeeRole';
import type { Employee } from '../../../types/employee';
import type { Course } from '../../../types/course';
import type { Enrollment } from '../../../types/enrollment';
import type { Assessment } from '../../../types/assessment';
import type { AssessmentResult } from '../../../types/assessmentResult';
import type { TrainerAssignment } from '../../../types/trainerAssignment';
import type { Certificate } from '../../../types/certificate';
import type { LearningPath } from '../../../types/learningPath';
import type { LearningPathEnrollment } from '../../../types/learningPathEnrollment';
import type { LearningPathProgress } from '../../../types/learningPathProgress';
import type { Lesson } from '../../../types/lessonBuilder';
import type { Resource } from '../../../types/resource';

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function SecondaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}

function PrimaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
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

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load report data</p>
      <p className="mt-1">{message}</p>
      <SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton>
    </div>
  );
}

function EmptyWidget({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure CSS/Tailwind bar chart — no chart library
// ─────────────────────────────────────────────────────────────────────────────

interface BarDatum { label: string; value: number; }

function BarChart({ data, suffix = '%', max }: { data: BarDatum[]; suffix?: string; max?: number }) {
  if (data.length === 0) return <EmptyWidget message="No data available yet." />;
  const maxValue = max ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-32 flex-shrink-0 truncate text-xs font-medium text-slate-600">{d.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
              style={{ width: `${Math.min(100, (d.value / maxValue) * 100)}%` }}
            />
          </div>
          <span className="w-14 flex-shrink-0 text-right text-xs font-semibold text-slate-500">{d.value}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ReportsAnalytics
// ─────────────────────────────────────────────────────────────────────────────

type ReportKey = 'employee' | 'course' | 'trainer' | 'department' | 'branch' | 'assessment' | 'assignment' | 'certificate' | 'learningPath' | 'enrollment';

const REPORT_TABS: { key: ReportKey; label: string }[] = [
  { key: 'employee', label: 'Employee Report' },
  { key: 'course', label: 'Course Report' },
  { key: 'trainer', label: 'Trainer Report' },
  { key: 'department', label: 'Department Report' },
  { key: 'branch', label: 'Branch Report' },
  { key: 'assessment', label: 'Assessment Report' },
  { key: 'assignment', label: 'Assignment Report' },
  { key: 'certificate', label: 'Certificate Report' },
  { key: 'learningPath', label: 'Learning Path Report' },
  { key: 'enrollment', label: 'Enrollment Report' },
];

function ReportsAnalytics() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employeeRoles, setEmployeeRoles] = useState<EmployeeRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [trainerAssignments, setTrainerAssignments] = useState<TrainerAssignment[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [pathEnrollments, setPathEnrollments] = useState<LearningPathEnrollment[]>([]);
  const [pathProgress, setPathProgress] = useState<LearningPathProgress[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [companyFilter, setCompanyFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [trainerFilter, setTrainerFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [activeReport, setActiveReport] = useState<ReportKey>('employee');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([
      loadCompanies(), branchService.getAll(), departmentService.getAll(), loadRoles(), loadEmployeeRoles(),
      employeeService.getAll(), loadCourses(), loadEnrollments(), loadAssessments(), loadResults(),
      loadTrainerAssignments(), loadCertificates(), loadLearningPaths(), loadPathEnrollments(), loadPathProgress(),
      loadLessons(), loadResources(),
    ])
      .then(([companyRows, branchRows, departmentRows, roleRows, employeeRoleRows, employeeRows, courseRows,
        enrollmentRows, assessmentRows, resultRows, trainerRows, certificateRows, pathRows, pathEnrollRows,
        pathProgressRows, lessonRows, resourceRows]) => {
        setCompanies(companyRows);
        setBranches(branchRows);
        setDepartments(departmentRows);
        setRoles(roleRows);
        setEmployeeRoles(employeeRoleRows);
        setEmployees(employeeRows);
        setCourses(courseRows);
        setEnrollments(enrollmentRows);
        setAssessments(assessmentRows);
        setResults(resultRows);
        setTrainerAssignments(trainerRows);
        setCertificates(certificateRows);
        setLearningPaths(pathRows);
        setPathEnrollments(pathEnrollRows);
        setPathProgress(pathProgressRows);
        setLessons(lessonRows);
        setResources(resourceRows);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load report data.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filtering ────────────────────────────────────────────────────────────────

  const roleIdsByEmployee = useMemo(() => {
    const map = new Map<string, Set<string>>();
    employeeRoles.filter((er) => er.active).forEach((er) => {
      const set = map.get(er.employee_id) ?? new Set<string>();
      set.add(er.role_id);
      map.set(er.employee_id, set);
    });
    return map;
  }, [employeeRoles]);

  const trainerIds = useMemo(() => new Set(trainerAssignments.filter((t) => t.is_active).map((t) => t.trainer_id)), [trainerAssignments]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (companyFilter !== 'all' && e.company_id !== companyFilter) return false;
      if (branchFilter !== 'all' && e.branch_id !== branchFilter) return false;
      if (departmentFilter !== 'all' && e.department_id !== departmentFilter) return false;
      if (roleFilter !== 'all' && !roleIdsByEmployee.get(e.id)?.has(roleFilter)) return false;
      if (employeeFilter !== 'all' && e.id !== employeeFilter) return false;
      if (trainerFilter !== 'all' && e.id !== trainerFilter) return false;
      return true;
    });
  }, [employees, companyFilter, branchFilter, departmentFilter, roleFilter, employeeFilter, trainerFilter, roleIdsByEmployee]);

  const filteredEmployeeIds = useMemo(() => new Set(filteredEmployees.map((e) => e.id)), [filteredEmployees]);

  function withinDateRange(dateStr: string | null | undefined): boolean {
    if (!dateStr) return !dateFrom && !dateTo;
    const t = new Date(dateStr).getTime();
    if (dateFrom && t < new Date(dateFrom).getTime()) return false;
    if (dateTo && t > new Date(dateTo).getTime() + 86400000) return false;
    return true;
  }

  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((e) => {
      if (!filteredEmployeeIds.has(e.employee_id)) return false;
      if (courseFilter !== 'all' && e.course_id !== courseFilter) return false;
      if (!withinDateRange(e.assigned_at)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments, filteredEmployeeIds, courseFilter, dateFrom, dateTo]);

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (!filteredEmployeeIds.has(r.employee_id)) return false;
      if (!withinDateRange(r.evaluated_at)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, filteredEmployeeIds, dateFrom, dateTo]);

  const filteredCertificates = useMemo(() => {
    return certificates.filter((c) => {
      if (!filteredEmployeeIds.has(c.employee_id)) return false;
      if (!withinDateRange(c.issue_date)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificates, filteredEmployeeIds, dateFrom, dateTo]);

  const filteredPathEnrollments = useMemo(
    () => pathEnrollments.filter((e) => filteredEmployeeIds.has(e.employee_id)),
    [pathEnrollments, filteredEmployeeIds]
  );
  const filteredPathProgress = useMemo(
    () => pathProgress.filter((p) => filteredEmployeeIds.has(p.employee_id)),
    [pathProgress, filteredEmployeeIds]
  );

  // ── Assignment lessons (same technique as MyAssignments.tsx) ────────────────

  const assignmentLessons = useMemo(() => lessons.filter((l) => l.lesson_type === 'assignment' && l.active), [lessons]);

  const assignmentSubmissionCountByLesson = useMemo(() => {
    const map = new Map<string, number>();
    resources.forEach((r) => {
      if (r.description.startsWith('submission:')) {
        map.set(r.lesson_id, (map.get(r.lesson_id) ?? 0) + 1);
      }
    });
    return map;
  }, [resources]);

  const pendingAssignmentsCount = useMemo(
    () => assignmentLessons.filter((l) => (assignmentSubmissionCountByLesson.get(l.id) ?? 0) === 0).length,
    [assignmentLessons, assignmentSubmissionCountByLesson]
  );

  const submittedAssignmentsCount = assignmentLessons.length - pendingAssignmentsCount;

  // ── Top Dashboard ────────────────────────────────────────────────────────────

  const topDashboard = useMemo(() => {
    const totalEmployees = filteredEmployees.length;
    const courseIds = new Set(filteredEnrollments.map((e) => e.course_id));
    const totalCourses = courseIds.size;

    const courseById = new Map(courses.map((c) => [c.id, c]));
    const learningHours = filteredEnrollments
      .filter((e) => e.status === 'COMPLETED')
      .reduce((sum, e) => sum + (courseById.get(e.course_id)?.duration_hours ?? 0), 0);

    const completionPct = filteredEnrollments.length > 0
      ? Math.round(filteredEnrollments.reduce((sum, e) => sum + e.completion_percentage, 0) / filteredEnrollments.length)
      : 0;

    const certificatesIssued = filteredCertificates.filter((c) => c.generated).length;

    const averageScore = filteredResults.length > 0
      ? Math.round(filteredResults.reduce((sum, r) => sum + r.percentage, 0) / filteredResults.length)
      : 0;

    const failedAssessments = filteredResults.filter((r) => !r.passed).length;

    return { totalEmployees, totalCourses, learningHours, completionPct, certificatesIssued, averageScore, failedAssessments };
  }, [filteredEmployees, filteredEnrollments, courses, filteredCertificates, filteredResults]);

  // ── Charts ───────────────────────────────────────────────────────────────────

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const departmentById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const branchById = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);
  const assessmentById = useMemo(() => new Map(assessments.map((a) => [a.id, a])), [assessments]);

  function groupAverage(items: { key: string; value: number }[], nameFn: (key: string) => string): BarDatum[] {
    const map = new Map<string, { total: number; count: number }>();
    items.forEach(({ key, value }) => {
      const bucket = map.get(key) ?? { total: 0, count: 0 };
      bucket.total += value;
      bucket.count += 1;
      map.set(key, bucket);
    });
    return Array.from(map.entries())
      .map(([key, v]) => ({ label: nameFn(key), value: Math.round(v.total / v.count) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }

  const courseCompletionChart = groupAverage(
    filteredEnrollments.map((e) => ({ key: e.course_id, value: e.completion_percentage })),
    (id) => courseById.get(id)?.course_name ?? 'Unknown'
  );

  const departmentProgressChart = groupAverage(
    filteredEnrollments
      .map((e) => ({ deptId: employeeById.get(e.employee_id)?.department_id, value: e.completion_percentage }))
      .filter((x): x is { deptId: string; value: number } => !!x.deptId)
      .map((x) => ({ key: x.deptId, value: x.value })),
    (id) => departmentById.get(id)?.department_name ?? 'Unknown'
  );

  const branchProgressChart = groupAverage(
    filteredEnrollments
      .map((e) => ({ branchId: employeeById.get(e.employee_id)?.branch_id, value: e.completion_percentage }))
      .filter((x): x is { branchId: string; value: number } => !!x.branchId)
      .map((x) => ({ key: x.branchId, value: x.value })),
    (id) => branchById.get(id)?.branch_name ?? 'Unknown'
  );

  const monthlyLearningChart = useMemo(() => {
    const map = new Map<string, number>();
    filteredEnrollments.filter((e) => e.completed_at).forEach((e) => {
      const d = new Date(e.completed_at as string);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, value]) => ({ label: key, value }));
  }, [filteredEnrollments]);

  const assessmentPerformanceChart = groupAverage(
    filteredResults.map((r) => ({ key: r.assessment_id, value: r.percentage })),
    (id) => assessmentById.get(id)?.assessment_title ?? 'Unknown'
  );

  const assignmentCompletionChart: BarDatum[] = [
    { label: 'Submitted', value: assignmentLessons.length > 0 ? Math.round((submittedAssignmentsCount / assignmentLessons.length) * 100) : 0 },
    { label: 'Pending', value: assignmentLessons.length > 0 ? Math.round((pendingAssignmentsCount / assignmentLessons.length) * 100) : 0 },
  ];

  const certificateTrendChart = useMemo(() => {
    const map = new Map<string, number>();
    filteredCertificates.filter((c) => c.generated).forEach((c) => {
      const d = new Date(c.issue_date);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, value]) => ({ label: key, value }));
  }, [filteredCertificates]);

  // ── Leaderboard ──────────────────────────────────────────────────────────────

  const topLearners = useMemo(() => {
    const map = new Map<string, number[]>();
    filteredResults.forEach((r) => {
      const arr = map.get(r.employee_id) ?? [];
      arr.push(r.percentage);
      map.set(r.employee_id, arr);
    });
    return Array.from(map.entries())
      .map(([id, scores]) => ({ name: employeeById.get(id) ? `${employeeById.get(id)!.first_name} ${employeeById.get(id)!.last_name}` : id, value: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredResults, employeeById]);

  const topTrainers = useMemo(() => {
    return Array.from(trainerIds)
      .map((id) => ({ name: employeeById.get(id) ? `${employeeById.get(id)!.first_name} ${employeeById.get(id)!.last_name}` : id, value: trainerAssignments.filter((t) => t.trainer_id === id && t.is_active).length }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [trainerIds, trainerAssignments, employeeById]);

  const topDepartments = departmentProgressChart.slice(0, 5).map((d) => ({ name: d.label, value: d.value }));
  const topBranches = branchProgressChart.slice(0, 5).map((b) => ({ name: b.label, value: b.value }));

  // ── Report tables ────────────────────────────────────────────────────────────

  const reportTable = useMemo((): { headers: string[]; rows: string[][] } => {
    if (activeReport === 'employee') {
      return {
        headers: ['Employee', 'Company', 'Branch', 'Department', 'Enrollments', 'Avg Completion %'],
        rows: filteredEmployees.map((e) => {
          const empEnrollments = filteredEnrollments.filter((en) => en.employee_id === e.id);
          const avg = empEnrollments.length > 0 ? Math.round(empEnrollments.reduce((s, en) => s + en.completion_percentage, 0) / empEnrollments.length) : 0;
          return [
            `${e.first_name} ${e.last_name}`,
            companies.find((c) => c.id === e.company_id)?.company_name ?? '—',
            branchById.get(e.branch_id)?.branch_name ?? '—',
            departmentById.get(e.department_id)?.department_name ?? '—',
            String(empEnrollments.length),
            `${avg}%`,
          ];
        }),
      };
    }
    if (activeReport === 'course') {
      return {
        headers: ['Course', 'Enrollments', 'Avg Completion %', 'Completed'],
        rows: courses.map((c) => {
          const rows = filteredEnrollments.filter((en) => en.course_id === c.id);
          const avg = rows.length > 0 ? Math.round(rows.reduce((s, en) => s + en.completion_percentage, 0) / rows.length) : 0;
          return [c.course_name, String(rows.length), `${avg}%`, String(rows.filter((r) => r.status === 'COMPLETED').length)];
        }),
      };
    }
    if (activeReport === 'trainer') {
      return {
        headers: ['Trainer', 'Active Assignments'],
        rows: Array.from(trainerIds).map((id) => [
          employeeById.get(id) ? `${employeeById.get(id)!.first_name} ${employeeById.get(id)!.last_name}` : id,
          String(trainerAssignments.filter((t) => t.trainer_id === id && t.is_active).length),
        ]),
      };
    }
    if (activeReport === 'department') {
      return {
        headers: ['Department', 'Employees', 'Avg Completion %'],
        rows: departments.map((d) => {
          const empIds = new Set(employees.filter((e) => e.department_id === d.id).map((e) => e.id));
          const rows = filteredEnrollments.filter((en) => empIds.has(en.employee_id));
          const avg = rows.length > 0 ? Math.round(rows.reduce((s, en) => s + en.completion_percentage, 0) / rows.length) : 0;
          return [d.department_name, String(empIds.size), `${avg}%`];
        }),
      };
    }
    if (activeReport === 'branch') {
      return {
        headers: ['Branch', 'Employees', 'Avg Completion %'],
        rows: branches.map((b) => {
          const empIds = new Set(employees.filter((e) => e.branch_id === b.id).map((e) => e.id));
          const rows = filteredEnrollments.filter((en) => empIds.has(en.employee_id));
          const avg = rows.length > 0 ? Math.round(rows.reduce((s, en) => s + en.completion_percentage, 0) / rows.length) : 0;
          return [b.branch_name, String(empIds.size), `${avg}%`];
        }),
      };
    }
    if (activeReport === 'assessment') {
      return {
        headers: ['Assessment', 'Attempts', 'Pass %', 'Avg Score'],
        rows: assessments.map((a) => {
          const rows = filteredResults.filter((r) => r.assessment_id === a.id);
          const passPct = rows.length > 0 ? Math.round((rows.filter((r) => r.passed).length / rows.length) * 100) : 0;
          const avg = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.percentage, 0) / rows.length) : 0;
          return [a.assessment_title, String(rows.length), `${passPct}%`, `${avg}%`];
        }),
      };
    }
    if (activeReport === 'assignment') {
      return {
        headers: ['Assignment', 'Submissions', 'Status'],
        rows: assignmentLessons.map((l) => {
          const count = assignmentSubmissionCountByLesson.get(l.id) ?? 0;
          return [l.lesson_title || 'Untitled', String(count), count > 0 ? 'Has Submissions' : 'Pending'];
        }),
      };
    }
    if (activeReport === 'certificate') {
      return {
        headers: ['Employee', 'Certificate No', 'Issue Date', 'Status'],
        rows: filteredCertificates.map((c) => [
          employeeById.get(c.employee_id) ? `${employeeById.get(c.employee_id)!.first_name} ${employeeById.get(c.employee_id)!.last_name}` : c.employee_id,
          c.certificate_no || '—',
          c.issue_date ? new Date(c.issue_date).toLocaleDateString() : '—',
          c.generated ? 'Issued' : 'Pending',
        ]),
      };
    }
    if (activeReport === 'learningPath') {
      return {
        headers: ['Learning Path', 'Enrolled', 'Completed', 'Avg Progress %'],
        rows: learningPaths.map((lp) => {
          const enr = filteredPathEnrollments.filter((e) => e.learning_path_id === lp.id);
          const prog = filteredPathProgress.filter((p) => p.learning_path_id === lp.id);
          const avg = prog.length > 0 ? Math.round(prog.reduce((s, p) => s + p.progress_percentage, 0) / prog.length) : 0;
          return [lp.path_name, String(enr.length), String(prog.filter((p) => p.status === 'completed').length), `${avg}%`];
        }),
      };
    }
    // enrollment
    return {
      headers: ['Employee', 'Course', 'Status', 'Completion %', 'Assigned Date'],
      rows: filteredEnrollments.map((en) => [
        employeeById.get(en.employee_id) ? `${employeeById.get(en.employee_id)!.first_name} ${employeeById.get(en.employee_id)!.last_name}` : en.employee_id,
        courseById.get(en.course_id)?.course_name ?? '—',
        en.status,
        `${en.completion_percentage}%`,
        en.assigned_at ? new Date(en.assigned_at).toLocaleDateString() : '—',
      ]),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport, filteredEmployees, filteredEnrollments, courses, trainerIds, trainerAssignments, departments,
      employees, branches, assessments, filteredResults, assignmentLessons, assignmentSubmissionCountByLesson,
      filteredCertificates, learningPaths, filteredPathEnrollments, filteredPathProgress]);

  // ── Export ───────────────────────────────────────────────────────────────────

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

  function handleExportCsv() {
    const { headers, rows } = reportTable;
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadBlob(csv, `${activeReport}_report.csv`, 'text/csv');
    showToast('CSV exported');
  }

  function handleExportExcel() {
    const { headers, rows } = reportTable;
    const table = `
      <table border="1">
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;
    downloadBlob(table, `${activeReport}_report.xls`, 'application/vnd.ms-excel');
    showToast('Excel file exported');
  }

  function handlePrint() {
    window.print();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">

      {/* FILTERS */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Companies</option>
          {companies.map((c) => (<option key={c.id} value={c.id}>{c.company_name}</option>))}
        </select>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Branches</option>
          {branches.map((b) => (<option key={b.id} value={b.id}>{b.branch_name}</option>))}
        </select>
        <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Departments</option>
          {departments.map((d) => (<option key={d.id} value={d.id}>{d.department_name}</option>))}
        </select>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Roles</option>
          {roles.map((r) => (<option key={r.id} value={r.id}>{r.role_name}</option>))}
        </select>
        <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Employees</option>
          {employees.map((e) => (<option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>))}
        </select>
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Courses</option>
          {courses.map((c) => (<option key={c.id} value={c.id}>{c.course_name}</option>))}
        </select>
        <select value={trainerFilter} onChange={(e) => setTrainerFilter(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Trainers</option>
          {Array.from(trainerIds).map((id) => (<option key={id} value={id}>{employeeById.get(id) ? `${employeeById.get(id)!.first_name} ${employeeById.get(id)!.last_name}` : id}</option>))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
        <span className="text-xs text-slate-400">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
      </div>

      {/* TOP DASHBOARD */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Employees" value={topDashboard.totalEmployees} accent="border-slate-200" />
        <SummaryCard label="Total Courses" value={topDashboard.totalCourses} accent="border-slate-200" />
        <SummaryCard label="Learning Hours" value={topDashboard.learningHours} accent="border-blue-200" />
        <SummaryCard label="Completion %" value={`${topDashboard.completionPct}%`} accent="border-emerald-200" />
        <SummaryCard label="Certificates Issued" value={topDashboard.certificatesIssued} accent="border-indigo-200" />
        <SummaryCard label="Average Score" value={`${topDashboard.averageScore}%`} accent="border-emerald-200" />
        <SummaryCard label="Pending Assignments" value={pendingAssignmentsCount} accent="border-amber-200" />
        <SummaryCard label="Failed Assessments" value={topDashboard.failedAssessments} accent="border-red-200" />
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Course Completion"><BarChart data={courseCompletionChart} /></ChartCard>
        <ChartCard title="Department Progress"><BarChart data={departmentProgressChart} /></ChartCard>
        <ChartCard title="Branch Progress"><BarChart data={branchProgressChart} /></ChartCard>
        <ChartCard title="Monthly Learning"><BarChart data={monthlyLearningChart} suffix="" /></ChartCard>
        <ChartCard title="Assessment Performance"><BarChart data={assessmentPerformanceChart} /></ChartCard>
        <ChartCard title="Assignment Completion"><BarChart data={assignmentCompletionChart} /></ChartCard>
        <ChartCard title="Certificate Trend"><BarChart data={certificateTrendChart} suffix="" /></ChartCard>
      </div>

      {/* LEADERBOARD */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Leaderboard</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Top Learners', rows: topLearners, suffix: '%' },
            { title: 'Top Trainers', rows: topTrainers, suffix: '' },
            { title: 'Top Departments', rows: topDepartments, suffix: '%' },
            { title: 'Top Branches', rows: topBranches, suffix: '%' },
          ].map((board) => (
            <div key={board.title}>
              <p className="mb-2 text-xs font-semibold text-slate-500">{board.title}</p>
              {board.rows.length === 0 ? (
                <EmptyWidget message="No data yet." />
              ) : (
                <ol className="space-y-1.5">
                  {board.rows.map((r, i) => (
                    <li key={r.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm">
                      <span className="truncate text-slate-700">{i + 1}. {r.name}</span>
                      <span className="flex-shrink-0 text-xs font-semibold text-indigo-600">{r.value}{board.suffix}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* REPORTS */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Reports</h3>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={handleExportCsv}>CSV</SecondaryButton>
            <SecondaryButton onClick={handleExportExcel}>Excel Ready</SecondaryButton>
            <PrimaryButton onClick={handlePrint}>Print Friendly</PrimaryButton>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveReport(tab.key)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${activeReport === tab.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {reportTable.rows.length === 0 ? (
          <EmptyWidget message="No data available for this report yet." />
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  {reportTable.headers.map((h) => (<th key={h} className="pb-2 pr-3">{h}</th>))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportTable.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (<td key={j} className="py-2 pr-3 text-slate-600">{cell}</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

export default ReportsAnalytics;