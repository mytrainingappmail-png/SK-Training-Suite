import { supabase } from "../../lib/supabase";
import type {
  ReportFilters,
  DashboardSummary,
  EmployeeReportRow,
  CourseReportRow,
  AssessmentReportRow,
  CertificateReportRow,
  LearningPathReportRow,
  DepartmentReportRow,
  BranchReportRow,
  CompanyReportRow,
} from "../../types/report";

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Summary
// ─────────────────────────────────────────────────────────────────────────────

export async function loadDashboardSummary(): Promise<DashboardSummary> {
  const [
    { count: total_employees },
    { count: total_courses },
    { count: total_assessments },
    { count: certificates_generated },
    { count: learning_paths },
    { data: progressData },
  ] = await Promise.all([
    supabase.from("employees").select("*", { count: "exact", head: true }),
    supabase.from("courses").select("*", { count: "exact", head: true }),
    supabase.from("assessments").select("*", { count: "exact", head: true }),
    supabase.from("certificates").select("*", { count: "exact", head: true }),
    supabase.from("learning_paths").select("*", { count: "exact", head: true }),
    supabase.from("learning_path_progress").select("progress_percentage, status"),
  ]);

  const progressRows = progressData ?? [];
  const completed_courses = progressRows.filter((r) => r.status === "completed").length;
  const avg = progressRows.length
    ? progressRows.reduce((sum, r) => sum + (r.progress_percentage ?? 0), 0) / progressRows.length
    : 0;

  return {
    total_employees:        total_employees ?? 0,
    total_courses:          total_courses ?? 0,
    completed_courses,
    total_assessments:      total_assessments ?? 0,
    certificates_generated: certificates_generated ?? 0,
    learning_paths:         learning_paths ?? 0,
    completion_percentage:  Math.round(avg),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Employee Report
// ─────────────────────────────────────────────────────────────────────────────

export async function loadEmployeeReport(
  filters: ReportFilters
): Promise<EmployeeReportRow[]> {
  let query = supabase
    .from("employees")
    .select(`
      id,
      employee_code,
      first_name,
      last_name,
      created_at,
      departments ( department_name ),
      branches    ( branch_name ),
      companies   ( company_name )
    `)
    .order("created_at", { ascending: false });

  if (filters.company_id)    query = query.eq("company_id",    filters.company_id);
  if (filters.branch_id)     query = query.eq("branch_id",     filters.branch_id);
  if (filters.department_id) query = query.eq("department_id", filters.department_id);
  if (filters.employee_id)   query = query.eq("id",            filters.employee_id);
  if (filters.date_from)     query = query.gte("created_at",   filters.date_from);
  if (filters.date_to)       query = query.lte("created_at",   filters.date_to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((e) => {
    const dept = Array.isArray(e.departments) ? e.departments[0] : e.departments;
    const br   = Array.isArray(e.branches)    ? e.branches[0]    : e.branches;
    const co   = Array.isArray(e.companies)   ? e.companies[0]   : e.companies;
    return {
      id:              e.id,
      employee_code:   e.employee_code ?? "",
      full_name:       [e.first_name, e.last_name].filter(Boolean).join(" "),
      department_name: dept?.department_name ?? "—",
      branch_name:     br?.branch_name       ?? "—",
      company_name:    co?.company_name       ?? "—",
      roles:           "",
      created_at:      e.created_at ?? "",
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Course Report
// ─────────────────────────────────────────────────────────────────────────────

export async function loadCourseReport(
  filters: ReportFilters
): Promise<CourseReportRow[]> {
  let query = supabase
    .from("courses")
    .select(`
      id,
      course_title,
      created_at,
      categories ( category_name )
    `)
    .order("created_at", { ascending: false });

  if (filters.course_id)  query = query.eq("id",         filters.course_id);
  if (filters.company_id) query = query.eq("company_id", filters.company_id);
  if (filters.date_from)  query = query.gte("created_at", filters.date_from);
  if (filters.date_to)    query = query.lte("created_at", filters.date_to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((c) => {
    const cat = Array.isArray(c.categories) ? c.categories[0] : c.categories;
    return {
      id:            c.id,
      course_title:  c.course_title ?? "",
      category_name: cat?.category_name ?? "—",
      total_modules: 0,
      total_lessons: 0,
      enrolled_count:0,
      created_at:    c.created_at ?? "",
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessment Report
// ─────────────────────────────────────────────────────────────────────────────

export async function loadAssessmentReport(
  filters: ReportFilters
): Promise<AssessmentReportRow[]> {
  let query = supabase
    .from("assessment_results")
    .select(`
      id,
      score,
      status,
      assessments ( id, assessment_name, courses ( course_title ) )
    `)
    .order("created_at", { ascending: false });

  if (filters.date_from) query = query.gte("created_at", filters.date_from);
  if (filters.date_to)   query = query.lte("created_at", filters.date_to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Aggregate by assessment
  const map = new Map<string, AssessmentReportRow>();
  for (const row of data ?? []) {
    const a   = Array.isArray(row.assessments) ? row.assessments[0] : row.assessments;
    const c   = a ? (Array.isArray(a.courses) ? a.courses[0] : a.courses) : null;
    const aid = a?.id ?? row.id;
    if (!map.has(aid)) {
      map.set(aid, {
        id:              aid,
        assessment_name: a?.assessment_name ?? "—",
        course_title:    c?.course_title    ?? "—",
        total_attempts:  0,
        avg_score:       0,
        pass_count:      0,
        fail_count:      0,
      });
    }
    const entry = map.get(aid)!;
    entry.total_attempts += 1;
    entry.avg_score      += row.score ?? 0;
    if (row.status === "PASSED") entry.pass_count += 1;
    else                         entry.fail_count += 1;
  }

  return Array.from(map.values()).map((entry) => ({
    ...entry,
    avg_score: entry.total_attempts
      ? Math.round(entry.avg_score / entry.total_attempts)
      : 0,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Certificate Report
// ─────────────────────────────────────────────────────────────────────────────

export async function loadCertificateReport(
  filters: ReportFilters
): Promise<CertificateReportRow[]> {
  let query = supabase
    .from("certificates")
    .select(`
      id,
      certificate_no,
      certificate_title,
      issued_date,
      employees ( first_name, last_name ),
      courses   ( course_title )
    `)
    .order("issued_date", { ascending: false });

  if (filters.employee_id) query = query.eq("employee_id", filters.employee_id);
  if (filters.course_id)   query = query.eq("course_id",   filters.course_id);
  if (filters.date_from)   query = query.gte("issued_date", filters.date_from);
  if (filters.date_to)     query = query.lte("issued_date", filters.date_to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((cert) => {
    const emp = Array.isArray(cert.employees) ? cert.employees[0] : cert.employees;
    const crs = Array.isArray(cert.courses)   ? cert.courses[0]   : cert.courses;
    return {
      id:                cert.id,
      certificate_no:    cert.certificate_no    ?? "",
      certificate_title: cert.certificate_title ?? "",
      employee_name:     emp ? [emp.first_name, emp.last_name].filter(Boolean).join(" ") : "—",
      course_title:      crs?.course_title ?? "—",
      issued_date:       cert.issued_date  ?? "",
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Learning Path Report
// ─────────────────────────────────────────────────────────────────────────────

export async function loadLearningPathReport(
  filters: ReportFilters
): Promise<LearningPathReportRow[]> {
  let query = supabase
    .from("learning_paths")
    .select("id, path_code, path_name, difficulty_level, created_at")
    .order("display_order", { ascending: true });

  if (filters.learning_path_id) query = query.eq("id", filters.learning_path_id);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Pull progress for each path
  const { data: progData } = await supabase
    .from("learning_path_progress")
    .select("learning_path_id, status, progress_percentage");

  const progRows = progData ?? [];
  return (data ?? []).map((lp) => {
    const rows      = progRows.filter((r) => r.learning_path_id === lp.id);
    const completed = rows.filter((r) => r.status === "completed").length;
    const avg       = rows.length
      ? Math.round(rows.reduce((s, r) => s + (r.progress_percentage ?? 0), 0) / rows.length)
      : 0;
    return {
      id:               lp.id,
      path_code:        lp.path_code        ?? "",
      path_name:        lp.path_name        ?? "",
      difficulty_level: lp.difficulty_level ?? "",
      enrolled_count:   rows.length,
      completed_count:  completed,
      avg_progress:     avg,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Department Report
// ─────────────────────────────────────────────────────────────────────────────

export async function loadDepartmentReport(
  filters: ReportFilters
): Promise<DepartmentReportRow[]> {
  let query = supabase
    .from("departments")
    .select(`id, department_name, companies ( company_name )`)
    .order("department_name", { ascending: true });

  if (filters.company_id) query = query.eq("company_id", filters.company_id);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const { data: empData } = await supabase
    .from("employees")
    .select("department_id");

  const empRows = empData ?? [];
  return (data ?? []).map((d) => {
    const co = Array.isArray(d.companies) ? d.companies[0] : d.companies;
    return {
      id:              d.id,
      department_name: d.department_name ?? "",
      company_name:    co?.company_name ?? "—",
      employee_count:  empRows.filter((e) => e.department_id === d.id).length,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Branch Report
// ─────────────────────────────────────────────────────────────────────────────

export async function loadBranchReport(
  filters: ReportFilters
): Promise<BranchReportRow[]> {
  let query = supabase
    .from("branches")
    .select(`id, branch_name, companies ( company_name )`)
    .order("branch_name", { ascending: true });

  if (filters.company_id) query = query.eq("company_id", filters.company_id);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const { data: empData } = await supabase
    .from("employees")
    .select("branch_id");

  const empRows = empData ?? [];
  return (data ?? []).map((b) => {
    const co = Array.isArray(b.companies) ? b.companies[0] : b.companies;
    return {
      id:             b.id,
      branch_name:    b.branch_name   ?? "",
      company_name:   co?.company_name ?? "—",
      employee_count: empRows.filter((e) => e.branch_id === b.id).length,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Company Report
// ─────────────────────────────────────────────────────────────────────────────

export async function loadCompanyReport(): Promise<CompanyReportRow[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, company_name")
    .order("company_name", { ascending: true });

  if (error) throw new Error(error.message);

  const [
    { data: brData },
    { data: empData },
    { data: crsData },
  ] = await Promise.all([
    supabase.from("branches").select("company_id"),
    supabase.from("employees").select("company_id"),
    supabase.from("courses").select("company_id"),
  ]);

  const branches   = brData  ?? [];
  const employees  = empData ?? [];
  const courses    = crsData ?? [];

  return (data ?? []).map((co) => ({
    id:             co.id,
    company_name:   co.company_name ?? "",
    branch_count:   branches.filter((b) => b.company_id === co.id).length,
    employee_count: employees.filter((e) => e.company_id === co.id).length,
    course_count:   courses.filter((c) => c.company_id  === co.id).length,
  }));
}
