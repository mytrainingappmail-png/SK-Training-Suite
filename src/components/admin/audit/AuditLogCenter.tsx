// src/components/admin/audit/AuditLogCenter.tsx
//
// Professional Audit Log Center. There is no audit log table, service, or
// repository anywhere in this app — confirmed before writing anything
// here. There is also no request-level logging, so IP Address / Device /
// Browser have no real source anywhere and are shown as "—" rather than
// fabricated.
//
// The log itself is real, though: rather than a fake, empty "temporary
// state" page, entries are derived from the actual timestamped columns
// (created_at / updated_at / issue_date / assigned_at / completed_at /
// evaluated_at / enrolled_date etc.) already returned by existing,
// unmodified services — the exact same technique already used for
// Dashboard.tsx's Recent Activity and ReportsAnalytics.tsx's charts:
//   companyService, branchService, departmentService, employeeService,
//   roleService, employeeRoleService, courseService,
//   lessonBuilderService, enrollmentService, assessmentService,
//   assessmentResultService, resourceService, certificateService,
//   learningPathService, learningPathEnrollmentService
//
// License / Branding / Feature Toggle changes (session-local in their own
// files) and Notifications/Reports have no reliable timestamp source
// reachable from here, so they appear as selectable Module filters with
// no entries yet, rather than invented history. No repository, service,
// or database changes.

import { useEffect, useMemo, useState } from 'react';

import { loadCompanies } from '../../../services/company/companyService';
import { branchService } from '../../../services/branch/branchService';
import { departmentService } from '../../../services/department/departmentService';
import { loadRoles } from '../../../services/role/roleService';
import { loadEmployeeRoles } from '../../../services/employeeRole/employeeRoleService';
import { employeeService } from '../../../services/employee/employeeService';
import { loadCourses } from '../../../services/course/courseService';
import { loadLessons } from '../../../services/lessonBuilder/lessonBuilderService';
import { loadEnrollments } from '../../../services/enrollment/enrollmentService';
import { loadAssessments } from '../../../services/assessment/assessmentService';
import { loadResults } from '../../../services/assessmentResult/assessmentResultService';
import { loadResources } from '../../../services/resource/resourceService';
import { loadCertificates } from '../../../services/certificate/certificateService';
import { loadLearningPaths } from '../../../services/learningPath/learningPathService';
import { loadEnrollments as loadPathEnrollments } from '../../../services/learningPathEnrollment/learningPathEnrollmentService';

import type { Company } from '../../../types/company';
import type { Branch } from '../../../types/branch';
import type { Department } from '../../../types/department';
import type { Role } from '../../../types/role';
import type { EmployeeRole } from '../../../types/employeeRole';
import type { Employee } from '../../../types/employee';
import type { Course } from '../../../types/course';
import type { Lesson } from '../../../types/lessonBuilder';
import type { Enrollment } from '../../../types/enrollment';
import type { Assessment } from '../../../types/assessment';
import type { AssessmentResult } from '../../../types/assessmentResult';
import type { Resource } from '../../../types/resource';
import type { Certificate } from '../../../types/certificate';
import type { LearningPath } from '../../../types/learningPath';
import type { LearningPathEnrollment } from '../../../types/learningPathEnrollment';

// ─────────────────────────────────────────────────────────────────────────────
// Audit domain
// ─────────────────────────────────────────────────────────────────────────────

type ActivityType =
  | 'Login' | 'Logout' | 'Create' | 'Update' | 'Delete' | 'Publish' | 'Assign' | 'Complete'
  | 'Certificate Issued' | 'Assessment Submitted' | 'Assignment Submitted' | 'Enrollment'
  | 'Role Change' | 'Permission Change' | 'License Update' | 'Branding Update' | 'Feature Toggle Update';

const ACTIVITY_TYPES: ActivityType[] = [
  'Login', 'Logout', 'Create', 'Update', 'Delete', 'Publish', 'Assign', 'Complete',
  'Certificate Issued', 'Assessment Submitted', 'Assignment Submitted', 'Enrollment',
  'Role Change', 'Permission Change', 'License Update', 'Branding Update', 'Feature Toggle Update',
];

