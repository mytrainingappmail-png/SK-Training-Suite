// src/components/dashboard/DashboardFilters.tsx
//
// Reusable, fully self-contained dashboard filter bar. Every option list
// is loaded dynamically from existing, unmodified services — no mock
// data, no hardcoded values, no new repositories/tables.
//
//   companyService, branchService, departmentService, employeeService,
//   courseService, learningPathService, assessmentService,
//   trainerAssignmentService.
//
// Trainer data is loaded defensively: if the underlying table is
// unavailable, the Trainer filter degrades to an empty, gracefully
// disabled list rather than throwing or crashing the rest of the bar.

import { useEffect, useMemo, useState } from 'react';

import { loadCompanies } from '../../services/company/companyService';
import { branchService } from '../../services/branch/branchService';
import { departmentService } from '../../services/department/departmentService';
import { employeeService } from '../../services/employee/employeeService';
import { loadCourses } from '../../services/course/courseService';
import { loadLearningPaths } from '../../services/learningPath/learningPathService';
import { loadAssessments } from '../../services/assessment/assessmentService';
import { loadTrainerAssignments } from '../../services/trainerAssignment/trainerAssignmentService';

import type { Company } from '../../types/company';
import type { Branch } from '../../types/branch';
import type { Department } from '../../types/department';
import type { Employee } from '../../types/employee';
import type { Course } from '../../types/course';
import type { LearningPath } from '../../types/learningPath';
import type { Assessment } from '../../types/assessment';

export interface DashboardFilterState {
  companyId: string;
  branchId: string;
  departmentId: string;
  courseId: string;
  learningPathId: string;
  assessmentId: string;
  trainerId: string;
  employeeId: string;
  fromDate: string;
  toDate: string;
}

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilterState = {
  companyId: '',
  branchId: '',
  departmentId: '',
  courseId: '',
  learningPathId: '',
  assessmentId: '',
  trainerId: '',
  employeeId: '',
  fromDate: '',
  toDate: '',
};

