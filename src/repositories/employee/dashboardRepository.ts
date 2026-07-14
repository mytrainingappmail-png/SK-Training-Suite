// src/repositories/employee/dashboardRepository.ts
//
// Supabase queries only — zero business logic.
//
// Verified import paths from src/repositories/employee/:
//   ../../lib/supabase  → src/lib/supabase.ts  (exports: supabase)
//
// Tables queried (all exist in schema.sql or migrations):
//   enrollments            columns: employee_id, status, completion_percentage,
//                                   due_date, completed_at, course_id
//   courses                columns: id, course_name, course_code
//   learning_path_progress columns: employee_id, status
//   certificates           columns: employee_id, generated
//   assessment_assignments columns: employee_id, assignment_status, end_date,
//                                   assessment_id
//   assessments            columns: id, assessment_title, assessment_code

import { supabase } from '../../lib/supabase';

// ── Raw row types (minimal — only columns the dashboard needs) ────────────────

export interface RawEnrollmentRow {
  id:                    string;
  course_id:             string;
  status:                string;
  completion_percentage: number;
  due_date:              string;
  completed_at:          string | null;
 courses: {
  course_name: string;
  course_code: string;
}[];
}

export interface RawAssignmentRow {
  id:                string;
  assessment_id:     string;
  assignment_status: string;
  end_date:          string;
  assessments: {
  assessment_title: string;
  assessment_code: string;
}[];
}

// ── Repository functions ──────────────────────────────────────────────────────

/** All enrollments for the employee, joined to courses for display names. */
export async function getEnrollmentsByEmployee(
  employeeId: string
): Promise<RawEnrollmentRow[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      course_id,
      status,
      completion_percentage,
      due_date,
      completed_at,
      courses ( course_name, course_code )
    `)
    .eq('employee_id', employeeId)
    .eq('enrollment_type', 'COURSE')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[dashboardRepository] getEnrollmentsByEmployee:', error.message);
    throw new Error(error.message);
  }

  return (data ?? []) as RawEnrollmentRow[];
}

/** Count of active learning path enrollments for the employee. */
export async function getLearningPathCount(
  employeeId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('learning_path_progress')
    .select('*', { count: 'exact', head: true })
    .eq('employee_id', employeeId);

  if (error) {
    console.error('[dashboardRepository] getLearningPathCount:', error.message);
    return 0;
  }

  return count ?? 0;
}

/** Count of certificates issued to the employee. */
export async function getCertificateCount(
  employeeId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('certificates')
    .select('*', { count: 'exact', head: true })
    .eq('employee_id', employeeId)
    .eq('generated', true);

  if (error) {
    console.error('[dashboardRepository] getCertificateCount:', error.message);
    return 0;
  }

  return count ?? 0;
}

/** Upcoming (scheduled/active) assessment assignments for the employee. */
export async function getUpcomingAssessments(
  employeeId: string
): Promise<RawAssignmentRow[]> {
  const { data, error } = await supabase
    .from('assessment_assignments')
    .select(`
      id,
      assessment_id,
      assignment_status,
      end_date,
      assessments ( assessment_title, assessment_code )
    `)
    .eq('employee_id', employeeId)
    .in('assignment_status', ['scheduled', 'active'])
    .order('end_date', { ascending: true })
    .limit(5);

  if (error) {
    console.error('[dashboardRepository] getUpcomingAssessments:', error.message);
    return [];
  }

  return (data ?? []) as RawAssignmentRow[];
}
