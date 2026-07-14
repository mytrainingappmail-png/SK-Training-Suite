// src/components/admin/enrollment/EnrollmentManagement.tsx
//
// Professional Enrollment Management — reuses only existing, unmodified
// architecture:
//   enrollmentService  (loadEnrollments / createEnrollment /
//                        removeEnrollment / toggleIsActive)
//   companyService, branchService, departmentService, roleService,
//   employeeRoleService, employeeService, courseService — every filter and
//   every joined display field (company/branch/department/role names,
//   "Assigned By", Certificate Status via enrollment.certificate_id) comes
//   from these, reused exactly as elsewhere in the app.
//
// No repository/service/database changes. Anything with no real column
// anywhere (e.g. a dedicated "suspend reason" or CSV export service) is
// either derived from real existing fields (is_active already IS the real
// suspend/resume flag) or implemented as a native browser feature (CSV
// export via Blob, no new dependency).

import { useEffect, useMemo, useState } from 'react';

import { loadCompanies } from '../../../services/company/companyService';
import { branchService } from '../../../services/branch/branchService';
import { departmentService } from '../../../services/department/departmentService';
import { loadRoles } from '../../../services/role/roleService';
import { loadEmployeeRoles } from '../../../services/employeeRole/employeeRoleService';
import { employeeService } from '../../../services/employee/employeeService';
import { loadCourses } from '../../../services/course/courseService';
import {
  loadEnrollments,
  createEnrollment,
  removeEnrollment,
  toggleIsActive,
} from '../../../services/enrollment/enrollmentService';