const MODULES = [
  'Companies', 'Branches', 'Departments', 'Employees', 'Roles', 'Courses', 'Course Builder',
  'Content Editor', 'Assessments', 'Assignments', 'Certificates', 'Enrollments', 'Learning Paths',
  'Notifications', 'Reports', 'License', 'Branding', 'Feature Toggle',
];

type Severity = 'info' | 'warning' | 'critical';

const SEVERITY_LABEL: Record<Severity, string> = { info: 'Info', warning: 'Warning', critical: 'Critical' };
const SEVERITY_STYLES: Record<Severity, string> = {
  info:     'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  warning:  'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  critical: 'bg-red-50 text-red-700 ring-1 ring-red-200',
};

interface AuditEntry {
  id:            string;
  timestamp:     string;
  userName:      string;
  companyId:     string;
  companyName:   string;
  module:        string;
  action:        ActivityType;
  description:   string;
  severity:      Severity;
  ipAddress:     string;
  device:        string;
  browser:       string;
  beforeValue:   string;
  afterValue:    string;
  changedFields: string[];
}

function fmtName(e: Employee | undefined): string {
  return e ? `${e.first_name} ${e.last_name}` : 'System';
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons + shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function IconX({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function ActivityIcon({ action, className = 'h-4 w-4' }: { action: ActivityType; className?: string }) {
  if (action === 'Delete') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
      </svg>
    );
  }
  if (action === 'Update' || action === 'Role Change' || action === 'Permission Change') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
      </svg>
    );
  }
  if (action === 'Publish' || action === 'Complete' || action === 'Assessment Submitted' || action === 'Assignment Submitted') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    );
  }
  if (action === 'Certificate Issued') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    );
  }
  if (action === 'Enrollment' || action === 'Assign') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
      </svg>
    );
  }
  if (action === 'Login' || action === 'Logout') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H3" />
      </svg>
    );
  }
  if (action === 'License Update' || action === 'Branding Update' || action === 'Feature Toggle Update') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.752.43.992l1.005.828c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.752-.43-.992l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
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

function PrimaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`inline-flex flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[severity]}`}>{SEVERITY_LABEL[severity]}</span>;
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load audit data</p>
      <p className="mt-1">{message}</p>
      <SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

