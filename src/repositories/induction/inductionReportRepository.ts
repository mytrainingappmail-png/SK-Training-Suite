// Raw data for the Induction progress report (Reports → Induction) — what each employee in
// induction has finished. Everything is read within the viewer's own company by row-level security.

import { supabase } from '../../lib/supabase';

export interface ReportAssignment { employee_id: string; status: string; assigned_at: string; completed_at: string | null }
export interface ReportEmployee { id: string; employee_code: string; first_name: string; last_name: string | null; branch_id: string | null; active: boolean }
export interface ReportDay { id: string; title: string; display_order: number; active: boolean; branch_id: string | null; source_id: string | null; day_label: string | null }
export interface ReportSection { id: string; day_id: string; section_type: string; title: string; assessment_id: string | null; display_order: number }
export interface ReportCompletion { employee_id: string; day_id: string; completed_at: string }
export interface ReportView { employee_id: string; section_id: string; viewed_at: string }
export interface ReportPass { employee_id: string; assessment_id: string }

export interface InductionReportData {
  assignments: ReportAssignment[];
  employees: ReportEmployee[];
  branches: { id: string; branch_name: string }[];
  days: ReportDay[];
  sections: ReportSection[];
  completions: ReportCompletion[];
  views: ReportView[];
  passes: ReportPass[];
}

function must<T>(label: string, res: { data: T[] | null; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data ?? [];
}

export async function loadInductionReportData(): Promise<InductionReportData> {
  const [assignments, days, sections, completions, views, branches] = await Promise.all([
    supabase.from('induction_assignments').select('employee_id, status, assigned_at, completed_at'),
    supabase.from('induction_days').select('id, title, display_order, active, branch_id, source_id, day_label').order('display_order', { ascending: true }),
    supabase.from('induction_day_sections').select('id, day_id, section_type, title, assessment_id, display_order').order('display_order', { ascending: true }),
    supabase.from('induction_day_completions').select('employee_id, day_id, completed_at'),
    supabase.from('induction_section_views').select('employee_id, section_id, viewed_at'),
    supabase.from('branches').select('id, branch_name'),
  ]);
  const assigned = must('assignments', assignments as never) as ReportAssignment[];
  const ids = assigned.map((a) => a.employee_id);

  const employees = ids.length
    ? must('employees', await supabase.from('employees').select('id, employee_code, first_name, last_name, branch_id, active').in('id', ids))
    : [];
  const testIds = must('sections', sections as never).map((s) => (s as ReportSection).assessment_id).filter((x): x is string => !!x);
  const passes = ids.length && testIds.length
    ? must('passes', await supabase.from('assessment_results').select('employee_id, assessment_id').eq('passed', true).in('employee_id', ids).in('assessment_id', testIds))
    : [];

  return {
    assignments: assigned,
    employees: employees as ReportEmployee[],
    branches: must('branches', branches as never) as { id: string; branch_name: string }[],
    days: must('days', days as never) as ReportDay[],
    sections: must('sections', sections as never) as ReportSection[],
    completions: must('completions', completions as never) as ReportCompletion[],
    views: must('views', views as never) as ReportView[],
    passes: passes as ReportPass[],
  };
}
