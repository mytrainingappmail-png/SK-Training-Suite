// Raw data for Reports -> Pending tests: every test somebody still has to pass.
// Two places hand out tests: assessments assigned to an employee, and the test cards of the Induction days.
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
export interface PendingAssessment { id: string; assessment_title: string; assessment_code: string | null; passing_percentage: number; maximum_attempts: number }
export interface PendingEmployee { id: string; employee_code: string; first_name: string; last_name: string | null; branch_id: string | null; active: boolean }
export interface PendingAttempt { employee_id: string; assessment_id: string; status: string; started_at: string; submitted_at: string | null; completed_at: string | null }
export interface PendingResult { employee_id: string; assessment_id: string; percentage: number; passed: boolean }

export interface PendingTestsData {
  assignments: PendingAssignment[];
  induction: InductionReportData;
  assessments: PendingAssessment[];
  employees: PendingEmployee[];
  attempts: PendingAttempt[];
  results: PendingResult[];
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

export async function loadPendingTestsData(): Promise<PendingTestsData> {
  const [assignments, induction] = await Promise.all([
    fetchAll<PendingAssignment>('assignments', (from, to) =>
      supabase.from('assessment_assignments')
        .select('assessment_id, employee_id, end_date, maximum_attempts, mandatory, assignment_status')
        .eq('assignment_type', 'employee').eq('active', true).neq('assignment_status', 'cancelled')
        .range(from, to) as never),
    loadInductionReportData(),
  ]);

  const testIds = new Set<string>(assignments.map((a) => a.assessment_id));
  for (const s of induction.sections) if (s.section_type === 'test' && s.assessment_id) testIds.add(s.assessment_id);
  const empIds = new Set<string>([...assignments.map((a) => a.employee_id), ...induction.assignments.map((a) => a.employee_id)]);
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
  for (const part of chunks(testList)) {
    attempts.push(...await fetchAll<PendingAttempt>('attempts', (from, to) =>
      supabase.from('assessment_attempts').select('employee_id, assessment_id, status, started_at, submitted_at, completed_at').in('assessment_id', part).range(from, to) as never));
    results.push(...await fetchAll<PendingResult>('results', (from, to) =>
      supabase.from('assessment_results').select('employee_id, assessment_id, percentage, passed').in('assessment_id', part).range(from, to) as never));
  }

  return { assignments, induction, assessments, employees, attempts, results };
}