function DetailDialog({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Activity Detail</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><IconX /></button>
        </div>
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{entry.module} · {entry.action}</span>
          <SeverityBadge severity={entry.severity} />
        </div>
        <p className="mb-4 text-sm text-slate-600">{entry.description}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="mb-1 text-xs font-semibold text-slate-400">Before Value</p>
            <p className="text-sm text-slate-700">{entry.beforeValue}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="mb-1 text-xs font-semibold text-slate-400">After Value</p>
            <p className="text-sm text-slate-700">{entry.afterValue}</p>
          </div>
        </div>
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold text-slate-400">Changed Fields</p>
          <div className="flex flex-wrap gap-1.5">
            {entry.changedFields.length === 0 ? (
              <span className="text-sm text-slate-400">None</span>
            ) : (
              entry.changedFields.map((f) => (<span key={f} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{f}</span>))
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-400">
          <div><p className="font-semibold text-slate-500">IP Address</p><p>{entry.ipAddress}</p></div>
          <div><p className="font-semibold text-slate-500">Device</p><p>{entry.device}</p></div>
          <div><p className="font-semibold text-slate-500">Browser</p><p>{entry.browser}</p></div>
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold text-slate-400">Affected Module</p>
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{entry.module}</span>
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold text-slate-400">JSON Viewer</p>
          <pre className="max-h-48 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-emerald-300">
{JSON.stringify({
  timestamp: entry.timestamp,
  user: entry.userName,
  company: entry.companyName,
  module: entry.module,
  action: entry.action,
  severity: entry.severity,
  before: entry.beforeValue,
  after: entry.afterValue,
  changedFields: entry.changedFields,
}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main AuditLogCenter
// ─────────────────────────────────────────────────────────────────────────────

function AuditLogCenter() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employeeRoles, setEmployeeRoles] = useState<EmployeeRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [pathEnrollments, setPathEnrollments] = useState<LearningPathEnrollment[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [companyFilter, setCompanyFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState<'all' | ActivityType>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([
      loadCompanies(), branchService.getAll(), departmentService.getAll(), loadRoles(), loadEmployeeRoles(),
      employeeService.getAll(), loadCourses(), loadLessons(), loadEnrollments(), loadAssessments(),
      loadResults(), loadResources(), loadCertificates(), loadLearningPaths(), loadPathEnrollments(),
    ])
      .then(([companyRows, branchRows, departmentRows, roleRows, employeeRoleRows, employeeRows, courseRows,
        lessonRows, enrollmentRows, assessmentRows, resultRows, resourceRows, certificateRows, pathRows, pathEnrollRows]) => {
        setCompanies(companyRows);
        setBranches(branchRows);
        setDepartments(departmentRows);
        setRoles(roleRows);
        setEmployeeRoles(employeeRoleRows);
        setEmployees(employeeRows);
        setCourses(courseRows);
        setLessons(lessonRows);
        setEnrollments(enrollmentRows);
        setAssessments(assessmentRows);
        setResults(resultRows);
        setResources(resourceRows);
        setCertificates(certificateRows);
        setLearningPaths(pathRows);
        setPathEnrollments(pathEnrollRows);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load audit data.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  // ── Derive real audit entries from real timestamped data ────────────────────

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const companyById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  const auditEntries = useMemo((): AuditEntry[] => {
    const entries: AuditEntry[] = [];
    let seq = 0;
    function push(e: Omit<AuditEntry, 'id' | 'ipAddress' | 'device' | 'browser'>) {
      seq += 1;
      entries.push({ ...e, id: `audit-${seq}`, ipAddress: '—', device: '—', browser: '—' });
    }

    companies.forEach((c) => {
      push({
        timestamp: c.created_at, userName: 'System', companyId: c.id, companyName: c.company_name,
        module: 'Companies', action: 'Create', description: `Company "${c.company_name}" created.`,
        severity: 'info', beforeValue: 'N/A (new record)', afterValue: c.company_name, changedFields: ['company_name'],
      });
      if (c.updated_at && c.updated_at !== c.created_at) {
        push({
          timestamp: c.updated_at, userName: 'System', companyId: c.id, companyName: c.company_name,
          module: 'Companies', action: c.active ? 'Publish' : 'Update',
          description: `Company "${c.company_name}" ${c.active ? 'activated' : 'updated'}.`,
          severity: 'info', beforeValue: c.active ? 'Inactive' : 'Previous state', afterValue: c.active ? 'Active' : 'Updated',
          changedFields: ['active'],
        });
      }
    });

    branches.forEach((b) => {
      push({
        timestamp: b.created_at, userName: 'System', companyId: b.company_id,
        companyName: companyById.get(b.company_id)?.company_name ?? '—', module: 'Branches', action: 'Create',
        description: `Branch "${b.branch_name}" created.`, severity: 'info',
        beforeValue: 'N/A (new record)', afterValue: b.branch_name, changedFields: ['branch_name'],
      });
    });

    departments.forEach((d) => {
      push({
        timestamp: d.created_at, userName: 'System', companyId: d.company_id,
        companyName: companyById.get(d.company_id)?.company_name ?? '—', module: 'Departments', action: 'Create',
        description: `Department "${d.department_name}" created.`, severity: 'info',
        beforeValue: 'N/A (new record)', afterValue: d.department_name, changedFields: ['department_name'],
      });
    });

    employees.forEach((e) => {
      push({
        timestamp: e.created_at, userName: fmtName(e), companyId: e.company_id,
        companyName: companyById.get(e.company_id)?.company_name ?? '—', module: 'Employees', action: 'Create',
        description: `Employee "${fmtName(e)}" added.`, severity: 'info',
        beforeValue: 'N/A (new record)', afterValue: fmtName(e), changedFields: ['first_name', 'last_name'],
      });
      if (!e.active) {
        push({
          timestamp: e.updated_at || e.created_at, userName: fmtName(e), companyId: e.company_id,
          companyName: companyById.get(e.company_id)?.company_name ?? '—', module: 'Employees', action: 'Update',
          description: `Employee "${fmtName(e)}" deactivated.`, severity: 'warning',
          beforeValue: 'Active', afterValue: 'Inactive', changedFields: ['active'],
        });
      }
    });

    employeeRoles.filter((er) => er.active).forEach((er) => {
      const emp = employeeById.get(er.employee_id);
      push({
        timestamp: er.assigned_date || er.created_at, userName: fmtName(emp), companyId: emp?.company_id ?? '',
        companyName: emp ? companyById.get(emp.company_id)?.company_name ?? '—' : '—', module: 'Roles', action: 'Role Change',
        description: `Role assigned to "${fmtName(emp)}".`, severity: 'warning',
        beforeValue: 'No role', afterValue: roles.find((r) => r.id === er.role_id)?.role_name ?? 'Role', changedFields: ['role_id'],
      });
    });

    courses.forEach((c) => {
      push({
        timestamp: c.created_at, userName: 'System', companyId: c.company_id,
        companyName: companyById.get(c.company_id)?.company_name ?? '—', module: 'Course Builder', action: 'Create',
        description: `Course "${c.course_name}" created.`, severity: 'info',
        beforeValue: 'N/A (new record)', afterValue: c.course_name, changedFields: ['course_name'],
      });
    });

    lessons.forEach((l) => {
      push({
        timestamp: l.created_at, userName: 'System', companyId: '', companyName: '—', module: 'Content Editor', action: 'Create',
        description: `Lesson "${l.lesson_title || 'Untitled'}" created.`, severity: 'info',
        beforeValue: 'N/A (new record)', afterValue: l.lesson_title || 'Untitled', changedFields: ['lesson_title', 'content'],
      });
    });

    enrollments.forEach((en) => {
      const emp = employeeById.get(en.employee_id);
      push({
        timestamp: en.assigned_at, userName: fmtName(emp), companyId: en.company_id,
        companyName: companyById.get(en.company_id)?.company_name ?? '—', module: 'Enrollments', action: 'Enrollment',
        description: `${fmtName(emp)} enrolled in "${courseById.get(en.course_id)?.course_name ?? 'a course'}".`,
        severity: 'info', beforeValue: 'Not enrolled', afterValue: en.status, changedFields: ['status'],
      });
      if (en.completed_at) {
        push({
          timestamp: en.completed_at, userName: fmtName(emp), companyId: en.company_id,
          companyName: companyById.get(en.company_id)?.company_name ?? '—', module: 'Enrollments', action: 'Complete',
          description: `${fmtName(emp)} completed "${courseById.get(en.course_id)?.course_name ?? 'a course'}".`,
          severity: 'info', beforeValue: 'In Progress', afterValue: 'Completed', changedFields: ['status', 'completion_percentage'],
        });
      }
    });

    assessments.forEach((a) => {
      push({
        timestamp: a.created_at, userName: 'System', companyId: '', companyName: '—', module: 'Assessments', action: 'Create',
        description: `Assessment "${a.assessment_title}" created.`, severity: 'info',
        beforeValue: 'N/A (new record)', afterValue: a.assessment_title, changedFields: ['assessment_title'],
      });
    });

    results.forEach((r) => {
      const emp = employeeById.get(r.employee_id);
      push({
        timestamp: r.evaluated_at, userName: fmtName(emp), companyId: '', companyName: '—', module: 'Assessments',
        action: 'Assessment Submitted', description: `${fmtName(emp)} scored ${r.percentage.toFixed(1)}%.`,
        severity: r.passed ? 'info' : 'warning', beforeValue: 'Pending', afterValue: r.passed ? 'Passed' : 'Failed',
        changedFields: ['percentage', 'passed'],
      });
    });

    resources.filter((r) => r.description.startsWith('submission:')).forEach((r) => {
      const employeeId = r.description.replace('submission:', '');
      const emp = employeeById.get(employeeId);
      push({
        timestamp: r.created_at, userName: fmtName(emp), companyId: '', companyName: '—', module: 'Assignments',
        action: 'Assignment Submitted', description: `${fmtName(emp)} submitted an assignment.`,
        severity: 'info', beforeValue: 'Not submitted', afterValue: 'Submitted', changedFields: ['file_url'],
      });
    });

    certificates.filter((c) => c.generated).forEach((c) => {
      const emp = employeeById.get(c.employee_id);
      push({
        timestamp: c.issue_date, userName: fmtName(emp), companyId: '', companyName: '—', module: 'Certificates',
        action: 'Certificate Issued', description: `Certificate issued to ${fmtName(emp)}.`,
        severity: 'info', beforeValue: 'Not issued', afterValue: 'Issued', changedFields: ['generated', 'issue_date'],
      });
    });

    learningPaths.forEach((lp) => {
      push({
        timestamp: lp.created_at, userName: 'System', companyId: '', companyName: '—', module: 'Learning Paths', action: 'Create',
        description: `Learning path "${lp.path_name}" created.`, severity: 'info',
        beforeValue: 'N/A (new record)', afterValue: lp.path_name, changedFields: ['path_name'],
      });
    });

    pathEnrollments.forEach((pe) => {
      const emp = employeeById.get(pe.employee_id);
      push({
        timestamp: pe.enrolled_date, userName: fmtName(emp), companyId: pe.company_id,
        companyName: companyById.get(pe.company_id)?.company_name ?? '—', module: 'Learning Paths', action: 'Assign',
        description: `${fmtName(emp)} assigned to a learning path.`, severity: 'info',
        beforeValue: 'Not assigned', afterValue: pe.status, changedFields: ['status'],
      });
    });

    return entries
      .filter((e) => e.timestamp && !Number.isNaN(new Date(e.timestamp).getTime()))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [companies, branches, departments, roles, employeeRoles, employees, courses, lessons, enrollments,
      assessments, results, resources, certificates, learningPaths, pathEnrollments, employeeById, companyById, courseById]);

  // ── Filtering ────────────────────────────────────────────────────────────────

  const employeeIdsInScope = useMemo(() => {
    return new Set(
      employees
        .filter((e) => {
          if (companyFilter !== 'all' && e.company_id !== companyFilter) return false;
          if (branchFilter !== 'all' && e.branch_id !== branchFilter) return false;
          if (departmentFilter !== 'all' && e.department_id !== departmentFilter) return false;
          if (employeeFilter !== 'all' && e.id !== employeeFilter) return false;
          if (roleFilter !== 'all' && !employeeRoles.some((er) => er.active && er.employee_id === e.id && er.role_id === roleFilter)) return false;
          return true;
        })
        .map((e) => e.id)
    );
  }, [employees, employeeRoles, companyFilter, branchFilter, departmentFilter, employeeFilter, roleFilter]);

  const searchTerm = search.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    return auditEntries.filter((entry) => {
      if (companyFilter !== 'all' && entry.companyId && entry.companyId !== companyFilter) return false;
      if (moduleFilter !== 'all' && entry.module !== moduleFilter) return false;
      if (actionFilter !== 'all' && entry.action !== actionFilter) return false;
      if (severityFilter !== 'all' && entry.severity !== severityFilter) return false;
      if (dateFrom && new Date(entry.timestamp).getTime() < new Date(dateFrom).getTime()) return false;
      if (dateTo && new Date(entry.timestamp).getTime() > new Date(dateTo).getTime() + 86400000) return false;
      const matchingEmployee = employees.find((e) => fmtName(e) === entry.userName);
      if ((branchFilter !== 'all' || departmentFilter !== 'all' || employeeFilter !== 'all' || roleFilter !== 'all')
        && matchingEmployee && !employeeIdsInScope.has(matchingEmployee.id)) return false;
      if (searchTerm) {
        const haystack = `${entry.description} ${entry.userName} ${entry.companyName} ${entry.module} ${entry.action}`.toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }
      return true;
    });
  }, [auditEntries, companyFilter, moduleFilter, actionFilter, severityFilter, dateFrom, dateTo, employees, employeeIdsInScope, searchTerm]);

  // ── Top summary ──────────────────────────────────────────────────────────────

  const topSummary = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 6 * 86400000;
    let today = 0, week = 0, critical = 0, failed = 0;
    filteredEntries.forEach((e) => {
      const t = new Date(e.timestamp).getTime();
      if (t >= startOfToday) today += 1;
      if (t >= startOfWeek) week += 1;
      if (e.severity === 'critical') critical += 1;
      if (e.afterValue === 'Failed') failed += 1;
    });
    return { total: filteredEntries.length, today, week, critical, failed };
  }, [filteredEntries]);

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

  const exportHeaders = ['Time', 'User', 'Company', 'Module', 'Action', 'Description', 'Severity'];
  function exportRows(): string[][] {
    return filteredEntries.map((e) => [
      new Date(e.timestamp).toLocaleString(), e.userName, e.companyName || '—', e.module, e.action, e.description, SEVERITY_LABEL[e.severity],
    ]);
  }

  function handleExportCsv() {
    const rows = exportRows();
    const csv = [exportHeaders, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadBlob(csv, 'audit_log.csv', 'text/csv');
  }

  function handleExportExcel() {
    const rows = exportRows();
    const table = `<table border="1"><thead><tr>${exportHeaders.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    downloadBlob(table, 'audit_log.xls', 'application/vnd.ms-excel');
  }

  function handlePrint() {
    window.print();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">

      {/* STICKY TOOLBAR */}
      <div className="sticky top-0 z-20 space-y-3 rounded-2xl bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Instant search across all activity…"
              className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </div>
          <SecondaryButton onClick={handleExportCsv}>CSV</SecondaryButton>
          <SecondaryButton onClick={handleExportExcel}>Excel Ready</SecondaryButton>
          <PrimaryButton onClick={handlePrint}>Print</PrimaryButton>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            <option value="all">All Employees / Users</option>
            {employees.map((e) => (<option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>))}
          </select>
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
            <option value="all">All Modules</option>
            {MODULES.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value as 'all' | ActivityType)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
            <option value="all">All Actions</option>
            {ACTIVITY_TYPES.map((a) => (<option key={a} value={a}>{a}</option>))}
          </select>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as 'all' | Severity)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
            <option value="all">All Severities</option>
            {(Object.keys(SEVERITY_LABEL) as Severity[]).map((s) => (<option key={s} value={s}>{SEVERITY_LABEL[s]}</option>))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
          <span className="text-xs text-slate-400">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" />
        </div>
      </div>

      {/* TOP SUMMARY */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SummaryCard label="Total Activities" value={topSummary.total} accent="border-slate-200" />
        <SummaryCard label="Today's Activities" value={topSummary.today} accent="border-blue-200" />
        <SummaryCard label="This Week" value={topSummary.week} accent="border-indigo-200" />
        <SummaryCard label="Critical Events" value={topSummary.critical} accent="border-red-200" />
        <SummaryCard label="Failed Actions" value={topSummary.failed} accent="border-amber-200" />
      </div>

      {/* ACTIVITY TIMELINE */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Activity Timeline</h3>

        {filteredEntries.length === 0 ? (
          <EmptyState message="No activity matches these filters yet." />
        ) : (
          <div className="max-h-[640px] space-y-2.5 overflow-y-auto pr-1">
            {filteredEntries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className="flex w-full items-start gap-3 rounded-2xl border border-slate-100 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-sm"
              >
                <span
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                    entry.severity === 'critical' ? 'bg-red-50 text-red-600'
                      : entry.severity === 'warning' ? 'bg-amber-50 text-amber-600'
                      : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  <ActivityIcon action={entry.action} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800">{entry.action}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{entry.module}</span>
                    <SeverityBadge severity={entry.severity} />
                  </div>
                  <p className="truncate text-sm text-slate-600">{entry.description}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                    <span>{new Date(entry.timestamp).toLocaleString()}</span>
                    <span>·</span>
                    <span>{entry.userName}</span>
                    {entry.companyName && entry.companyName !== '—' && (
                      <>
                        <span>·</span>
                        <span>{entry.companyName}</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedEntry && <DetailDialog entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
    </div>
  );
}

export default AuditLogCenter;