import type { Company } from '../../../types/company';
import type { Branch } from '../../../types/branch';
import type { Department } from '../../../types/department';
import type { Role } from '../../../types/role';
import type { EmployeeRole } from '../../../types/employeeRole';
import type { Employee } from '../../../types/employee';
import type { Course } from '../../../types/course';
import type { Enrollment, EnrollmentStatus } from '../../../types/enrollment';

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
function IconTrash({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
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

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

const STATUS_STYLES: Record<EnrollmentStatus, string> = {
  PENDING:     'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  COMPLETED:   'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  EXPIRED:     'bg-red-50 text-red-700 ring-1 ring-red-200',
  CANCELLED:   'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
};

function StatusBadge({ status, isActive }: { status: EnrollmentStatus; isActive: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status.replace('_', ' ')}
      {!isActive && status !== 'CANCELLED' && ' · Suspended'}
    </span>
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

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load enrollment data</p>
      <p className="mt-1">{message}</p>
      <SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton>
    </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// Main EnrollmentManagement
// ─────────────────────────────────────────────────────────────────────────────

function EnrollmentManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employeeRoles, setEmployeeRoles] = useState<EmployeeRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [companyFilter, setCompanyFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | EnrollmentStatus>('all');
  const [search, setSearch] = useState('');

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [activeEmployeeId, setActiveEmployeeId] = useState('');

  const [assignCourseId, setAssignCourseId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [bulkCourseId, setBulkCourseId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<Enrollment | null>(null);
  const [removing, setRemoving] = useState(false);
  const [busyEnrollmentId, setBusyEnrollmentId] = useState('');

  const [showStatistics, setShowStatistics] = useState(false);

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
      loadRoles(),
      loadEmployeeRoles(),
      employeeService.getAll(),
      loadCourses(),
      loadEnrollments(),
    ])
      .then(([companyRows, branchRows, departmentRows, roleRows, employeeRoleRows, employeeRows, courseRows, enrollmentRows]) => {
        setCompanies(companyRows);
        setBranches(branchRows);
        setDepartments(departmentRows);
        setRoles(roleRows);
        setEmployeeRoles(employeeRoleRows);
        setEmployees(employeeRows);
        setCourses(courseRows);
        setEnrollments(enrollmentRows);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load enrollment data.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  // ── Derived lookups ──────────────────────────────────────────────────────────

  const companyById    = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const branchById      = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);
  const departmentById  = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const courseById      = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const employeeById    = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const roleIdsByEmployee = useMemo(() => {
    const map = new Map<string, Set<string>>();
    employeeRoles.filter((er) => er.active).forEach((er) => {
      const set = map.get(er.employee_id) ?? new Set<string>();
      set.add(er.role_id);
      map.set(er.employee_id, set);
    });
    return map;
  }, [employeeRoles]);

  const enrollmentsByEmployee = useMemo(() => {
    const map = new Map<string, Enrollment[]>();
    enrollments.forEach((en) => {
      const list = map.get(en.employee_id) ?? [];
      list.push(en);
      map.set(en.employee_id, list);
    });
    return map;
  }, [enrollments]);

  // ── Filtering ────────────────────────────────────────────────────────────────

  const searchTerm = search.trim().toLowerCase();

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (companyFilter !== 'all' && emp.company_id !== companyFilter) return false;
      if (branchFilter !== 'all' && emp.branch_id !== branchFilter) return false;
      if (departmentFilter !== 'all' && emp.department_id !== departmentFilter) return false;
      if (roleFilter !== 'all' && !(roleIdsByEmployee.get(emp.id)?.has(roleFilter))) return false;
      if (searchTerm) {
        const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
        if (!fullName.includes(searchTerm) && !emp.employee_code.toLowerCase().includes(searchTerm)) return false;
      }
      return true;
    });
  }, [employees, companyFilter, branchFilter, departmentFilter, roleFilter, roleIdsByEmployee, searchTerm]);

  const filteredEmployeeIdSet = useMemo(() => new Set(filteredEmployees.map((e) => e.id)), [filteredEmployees]);

  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((en) => {
      if (!filteredEmployeeIdSet.has(en.employee_id)) return false;
      if (courseFilter !== 'all' && en.course_id !== courseFilter) return false;
      if (statusFilter !== 'all' && en.status !== statusFilter) return false;
      return true;
    });
  }, [enrollments, filteredEmployeeIdSet, courseFilter, statusFilter]);

  const activeEmployee = employees.find((e) => e.id === activeEmployeeId) ?? null;
  const activeEmployeeEnrollments = activeEmployeeId ? (enrollmentsByEmployee.get(activeEmployeeId) ?? []) : [];

  // ── Top summary ──────────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const total = filteredEnrollments.length;
    const active = filteredEnrollments.filter(
      (e) => e.is_active && e.status !== 'COMPLETED' && e.status !== 'EXPIRED' && e.status !== 'CANCELLED'
    ).length;
    const completed = filteredEnrollments.filter((e) => e.status === 'COMPLETED').length;
    const expired = filteredEnrollments.filter((e) => e.status === 'EXPIRED').length;
    const pending = filteredEnrollments.filter((e) => e.status === 'PENDING').length;
    return { total, active, completed, expired, pending };
  }, [filteredEnrollments]);

  // ── Selection ────────────────────────────────────────────────────────────────

  function toggleEmployeeSelected(id: string) {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedEmployeeIds((prev) => {
      if (filteredEmployees.every((e) => prev.has(e.id)) && filteredEmployees.length > 0) {
        return new Set();
      }
      return new Set(filteredEmployees.map((e) => e.id));
    });
  }

  // ── Assign / Remove / Suspend / Resume ──────────────────────────────────────

  async function handleAssignCourse() {
    if (!activeEmployee || !assignCourseId) return;
    setAssigning(true);
    try {
      await createEnrollment({
        company_id: activeEmployee.company_id,
        branch_id: activeEmployee.branch_id,
        employee_id: activeEmployee.id,
        course_id: assignCourseId,
        learning_path_id: '',
        assignment_type: 'MANUAL',
        enrollment_type: 'COURSE',
        status: 'PENDING',
        assigned_by: '',
        assigned_at: new Date().toISOString(),
        start_date: '',
        due_date: '',
        completed_at: null,
        expiry_date: '',
        completion_percentage: 0,
        certificate_id: '',
        remarks: '',
        is_active: true,
      });
      setAssignCourseId('');
      fetchAll();
      showToast('Course assigned');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign course.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleToggleSuspend(en: Enrollment) {
    setBusyEnrollmentId(en.id);
    try {
      await toggleIsActive(en.id, !en.is_active);
      fetchAll();
      showToast(en.is_active ? 'Enrollment suspended' : 'Enrollment resumed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update enrollment.');
    } finally {
      setBusyEnrollmentId('');
    }
  }

  async function handleRemoveConfirm() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeEnrollment(removeTarget.id);
      setRemoveTarget(null);
      fetchAll();
      showToast('Enrollment removed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove enrollment.');
    } finally {
      setRemoving(false);
    }
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────────

  async function handleBulkAssign() {
    if (!bulkCourseId || selectedEmployeeIds.size === 0) return;
    setBulkBusy(true);
    try {
      const targets = employees.filter((e) => selectedEmployeeIds.has(e.id));
      for (const emp of targets) {
        const already = (enrollmentsByEmployee.get(emp.id) ?? []).some((en) => en.course_id === bulkCourseId);
        if (already) continue;
        await createEnrollment({
          company_id: emp.company_id,
          branch_id: emp.branch_id,
          employee_id: emp.id,
          course_id: bulkCourseId,
          learning_path_id: '',
          assignment_type: 'BULK',
          enrollment_type: 'COURSE',
          status: 'PENDING',
          assigned_by: '',
          assigned_at: new Date().toISOString(),
          start_date: '',
          due_date: '',
          completed_at: null,
          expiry_date: '',
          completion_percentage: 0,
          certificate_id: '',
          remarks: '',
          is_active: true,
        });
      }
      fetchAll();
      showToast(`Course assigned to ${targets.length} employee(s)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bulk assignment failed.');
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkRemove() {
    if (!bulkCourseId || selectedEmployeeIds.size === 0) return;
    setBulkBusy(true);
    try {
      let count = 0;
      for (const employeeId of selectedEmployeeIds) {
        const target = (enrollmentsByEmployee.get(employeeId) ?? []).find((en) => en.course_id === bulkCourseId);
        if (target) {
          await removeEnrollment(target.id);
          count += 1;
        }
      }
      fetchAll();
      showToast(`Removed enrollment for ${count} employee(s)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bulk removal failed.');
    } finally {
      setBulkBusy(false);
    }
  }

  function handleExportCsv() {
    const rows = selectedEmployeeIds.size > 0
      ? filteredEnrollments.filter((en) => selectedEmployeeIds.has(en.employee_id))
      : filteredEnrollments;

    const header = ['Employee', 'Course', 'Assigned By', 'Assigned Date', 'Completed Date', 'Status'];
    const lines = rows.map((en) => {
      const emp = employeeById.get(en.employee_id);
      const empName = emp ? `${emp.first_name} ${emp.last_name}` : en.employee_id;
      const courseName = courseById.get(en.course_id)?.course_name ?? en.course_id;
      const assignedByEmp = employeeById.get(en.assigned_by);
      const assignedByName = assignedByEmp ? `${assignedByEmp.first_name} ${assignedByEmp.last_name}` : (en.assigned_by || '—');
      const assignedDate = en.assigned_at ? new Date(en.assigned_at).toLocaleDateString() : '—';
      const completedDate = en.completed_at ? new Date(en.completed_at).toLocaleDateString() : '—';
      return [empName, courseName, assignedByName, assignedDate, completedDate, en.status]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });

    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'enrollments.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ── Statistics ───────────────────────────────────────────────────────────────

  const statistics = useMemo(() => {
    function groupBy(keyFn: (en: Enrollment) => string, nameFn: (key: string) => string) {
      const map = new Map<string, { total: number; completed: number; sumPct: number }>();
      filteredEnrollments.forEach((en) => {
        const key = keyFn(en);
        const bucket = map.get(key) ?? { total: 0, completed: 0, sumPct: 0 };
        bucket.total += 1;
        if (en.status === 'COMPLETED') bucket.completed += 1;
        bucket.sumPct += en.completion_percentage;
        map.set(key, bucket);
      });
      return Array.from(map.entries()).map(([key, v]) => ({
        name: nameFn(key),
        total: v.total,
        completionPct: v.total > 0 ? Math.round(v.sumPct / v.total) : 0,
      }));
    }

    const companyWise = groupBy(
      (en) => employeeById.get(en.employee_id)?.company_id ?? '—',
      (id) => companyById.get(id)?.company_name ?? 'Unknown'
    );
    const branchWise = groupBy(
      (en) => employeeById.get(en.employee_id)?.branch_id ?? '—',
      (id) => branchById.get(id)?.branch_name ?? 'Unknown'
    );
    const departmentWise = groupBy(
      (en) => employeeById.get(en.employee_id)?.department_id ?? '—',
      (id) => departmentById.get(id)?.department_name ?? 'Unknown'
    );
    const courseWise = groupBy(
      (en) => en.course_id,
      (id) => courseById.get(id)?.course_name ?? 'Unknown'
    );

    return { companyWise, branchWise, departmentWise, courseWise };
  }, [filteredEnrollments, employeeById, companyById, branchById, departmentById, courseById]);

  function StatGroup({ title, rows }: { title: string; rows: { name: string; total: number; completionPct: number }[] }) {
    if (rows.length === 0) return null;
    return (
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="truncate font-medium text-slate-700">{r.name}</span>
              <span className="flex-shrink-0 text-xs text-slate-500">{r.total} enrolled · {r.completionPct}% avg</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  const allFilteredSelected = filteredEmployees.length > 0 && filteredEmployees.every((e) => selectedEmployeeIds.has(e.id));

  return (
    <div className="space-y-6">

      {/* TOP SUMMARY */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SummaryCard label="Total Enrollments" value={summary.total} accent="border-slate-200" />
        <SummaryCard label="Active" value={summary.active} accent="border-blue-200" />
        <SummaryCard label="Completed" value={summary.completed} accent="border-emerald-200" />
        <SummaryCard label="Expired" value={summary.expired} accent="border-red-200" />
        <SummaryCard label="Pending" value={summary.pending} accent="border-amber-200" />
      </div>

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
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Courses</option>
          {courses.map((c) => (<option key={c.id} value={c.id}>{c.course_name}</option>))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | EnrollmentStatus)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
          <option value="all">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="EXPIRED">Expired</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employees…"
          className="min-w-[180px] flex-1 rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
        />
        <SecondaryButton onClick={() => setShowStatistics((v) => !v)}>
          {showStatistics ? 'Hide Statistics' : 'Show Statistics'}
        </SecondaryButton>
      </div>

      {/* STATISTICS */}
      {showStatistics && (
        <div className="grid grid-cols-1 gap-6 rounded-2xl bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <StatGroup title="Company-wise" rows={statistics.companyWise} />
          <StatGroup title="Branch-wise" rows={statistics.branchWise} />
          <StatGroup title="Department-wise" rows={statistics.departmentWise} />
          <StatGroup title="Course-wise" rows={statistics.courseWise} />
          {statistics.companyWise.length === 0 && statistics.branchWise.length === 0 &&
            statistics.departmentWise.length === 0 && statistics.courseWise.length === 0 && (
            <div className="sm:col-span-2 lg:col-span-4">
              <EmptyState message="No enrollment data to summarise yet." />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">

        {/* LEFT PANEL — Employee List */}
        <div className="rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">Employees ({filteredEmployees.length})</p>
            <button
              onClick={toggleSelectAll}
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              {allFilteredSelected ? 'Clear All' : 'Select All'}
            </button>
          </div>

          {filteredEmployees.length === 0 ? (
            <EmptyState message="No employees match these filters." />
          ) : (
            <div className="max-h-[560px] space-y-1 overflow-y-auto">
              {filteredEmployees.map((emp) => {
                const isActive = activeEmployeeId === emp.id;
                const isSelected = selectedEmployeeIds.has(emp.id);
                const empEnrollmentCount = (enrollmentsByEmployee.get(emp.id) ?? []).length;
                return (
                  <div
                    key={emp.id}
                    className={`flex items-center gap-2 rounded-xl px-2 py-2 transition ${isActive ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleEmployeeSelected(emp.id)}
                      className="h-4 w-4 flex-shrink-0 rounded text-indigo-600 focus:ring-indigo-400"
                    />
                    <button onClick={() => setActiveEmployeeId(emp.id)} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{emp.first_name} {emp.last_name}</p>
                        <p className="truncate text-xs text-slate-400">{emp.employee_code}</p>
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {empEnrollmentCount}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {selectedEmployeeIds.size > 0 && (
            <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">{selectedEmployeeIds.size} selected — Bulk Actions</p>
              <select
                value={bulkCourseId}
                onChange={(e) => setBulkCourseId(e.target.value)}
                className="w-full rounded-lg bg-white px-2.5 py-2 text-xs text-slate-700 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              >
                <option value="">Select course…</option>
                {courses.map((c) => (<option key={c.id} value={c.id}>{c.course_name}</option>))}
              </select>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton onClick={handleBulkAssign} disabled={!bulkCourseId || bulkBusy} className="flex-1 text-xs">
                  {bulkBusy ? <Spinner className="h-3.5 w-3.5" /> : null} Assign Selected
                </PrimaryButton>
                <DangerButton onClick={handleBulkRemove} disabled={!bulkCourseId || bulkBusy} className="flex-1 text-xs">
                  Remove Selected
                </DangerButton>
              </div>
              <SecondaryButton onClick={handleExportCsv} className="w-full text-xs">Export CSV</SecondaryButton>
            </div>
          )}

          {selectedEmployeeIds.size === 0 && (
            <SecondaryButton onClick={handleExportCsv} className="mt-4 w-full text-xs">Export CSV (Filtered)</SecondaryButton>
          )}
        </div>

        {/* RIGHT PANEL — Assigned Courses */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            {!activeEmployee ? (
              <EmptyState message="Select an employee to view and manage their assigned courses." />
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{activeEmployee.first_name} {activeEmployee.last_name}</h3>
                    <p className="text-xs text-slate-400">{activeEmployee.employee_code}</p>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={assignCourseId}
                      onChange={(e) => setAssignCourseId(e.target.value)}
                      className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                    >
                      <option value="">Select course…</option>
                      {courses.map((c) => (<option key={c.id} value={c.id}>{c.course_name}</option>))}
                    </select>
                    <PrimaryButton onClick={handleAssignCourse} disabled={!assignCourseId || assigning} className="text-xs">
                      {assigning ? <Spinner className="h-3.5 w-3.5" /> : null} Assign Course
                    </PrimaryButton>
                  </div>
                </div>

                {activeEmployeeEnrollments.length === 0 ? (
                  <EmptyState message="No courses assigned yet." />
                ) : (
                  <div className="space-y-2">
                    {activeEmployeeEnrollments.map((en) => {
                      const course = courseById.get(en.course_id);
                      return (
                        <div key={en.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-slate-800">{course?.course_name ?? 'Unknown Course'}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span>Enrolled {en.assigned_at ? new Date(en.assigned_at).toLocaleDateString() : '—'}</span>
                              <span>{en.completion_percentage}% complete</span>
                              <span>{en.certificate_id ? 'Certificate Issued' : 'No Certificate'}</span>
                            </div>
                          </div>
                          <StatusBadge status={en.status} isActive={en.is_active} />
                          <div className="flex flex-shrink-0 gap-2">
                            <SecondaryButton onClick={() => handleToggleSuspend(en)} disabled={busyEnrollmentId === en.id} className="text-xs">
                              {busyEnrollmentId === en.id ? <Spinner className="h-3.5 w-3.5" /> : null} {en.is_active ? 'Suspend' : 'Resume'}
                            </SecondaryButton>
                            <DangerButton onClick={() => setRemoveTarget(en)} className="text-xs">Remove</DangerButton>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ENROLLMENT HISTORY */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Enrollment History</h3>
            {filteredEnrollments.length === 0 ? (
              <EmptyState message="No enrollments match these filters." />
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="pb-2 pr-3">Employee</th>
                      <th className="pb-2 pr-3">Course</th>
                      <th className="pb-2 pr-3">Assigned By</th>
                      <th className="pb-2 pr-3">Assigned Date</th>
                      <th className="pb-2 pr-3">Completed Date</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEnrollments.map((en) => {
                      const emp = employeeById.get(en.employee_id);
                      const course = courseById.get(en.course_id);
                      const assignedByEmp = employeeById.get(en.assigned_by);
                      return (
                        <tr key={en.id}>
                          <td className="py-2 pr-3 font-medium text-slate-700">{emp ? `${emp.first_name} ${emp.last_name}` : '—'}</td>
                          <td className="py-2 pr-3 text-slate-600">{course?.course_name ?? '—'}</td>
                          <td className="py-2 pr-3 text-slate-500">{assignedByEmp ? `${assignedByEmp.first_name} ${assignedByEmp.last_name}` : '—'}</td>
                          <td className="py-2 pr-3 text-slate-500">{en.assigned_at ? new Date(en.assigned_at).toLocaleDateString() : '—'}</td>
                          <td className="py-2 pr-3 text-slate-500">{en.completed_at ? new Date(en.completed_at).toLocaleDateString() : '—'}</td>
                          <td className="py-2"><StatusBadge status={en.status} isActive={en.is_active} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {removeTarget && (
        <ConfirmDialog
          title="Remove Enrollment"
          message="This will permanently remove this enrollment. Continue?"
          busy={removing}
          confirmLabel="Remove"
          onConfirm={handleRemoveConfirm}
          onCancel={() => setRemoveTarget(null)}
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

export default EnrollmentManagement;