async function safeLoad<T>(loader: () => Promise<T[]>): Promise<T[]> {
  try {
    return await loader();
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG only)
// ─────────────────────────────────────────────────────────────────────────────

function IconChevronDown({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>);
}
function IconX({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>);
}
function IconSearch({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>);
}
function IconSpinner({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchableSelect — Search / Clear / All / Loading / Empty states
// ─────────────────────────────────────────────────────────────────────────────

interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  loading: boolean;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}

function SearchableSelect({ label, value, options, loading, disabled, placeholder, onChange }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }, [options, search]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';
  const isDisabled = disabled || (!loading && options.length === 0);

  function selectOption(next: string) {
    onChange(next);
    setOpen(false);
    setSearch('');
  }

  return (
    <div className="relative min-w-[160px] flex-1">
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      <button
        type="button"
        onClick={() => !isDisabled && setOpen((v) => !v)}
        disabled={isDisabled}
        className={`flex w-full items-center justify-between gap-2 rounded-xl bg-slate-100/70 px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${open ? 'ring-2 ring-indigo-400/40' : ''}`}
      >
        <span className={`truncate ${selectedLabel ? 'text-slate-700' : 'text-slate-400'}`}>
          {loading ? 'Loading…' : selectedLabel || placeholder || `All ${label}`}
        </span>
        <span className="flex flex-shrink-0 items-center gap-1">
          {loading && <IconSpinner className="h-3.5 w-3.5 text-slate-400" />}
          {value && !loading && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); selectOption(''); }}
              className="rounded-md p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            >
              <IconX />
            </span>
          )}
          <IconChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && !isDisabled && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl">
          <div className="relative border-b border-slate-100 p-2">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"><IconSearch /></span>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="w-full rounded-lg bg-slate-50 py-1.5 pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5">
            <button
              type="button"
              onClick={() => selectOption('')}
              className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition hover:bg-indigo-50 ${!value ? 'font-semibold text-indigo-600' : 'text-slate-600'}`}
            >
              All {label}
            </button>
            {loading ? (
              <p className="px-3 py-4 text-center text-xs text-slate-400">Loading…</p>
            ) : filteredOptions.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-400">No {label.toLowerCase()} found.</p>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectOption(opt.value)}
                  className={`flex w-full items-center truncate rounded-lg px-3 py-2 text-left text-sm transition hover:bg-indigo-50 ${value === opt.value ? 'font-semibold text-indigo-600' : 'text-slate-600'}`}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main DashboardFilters
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardFiltersProps {
  value: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
}

function DashboardFilters({ value, onChange }: DashboardFiltersProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [trainerIds, setTrainerIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      const [companyRows, branchRows, departmentRows, employeeRows, courseRows, pathRows, assessmentRows, trainerRows] = await Promise.all([
        safeLoad(loadCompanies),
        safeLoad(() => branchService.getAll()),
        safeLoad(() => departmentService.getAll()),
        safeLoad(() => employeeService.getAll()),
        safeLoad(loadCourses),
        safeLoad(loadLearningPaths),
        safeLoad(loadAssessments),
        safeLoad(loadTrainerAssignments),
      ]);
      if (cancelled) return;
      setCompanies(companyRows);
      setBranches(branchRows);
      setDepartments(departmentRows);
      setEmployees(employeeRows);
      setCourses(courseRows);
      setLearningPaths(pathRows);
      setAssessments(assessmentRows);
      setTrainerIds(Array.from(new Set(trainerRows.filter((t) => t.is_active).map((t) => t.trainer_id))));
      setLoading(false);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  function update(patch: Partial<DashboardFilterState>) {
    const next = { ...value, ...patch };
    if (patch.companyId !== undefined) {
      next.branchId = '';
      next.departmentId = '';
      next.employeeId = '';
    }
    if (patch.branchId !== undefined) {
      next.departmentId = '';
      next.employeeId = '';
    }
    if (patch.departmentId !== undefined) {
      next.employeeId = '';
    }
    onChange(next);
  }

  function handleClearAll() {
    onChange({ ...DEFAULT_DASHBOARD_FILTERS });
  }

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const branchOptions = useMemo(() => {
    return branches
      .filter((b) => !value.companyId || b.company_id === value.companyId)
      .map((b) => ({ value: b.id, label: b.branch_name }));
  }, [branches, value.companyId]);

  const departmentOptions = useMemo(() => {
    return departments
      .filter((d) => (!value.companyId || d.company_id === value.companyId) && (!value.branchId || d.branch_id === value.branchId))
      .map((d) => ({ value: d.id, label: d.department_name }));
  }, [departments, value.companyId, value.branchId]);

  const employeeOptions = useMemo(() => {
    return employees
      .filter((e) => (!value.companyId || e.company_id === value.companyId) && (!value.branchId || e.branch_id === value.branchId) && (!value.departmentId || e.department_id === value.departmentId))
      .map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }));
  }, [employees, value.companyId, value.branchId, value.departmentId]);

  const courseOptions = useMemo(() => courses.map((c) => ({ value: c.id, label: c.course_name })), [courses]);
  const learningPathOptions = useMemo(() => learningPaths.map((p) => ({ value: p.id, label: p.path_name })), [learningPaths]);
  const assessmentOptions = useMemo(() => assessments.map((a) => ({ value: a.id, label: a.assessment_title })), [assessments]);
  const trainerOptions = useMemo(
    () => trainerIds.map((id) => ({ value: id, label: employeeById.get(id) ? `${employeeById.get(id)!.first_name} ${employeeById.get(id)!.last_name}` : id })),
    [trainerIds, employeeById]
  );

  const hasActiveFilters = Object.values(value).some((v) => v !== '');

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Filters</h3>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
          >
            <IconX className="h-3 w-3" /> Clear All
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchableSelect
          label="Company"
          value={value.companyId}
          options={companies.map((c) => ({ value: c.id, label: c.company_name }))}
          loading={loading}
          onChange={(v) => update({ companyId: v })}
        />
        <SearchableSelect
          label="Branch"
          value={value.branchId}
          options={branchOptions}
          loading={loading}
          onChange={(v) => update({ branchId: v })}
        />
        <SearchableSelect
          label="Department"
          value={value.departmentId}
          options={departmentOptions}
          loading={loading}
          onChange={(v) => update({ departmentId: v })}
        />
        <SearchableSelect
          label="Course"
          value={value.courseId}
          options={courseOptions}
          loading={loading}
          onChange={(v) => update({ courseId: v })}
        />
        <SearchableSelect
          label="Learning Path"
          value={value.learningPathId}
          options={learningPathOptions}
          loading={loading}
          onChange={(v) => update({ learningPathId: v })}
        />
        <SearchableSelect
          label="Assessment"
          value={value.assessmentId}
          options={assessmentOptions}
          loading={loading}
          onChange={(v) => update({ assessmentId: v })}
        />
        <SearchableSelect
          label="Trainer"
          value={value.trainerId}
          options={trainerOptions}
          loading={loading}
          placeholder={!loading && trainerOptions.length === 0 ? 'No Data Available' : undefined}
          onChange={(v) => update({ trainerId: v })}
        />
        <SearchableSelect
          label="Employee"
          value={value.employeeId}
          options={employeeOptions}
          loading={loading}
          onChange={(v) => update({ employeeId: v })}
        />

        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Date Range</label>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={value.fromDate}
              onChange={(e) => update({ fromDate: e.target.value })}
              className="w-full rounded-xl bg-slate-100/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
            <span className="flex-shrink-0 text-xs text-slate-400">to</span>
            <input
              type="date"
              value={value.toDate}
              onChange={(e) => update({ toDate: e.target.value })}
              className="w-full rounded-xl bg-slate-100/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
            {(value.fromDate || value.toDate) && (
              <button
                type="button"
                onClick={() => update({ fromDate: '', toDate: '' })}
                className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <IconX />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardFilters;