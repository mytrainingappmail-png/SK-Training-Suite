// Raw data for Reports -> Pending tests: every test somebody still has to pass.
// Four places hand out tests:
//   - assessments assigned to an employee,
//   - the test cards of the Induction days,
//   - a Project's test (for people who marked that project complete), and
//   - a Course's final / module test (for people enrolled in that course)
// - the last two only when the admin switched "employees must pass this test" on for that test.
// Everything is read inside the viewer's own company by row-level security. Lists are fetched page by page
// because one request returns at most 1000 rows.

import { supabase } from '../../lib/supabase';
import { loadInductionReportData } from '../induction/inductionReportRepository';
import type { InductionReportData } from '../induction/inductionReportRepository';

export interface PendingAssignment {
  assessment_id: string;
  employee_id: string;
  end_date: string | null;
  maximum_attempts: number | null;
  mandatory: boolean;
  assignment_status: string;
}
export interface PendingAssessment { id: string; assessment_title: string; assessment_code: string | null; passing_percentage: number; maximum_attempts: number; must_pass?: boolean }
export interface PendingEmployee { id: string; employee_code: string; first_name: string; last_name: string | null; branch_id: string | null; active: boolean }
export interface PendingAttempt { employee_id: string; assessment_id: string; status: string; started_at: string; submitted_at: string | null; completed_at: string | null }
export interface PendingResult { employee_id: string; assessment_id: string; percentage: number; passed: boolean }
export interface PendingGrant { assessment_id: string; employee_id: string; extra_attempts: number }
/** A must-pass test that belongs to a Project / a Course, with the thing's name. */
export interface PendingLinkedTest { assessment_id: string; ref_id: string; ref_name: string }
export interface PendingProjectDone { project_id: string; employee_id: string }
export interface PendingCourseEnrollment { course_id: string; employee_id: string }

export interface PendingTestsData {
  assignments: PendingAssignment[];
  induction: InductionReportData;
  assessments: PendingAssessment[];
  employees: PendingEmployee[];
  attempts: PendingAttempt[];
  results: PendingResult[];
  grants: PendingGrant[];
  projectTests: PendingLinkedTest[];
  projectDone: PendingProjectDone[];
  courseTests: PendingLinkedTest[];
  courseEnrollments: PendingCourseEnrollment[];
}

const PAGE = 1000;
const CHUNK = 150;

/** Reads every row of a query (the query is rebuilt for each page). */
async function fetchAll<T>(label: string, build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const chunks = <T,>(list: T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
};

/** A table that may not exist yet / may be unreadable for this person must not break the whole report. */
async function soft<T>(work: Promise<T>, fallback: T): Promise<T> {
  try { return await work; } catch { return fallback; }
}

/** Must-pass tests that sit inside a Project: which project, and which people marked it complete. */
async function loadProjectSide(mustPassIds: string[]): Promise<{ tests: PendingLinkedTest[]; done: PendingProjectDone[] }> {
  if (mustPassIds.length === 0) return { tests: [], done: [] };
  const sections: { project_id: string; assessment_id: string }[] = [];
  for (const part of chunks(mustPassIds)) {
    const { data, error } = await supabase.from('real_estate_project_sections').select('project_id, assessment_id').eq('section_type', 'test').in('assessment_id', part);
    if (error) throw new Error(`project tests: ${error.message}`);
    sections.push(...((data ?? []) as { project_id: string; assessment_id: string }[]));
  }
  const projectIds = Array.from(new Set(sections.map((s) => s.project_id)));
  if (projectIds.length === 0) return { tests: [], done: [] };
  const names = new Map<string, string>();
  const done: PendingProjectDone[] = [];
  for (const part of chunks(projectIds)) {
    const { data, error } = await supabase.from('real_estate_projects').select('id, project_name').in('id', part);
    if (error) throw new Error(`projects: ${error.message}`);
    for (const p of (data ?? []) as { id: string; project_name: string }[]) names.set(p.id, p.project_name);
    done.push(...await fetchAll<PendingProjectDone>('project progress', (from, to) =>
      supabase.from('real_estate_project_progress').select('project_id, employee_id').in('project_id', part).range(from, to) as never));
  }
  return { tests: sections.map((s) => ({ assessment_id: s.assessment_id, ref_id: s.project_id, ref_name: names.get(s.project_id) ?? 'Project' })), done };
}

/** Must-pass tests that sit inside a Course (a quiz lesson): which course, and who is enrolled. */
async function loadCourseSide(mustPass: PendingAssessment[]): Promise<{ tests: PendingLinkedTest[]; enrollments: PendingCourseEnrollment[] }> {
  const withLesson = mustPass as (PendingAssessment & { lesson_id?: string | null })[];
  const lessonIds = Array.from(new Set(withLesson.map((a) => a.lesson_id).filter((x): x is string => !!x)));
  if (lessonIds.length === 0) return { tests: [], enrollments: [] };
  const lessons: { id: string; module_id: string }[] = [];
  for (const part of chunks(lessonIds)) {
    const { data, error } = await supabase.from('lessons').select('id, module_id').in('id', part);
    if (error) throw new Error(`lessons: ${error.message}`);
    lessons.push(...((data ?? []) as { id: string; module_id: string }[]));
  }
  const moduleIds = Array.from(new Set(lessons.map((l) => l.module_id)));
  const modules: { id: string; course_id: string }[] = [];
  for (const part of chunks(moduleIds)) {
    const { data, error } = await supabase.from('modules').select('id, course_id').in('id', part);
    if (error) throw new Error(`modules: ${error.message}`);
    modules.push(...((data ?? []) as { id: string; course_id: string }[]));
  }
  const courseIds = Array.from(new Set(modules.map((m) => m.course_id)));
  const names = new Map<string, string>();
  const enrollments: PendingCourseEnrollment[] = [];
  for (const part of chunks(courseIds)) {
    const { data, error } = await supabase.from('courses').select('id, course_name').in('id', part);
    if (error) throw new Error(`courses: ${error.message}`);
    for (const c of (data ?? []) as { id: string; course_name: string }[]) names.set(c.id, c.course_name);
    enrollments.push(...await fetchAll<PendingCourseEnrollment>('enrollments', (from, to) =>
      supabase.from('enrollments').select('course_id, employee_id').in('course_id', part).neq('status', 'CANCELLED').range(from, to) as never));
  }
  const courseOfModule = new Map(modules.map((m) => [m.id, m.course_id]));
  const moduleOfLesson = new Map(lessons.map((l) => [l.id, l.module_id]));
  const tests: PendingLinkedTest[] = [];
  for (const a of withLesson) {
    const courseId = a.lesson_id ? courseOfModule.get(moduleOfLesson.get(a.lesson_id) ?? '') : undefined;
    if (courseId) tests.push({ assessment_id: a.id, ref_id: courseId, ref_name: names.get(courseId) ?? 'Course' });
  }
  return { tests, enrollments };
}

export async function loadPendingTestsData(): Promise<PendingTestsData> {
  const [assignments, induction, mustPassRows] = await Promise.all([
    fetchAll<PendingAssignment>('assignments', (from, to) =>
      supabase.from('assessment_assignments')
        .select('assessment_id, employee_id, end_date, maximum_attempts, mandatory, assignment_status')
        .eq('assignment_type', 'employee').eq('active', true).neq('assignment_status', 'cancelled')
        .range(from, to) as never),
    loadInductionReportData(),
    // the column exists only after its migration; until then there simply are no must-pass tests
    soft(fetchAll<PendingAssessment & { lesson_id: string | null }>('must-pass tests', (from, to) =>
      supabase.from('assessments').select('id, assessment_title, assessment_code, passing_percentage, maximum_attempts, lesson_id').eq('must_pass', true).range(from, to) as never), []),
  ]);

  const mustPassIds = mustPassRows.map((a) => a.id);
  const [project, course] = await Promise.all([
    soft(loadProjectSide(mustPassIds), { tests: [] as PendingLinkedTest[], done: [] as PendingProjectDone[] }),
    soft(loadCourseSide(mustPassRows), { tests: [] as PendingLinkedTest[], enrollments: [] as PendingCourseEnrollment[] }),
  ]);

  const testIds = new Set<string>(assignments.map((a) => a.assessment_id));
  for (const s of induction.sections) if (s.section_type === 'test' && s.assessment_id) testIds.add(s.assessment_id);
  for (const t of [...project.tests, ...course.tests]) testIds.add(t.assessment_id);
  const empIds = new Set<string>([
    ...assignments.map((a) => a.employee_id), ...induction.assignments.map((a) => a.employee_id),
    ...project.done.map((d) => d.employee_id), ...course.enrollments.map((e) => e.employee_id),
  ]);
  const testList = [...testIds];
  const empList = [...empIds];

  const assessments: PendingAssessment[] = [];
  for (const part of chunks(testList)) {
    const { data, error } = await supabase.from('assessments').select('id, assessment_title, assessment_code, passing_percentage, maximum_attempts').in('id', part);
    if (error) throw new Error(`assessments: ${error.message}`);
    assessments.push(...((data ?? []) as PendingAssessment[]));
  }

  const employees: PendingEmployee[] = [];
  for (const part of chunks(empList)) {
    const { data, error } = await supabase.from('employees').select('id, employee_code, first_name, last_name, branch_id, active').in('id', part);
    if (error) throw new Error(`employees: ${error.message}`);
    employees.push(...((data ?? []) as PendingEmployee[]));
  }

  const attempts: PendingAttempt[] = [];
  const results: PendingResult[] = [];
  const grants: PendingGrant[] = [];
  for (const part of chunks(testList)) {
    attempts.push(...await fetchAll<PendingAttempt>('attempts', (from, to) =>
      supabase.from('assessment_attempts').select('employee_id, assessment_id, status, started_at, submitted_at, completed_at').in('assessment_id', part).range(from, to) as never));
    results.push(...await fetchAll<PendingResult>('results', (from, to) =>
      supabase.from('assessment_results').select('employee_id, assessment_id, percentage, passed').in('assessment_id', part).range(from, to) as never));
    grants.push(...await soft(fetchAll<PendingGrant>('extra attempts', (from, to) =>
      supabase.from('assessment_attempt_grants').select('assessment_id, employee_id, extra_attempts').in('assessment_id', part).range(from, to) as never), []));
  }

  return {
    assignments, induction, assessments, employees, attempts, results, grants,
    projectTests: project.tests, projectDone: project.done, courseTests: course.tests, courseEnrollments: course.enrollments,
  };
}

/** A company admin gives one person extra attempts on one test (the database checks they really are an admin). */
export async function grantExtraAttempts(assessmentId: string, employeeId: string, extra: number): Promise<number> {
  const { data, error } = await supabase.rpc('grant_extra_attempts', { p_assessment_id: assessmentId, p_employee_id: employeeId, p_extra: extra });
  if (error) throw new Error(error.message);
  return Number(data) || 0;
}
