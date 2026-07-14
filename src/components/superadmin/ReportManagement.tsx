import { useCallback, useEffect, useMemo, useState } from "react";

import {
  loadDashboardSummary,
  loadEmployeeReport,
  loadCourseReport,
  loadAssessmentReport,
  loadCertificateReport,
  loadLearningPathReport,
  loadDepartmentReport,
  loadBranchReport,
  loadCompanyReport,
} from "../../services/report/reportService";
import { loadCompanies }     from "../../services/company/companyService";
import { branchService }     from "../../services/branch/branchService";
import { departmentService } from "../../services/department/departmentService";
import { employeeService }   from "../../services/employee/employeeService";
import { loadCourses }       from "../../services/course/courseService";
import { loadLearningPaths } from "../../services/learningPath/learningPathService";

import type { ReportType, ReportFilters, DashboardSummary } from "../../types/report";
import type {
  EmployeeReportRow,
  CourseReportRow,
  AssessmentReportRow,
  CertificateReportRow,
  LearningPathReportRow,
  DepartmentReportRow,
  BranchReportRow,
  CompanyReportRow,
} from "../../types/report";
import type { Company }      from "../../types/company";
import type { Branch }       from "../../types/branch";
import type { Department }   from "../../types/department";
import type { Employee }     from "../../types/employee";
import type { Course }       from "../../types/course";
import type { LearningPath } from "../../types/learningPath";
import { defaultReportFilters } from "../../types/report";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PER_PAGE = 10;

const REPORT_TABS: { value: ReportType; label: string }[] = [
  { value: "dashboard",      label: "Dashboard"       },
  { value: "employee",       label: "Employee"        },
  { value: "course",         label: "Course"          },
  { value: "assessment",     label: "Assessment"      },
  { value: "certificate",    label: "Certificate"     },
  { value: "learning_path",  label: "Learning Path"   },
  { value: "department",     label: "Department"      },
  { value: "branch",         label: "Branch"          },
  { value: "company",        label: "Company"         },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Card
// ─────────────────────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: number;
  suffix?: string;
  color: string;
}) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${color}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-800">
        {value.toLocaleString()}{suffix && <span className="ml-1 text-xl text-slate-500">{suffix}</span>}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress Bar
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const cls = pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs font-medium text-slate-600">{pct}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export buttons
// ─────────────────────────────────────────────────────────────────────────────

function ExportBar({ report }: { report: ReportType }) {
  function handleCSV() {
    // TODO: implement CSV export for report type: report
    console.info("Export CSV:", report);
  }
  function handleExcel() {
    // TODO: implement Excel export for report type: report
    console.info("Export Excel:", report);
  }
  function handlePDF() {
    // TODO: implement PDF export for report type: report
    console.info("Export PDF:", report);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-slate-500">Export:</span>
      <button onClick={handleCSV}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 active:scale-95">
        CSV
      </button>
      <button onClick={handleExcel}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 active:scale-95">
        Excel
      </button>
      <button onClick={handlePDF}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 active:scale-95">
        PDF
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination helper
// ─────────────────────────────────────────────────────────────────────────────

function usePagination<T>(rows: T[]) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * PER_PAGE;
  const pageRows   = rows.slice(pageStart, pageStart + PER_PAGE);

  function PaginationBar() {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        <p className="text-sm text-slate-500">Page {safePage} of {totalPages}</p>
        <div className="flex gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            Previous
          </button>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            Next
          </button>
        </div>
      </div>
    );
  }

  return { pageRows, PaginationBar, setPage };
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter panel
// ─────────────────────────────────────────────────────────────────────────────

const CLS_SELECT =
  "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30";

const CLS_INPUT =
  "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30";

function FilterPanel({
  active,
  filters,
  onChange,
  companies,
  branches,
  departments,
  employees,
  courses,
  learningPaths,
}: {
  active: ReportType;
  filters: ReportFilters;
  onChange: (f: ReportFilters) => void;
  companies: Company[];
  branches: Branch[];
  departments: Department[];
  employees: Employee[];
  courses: Course[];
  learningPaths: LearningPath[];
}) {
  function f(key: keyof ReportFilters, val: string) {
    onChange({ ...filters, [key]: val });
  }

  if (active === "dashboard") return null;

  const showCompany      = ["employee","course","department","branch","company"].includes(active);
  const showBranch       = ["employee","branch"].includes(active);
  const showDept         = ["employee","department"].includes(active);
  const showEmployee     = ["employee","certificate"].includes(active);
  const showCourse       = ["course","assessment","certificate"].includes(active);
  const showLearningPath = active === "learning_path";
  const showDate         = true;

  return (
    <div className="flex flex-wrap gap-3 border-b border-slate-100 px-6 py-4">
      {showCompany && (
        <select value={filters.company_id} onChange={(e) => f("company_id", e.target.value)} className={CLS_SELECT}>
          <option value="">All Companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
      )}
      {showBranch && (
        <select value={filters.branch_id} onChange={(e) => f("branch_id", e.target.value)} className={CLS_SELECT}>
          <option value="">All Branches</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
        </select>
      )}
      {showDept && (
        <select value={filters.department_id} onChange={(e) => f("department_id", e.target.value)} className={CLS_SELECT}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.department_name}</option>)}
        </select>
      )}
      {showEmployee && (
        <select value={filters.employee_id} onChange={(e) => f("employee_id", e.target.value)} className={CLS_SELECT}>
          <option value="">All Employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {[e.first_name, e.last_name].filter(Boolean).join(" ")} — {e.employee_code}
            </option>
          ))}
        </select>
      )}
      {showCourse && (
        <select value={filters.course_id} onChange={(e) => f("course_id", e.target.value)} className={CLS_SELECT}>
          <option value="">All Courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.course_name}</option>)}
        </select>
      )}
      {showLearningPath && (
        <select value={filters.learning_path_id} onChange={(e) => f("learning_path_id", e.target.value)} className={CLS_SELECT}>
          <option value="">All Learning Paths</option>
          {learningPaths.map((lp) => <option key={lp.id} value={lp.id}>{lp.path_code} — {lp.path_name}</option>)}
        </select>
      )}
      {showDate && (
        <>
          <input type="date" value={filters.date_from} onChange={(e) => f("date_from", e.target.value)}
            placeholder="From" className={CLS_INPUT} />
          <input type="date" value={filters.date_to} onChange={(e) => f("date_to", e.target.value)}
            placeholder="To" className={CLS_INPUT} />
        </>
      )}
      <button
        onClick={() => onChange({ ...defaultReportFilters })}
        className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
      >
        Clear
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyRows() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <svg className="mb-3 h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
      </svg>
      <p className="text-sm font-medium text-slate-400">No data found for the selected filters.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ReportManagement() {

  const [activeReport, setActiveReport] = useState<ReportType>("dashboard");
  const [filters, setFilters]           = useState<ReportFilters>(defaultReportFilters);
  const [search, setSearch]             = useState("");

  // Lookup data
  const [companies,     setCompanies]     = useState<Company[]>([]);
  const [branches,      setBranches]      = useState<Branch[]>([]);
  const [departments,   setDepartments]   = useState<Department[]>([]);
  const [employees,     setEmployees]     = useState<Employee[]>([]);
  const [courses,       setCourses]       = useState<Course[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);

  // Report data
  const [dashboard,    setDashboard]    = useState<DashboardSummary | null>(null);
  const [empRows,      setEmpRows]      = useState<EmployeeReportRow[]>([]);
  const [courseRows,   setCourseRows]   = useState<CourseReportRow[]>([]);
  const [assRows,      setAssRows]      = useState<AssessmentReportRow[]>([]);
  const [certRows,     setCertRows]     = useState<CertificateReportRow[]>([]);
  const [lpRows,       setLpRows]       = useState<LearningPathReportRow[]>([]);
  const [deptRows,     setDeptRows]     = useState<DepartmentReportRow[]>([]);
  const [branchRows,   setBranchRows]   = useState<BranchReportRow[]>([]);
  const [companyRows,  setCompanyRows]  = useState<CompanyReportRow[]>([]);

  const [loadingMeta,   setLoadingMeta]   = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [banner,        setBanner]        = useState("");

  // ── Load lookup tables once
  useEffect(() => {
    setLoadingMeta(true);
    Promise.all([
      loadCompanies(),
      branchService.getAll(),
      departmentService.getAll(),
      employeeService.getAll(),
      loadCourses(),
      loadLearningPaths(),
    ])
      .then(([co, br, de, em, cr, lp]) => {
        setCompanies(co);
        setBranches(br);
        setDepartments(de);
        setEmployees(em);
        setCourses(cr);
        setLearningPaths(lp);
      })
      .catch((err) => { console.error(err); setBanner("Failed to load lookup data."); })
      .finally(() => setLoadingMeta(false));
  }, []);

  // ── Load report when type or filters change
  const loadReport = useCallback(async () => {
    setLoadingReport(true);
    setBanner("");
    try {
      switch (activeReport) {
        case "dashboard":    setDashboard(await loadDashboardSummary());                break;
        case "employee":     setEmpRows(await loadEmployeeReport(filters));             break;
        case "course":       setCourseRows(await loadCourseReport(filters));            break;
        case "assessment":   setAssRows(await loadAssessmentReport(filters));           break;
        case "certificate":  setCertRows(await loadCertificateReport(filters));         break;
        case "learning_path":setLpRows(await loadLearningPathReport(filters));          break;
        case "department":   setDeptRows(await loadDepartmentReport(filters));          break;
        case "branch":       setBranchRows(await loadBranchReport(filters));            break;
        case "company":      setCompanyRows(await loadCompanyReport());                 break;
      }
    } catch (err) {
      console.error(err);
      setBanner("Failed to load report data. Please try again.");
    } finally {
      setLoadingReport(false);
    }
  }, [activeReport, filters]);

  useEffect(() => { loadReport(); }, [loadReport]);

  // Reset filters + page when switching reports
  useEffect(() => { setFilters(defaultReportFilters); setSearch(""); }, [activeReport]);

  // ── Search filter applied to current rows
  const kw = search.trim().toLowerCase();

  const filteredEmp   = useMemo(() =>
    kw ? empRows.filter((r) => r.full_name.toLowerCase().includes(kw) || r.employee_code.toLowerCase().includes(kw) || r.department_name.toLowerCase().includes(kw)) : empRows,
    [empRows, kw]);
  const filteredCrs   = useMemo(() =>
    kw ? courseRows.filter((r) => r.course_title.toLowerCase().includes(kw) || r.category_name.toLowerCase().includes(kw)) : courseRows,
    [courseRows, kw]);
  const filteredAss   = useMemo(() =>
    kw ? assRows.filter((r) => r.assessment_name.toLowerCase().includes(kw) || r.course_title.toLowerCase().includes(kw)) : assRows,
    [assRows, kw]);
  const filteredCert  = useMemo(() =>
    kw ? certRows.filter((r) => r.certificate_no.toLowerCase().includes(kw) || r.employee_name.toLowerCase().includes(kw) || r.certificate_title.toLowerCase().includes(kw)) : certRows,
    [certRows, kw]);
  const filteredLp    = useMemo(() =>
    kw ? lpRows.filter((r) => r.path_name.toLowerCase().includes(kw) || r.path_code.toLowerCase().includes(kw)) : lpRows,
    [lpRows, kw]);
  const filteredDept  = useMemo(() =>
    kw ? deptRows.filter((r) => r.department_name.toLowerCase().includes(kw)) : deptRows,
    [deptRows, kw]);
  const filteredBr    = useMemo(() =>
    kw ? branchRows.filter((r) => r.branch_name.toLowerCase().includes(kw)) : branchRows,
    [branchRows, kw]);
  const filteredCo    = useMemo(() =>
    kw ? companyRows.filter((r) => r.company_name.toLowerCase().includes(kw)) : companyRows,
    [companyRows, kw]);

  const empPage  = usePagination(filteredEmp);
  const crsPage  = usePagination(filteredCrs);
  const assPage  = usePagination(filteredAss);
  const certPage = usePagination(filteredCert);
  const lpPage   = usePagination(filteredLp);
  const deptPage = usePagination(filteredDept);
  const brPage   = usePagination(filteredBr);
  const coPage   = usePagination(filteredCo);

  // Shared table header classes
  const TH = "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-left";
  const TD = "px-4 py-3 text-sm text-slate-700";

  // ── Render
  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Reports</h2>
          <p className="mt-0.5 text-sm text-slate-500">Analytics and reporting across all modules.</p>
        </div>
        <div className="flex items-center gap-3">
          {loadingMeta && (
            <span className="flex items-center gap-1.5 text-sm text-slate-400"><Spinner /> Loading lookups…</span>
          )}
          <button onClick={loadReport} disabled={loadingReport}
            className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50">
            {loadingReport ? <Spinner /> : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {banner && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="flex-1">{banner}</p>
          <button onClick={() => setBanner("")} className="text-red-400 hover:text-red-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Report type tabs */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        {REPORT_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveReport(t.value)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeReport === t.value
                ? "bg-yellow-500 text-slate-900 shadow"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main report card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

        {/* Filter panel */}
        <FilterPanel
          active={activeReport}
          filters={filters}
          onChange={setFilters}
          companies={companies}
          branches={branches}
          departments={departments}
          employees={employees}
          courses={courses}
          learningPaths={learningPaths}
        />

        {/* Search + export bar — not shown for dashboard */}
        {activeReport !== "dashboard" && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <div className="relative min-w-[220px] flex-1">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-yellow-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/30" />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <ExportBar report={activeReport} />
          </div>
        )}

        {/* Loading overlay */}
        {loadingReport && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-slate-400">
              <Spinner />
              <span className="text-sm">Loading report…</span>
            </div>
          </div>
        )}

        {/* ─── Dashboard ─── */}
        {!loadingReport && activeReport === "dashboard" && dashboard && (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <SummaryCard label="Total Employees"      value={dashboard.total_employees}        color="border-blue-100"   />
              <SummaryCard label="Total Courses"        value={dashboard.total_courses}          color="border-amber-100"  />
              <SummaryCard label="Completed Courses"    value={dashboard.completed_courses}      color="border-emerald-100"/>
              <SummaryCard label="Total Assessments"    value={dashboard.total_assessments}      color="border-violet-100" />
              <SummaryCard label="Certificates Issued"  value={dashboard.certificates_generated} color="border-yellow-100" />
              <SummaryCard label="Learning Paths"       value={dashboard.learning_paths}         color="border-cyan-100"   />
              <SummaryCard label="Avg Completion"       value={dashboard.completion_percentage}  suffix="%" color="border-rose-100" />
            </div>

            <div className="mt-8">
              <p className="mb-4 text-sm font-semibold text-slate-700">Completion Overview</p>
              <div className="space-y-3 rounded-xl border border-slate-100 p-4">
                {[
                  { label: "Course Completion",   value: dashboard.total_courses > 0 ? Math.round((dashboard.completed_courses / dashboard.total_courses) * 100) : 0 },
                  { label: "Learning Path Progress", value: dashboard.completion_percentage },
                ].map(({ label, value }) => (
                  <div key={label} className="grid grid-cols-[180px_1fr] items-center gap-4">
                    <span className="text-sm text-slate-600">{label}</span>
                    <ProgressBar value={value} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Employee ─── */}
        {!loadingReport && activeReport === "employee" && (
          filteredEmp.length === 0 ? <EmptyRows /> : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={TH}>#</th>
                      <th className={TH}>Employee</th>
                      <th className={TH}>Code</th>
                      <th className={TH}>Department</th>
                      <th className={TH}>Branch</th>
                      <th className={TH}>Company</th>
                      <th className={TH}>Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {empPage.pageRows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className={TD}>{i + 1}</td>
                        <td className={`${TD} font-semibold text-slate-800`}>{r.full_name}</td>
                        <td className={`${TD} font-mono text-xs`}>{r.employee_code}</td>
                        <td className={TD}>{r.department_name}</td>
                        <td className={TD}>{r.branch_name}</td>
                        <td className={TD}>{r.company_name}</td>
                        <td className={`${TD} text-xs`}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <empPage.PaginationBar />
            </>
          )
        )}

        {/* ─── Course ─── */}
        {!loadingReport && activeReport === "course" && (
          filteredCrs.length === 0 ? <EmptyRows /> : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={TH}>#</th>
                      <th className={TH}>Course Title</th>
                      <th className={TH}>Category</th>
                      <th className={TH}>Modules</th>
                      <th className={TH}>Lessons</th>
                      <th className={TH}>Enrolled</th>
                      <th className={TH}>Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {crsPage.pageRows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className={TD}>{i + 1}</td>
                        <td className={`${TD} font-semibold text-slate-800`}>{r.course_title}</td>
                        <td className={TD}>{r.category_name}</td>
                        <td className={TD}>{r.total_modules}</td>
                        <td className={TD}>{r.total_lessons}</td>
                        <td className={TD}>{r.enrolled_count}</td>
                        <td className={`${TD} text-xs`}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <crsPage.PaginationBar />
            </>
          )
        )}

        {/* ─── Assessment ─── */}
        {!loadingReport && activeReport === "assessment" && (
          filteredAss.length === 0 ? <EmptyRows /> : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={TH}>#</th>
                      <th className={TH}>Assessment</th>
                      <th className={TH}>Course</th>
                      <th className={TH}>Attempts</th>
                      <th className={TH}>Avg Score</th>
                      <th className={TH}>Pass</th>
                      <th className={TH}>Fail</th>
                      <th className={TH}>Pass Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {assPage.pageRows.map((r, i) => {
                      const passRate = r.total_attempts ? Math.round((r.pass_count / r.total_attempts) * 100) : 0;
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/60">
                          <td className={TD}>{i + 1}</td>
                          <td className={`${TD} font-semibold text-slate-800`}>{r.assessment_name}</td>
                          <td className={TD}>{r.course_title}</td>
                          <td className={TD}>{r.total_attempts}</td>
                          <td className={TD}>{r.avg_score}%</td>
                          <td className={`${TD} text-emerald-600 font-medium`}>{r.pass_count}</td>
                          <td className={`${TD} text-red-500 font-medium`}>{r.fail_count}</td>
                          <td className={`${TD} w-36`}><ProgressBar value={passRate} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <assPage.PaginationBar />
            </>
          )
        )}

        {/* ─── Certificate ─── */}
        {!loadingReport && activeReport === "certificate" && (
          filteredCert.length === 0 ? <EmptyRows /> : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={TH}>#</th>
                      <th className={TH}>Certificate No</th>
                      <th className={TH}>Title</th>
                      <th className={TH}>Employee</th>
                      <th className={TH}>Course</th>
                      <th className={TH}>Issued Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {certPage.pageRows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className={TD}>{i + 1}</td>
                        <td className={`${TD} font-mono text-xs font-semibold`}>{r.certificate_no}</td>
                        <td className={TD}>{r.certificate_title}</td>
                        <td className={`${TD} font-medium`}>{r.employee_name}</td>
                        <td className={TD}>{r.course_title}</td>
                        <td className={`${TD} text-xs`}>{r.issued_date || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <certPage.PaginationBar />
            </>
          )
        )}

        {/* ─── Learning Path ─── */}
        {!loadingReport && activeReport === "learning_path" && (
          filteredLp.length === 0 ? <EmptyRows /> : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={TH}>#</th>
                      <th className={TH}>Code</th>
                      <th className={TH}>Path Name</th>
                      <th className={TH}>Difficulty</th>
                      <th className={TH}>Enrolled</th>
                      <th className={TH}>Completed</th>
                      <th className={TH}>Avg Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {lpPage.pageRows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className={TD}>{i + 1}</td>
                        <td className={`${TD} font-mono text-xs`}>{r.path_code}</td>
                        <td className={`${TD} font-semibold text-slate-800`}>{r.path_name}</td>
                        <td className={TD}>{r.difficulty_level}</td>
                        <td className={TD}>{r.enrolled_count}</td>
                        <td className={`${TD} text-emerald-600 font-medium`}>{r.completed_count}</td>
                        <td className="px-4 py-3 w-36"><ProgressBar value={r.avg_progress} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <lpPage.PaginationBar />
            </>
          )
        )}

        {/* ─── Department ─── */}
        {!loadingReport && activeReport === "department" && (
          filteredDept.length === 0 ? <EmptyRows /> : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={TH}>#</th>
                      <th className={TH}>Department</th>
                      <th className={TH}>Company</th>
                      <th className={TH}>Employees</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {deptPage.pageRows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className={TD}>{i + 1}</td>
                        <td className={`${TD} font-semibold text-slate-800`}>{r.department_name}</td>
                        <td className={TD}>{r.company_name}</td>
                        <td className={TD}>{r.employee_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <deptPage.PaginationBar />
            </>
          )
        )}

        {/* ─── Branch ─── */}
        {!loadingReport && activeReport === "branch" && (
          filteredBr.length === 0 ? <EmptyRows /> : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={TH}>#</th>
                      <th className={TH}>Branch</th>
                      <th className={TH}>Company</th>
                      <th className={TH}>Employees</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {brPage.pageRows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className={TD}>{i + 1}</td>
                        <td className={`${TD} font-semibold text-slate-800`}>{r.branch_name}</td>
                        <td className={TD}>{r.company_name}</td>
                        <td className={TD}>{r.employee_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <brPage.PaginationBar />
            </>
          )
        )}

        {/* ─── Company ─── */}
        {!loadingReport && activeReport === "company" && (
          filteredCo.length === 0 ? <EmptyRows /> : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={TH}>#</th>
                      <th className={TH}>Company</th>
                      <th className={TH}>Branches</th>
                      <th className={TH}>Employees</th>
                      <th className={TH}>Courses</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {coPage.pageRows.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className={TD}>{i + 1}</td>
                        <td className={`${TD} font-semibold text-slate-800`}>{r.company_name}</td>
                        <td className={TD}>{r.branch_count}</td>
                        <td className={TD}>{r.employee_count}</td>
                        <td className={TD}>{r.course_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <coPage.PaginationBar />
            </>
          )
        )}

      </div>
    </div>
  );
}
