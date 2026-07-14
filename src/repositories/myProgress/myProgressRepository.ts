// src/repositories/myProgress/myProgressRepository.ts
//
// Supabase queries only — zero business logic.
// Nested relations typed as Array (Supabase JS always returns arrays for
// to-many joins and may return a single object or array for to-one joins
// depending on FK direction). Consumers (the service layer) unwrap these.
//
// Tables queried — ONLY these three, as required:
//   enrollments             columns: employee_id, enrollment_type, course_id,
//                                    status, completion_percentage,
//                                    updated_at, courses ( course_name, course_code )
//   assessment_attempts     columns: employee_id, assessment_id, status,
//                                    percentage, passed, started_at,
//                                    completed_at, submitted_at,
//                                    assessments ( assessment_title, assessment_code )
//   learning_path_progress  columns: employee_id, learning_path_id, status,
//                                    progress_percentage, completed_courses,
//                                    total_courses, last_accessed_at,
//                                    learning_paths ( path_name, path_code )

import { supabase } from '../../lib/supabase';

// ── Raw row types (minimal — only columns myProgress needs) ───────────────────

export interface RawEnrollmentRow {
  id:                    string;
  course_id:             string;
  status:                string;
  completion_percentage: number;
  updated_at:            string;
  courses: Array<{
    course_name: string;
    course_code: string;
  }> | null;
}

export interface RawAssessmentAttemptRow {
  id:            string;
  assessment_id: string;
  status:        string;
  percentage:    number;
  passed:        boolean;
  started_at:    string;
  completed_at:  string | null;
  submitted_at:  string | null;
  assessments: Array<{
    assessment_title: string;
    assessment_code:  string;
  }> | null;
}

export interface RawLearningPathProgressRow {
  id:                  string;
  learning_path_id:    string;
  status:              string;
  progress_percentage: number;
  completed_courses:   number;
  total_courses:       number;
  last_accessed_at:    string | null;
  learning_paths: Array<{
    path_name: string;
    path_code: string;
  }> | null;
}

// ── Repository functions ──────────────────────────────────────────────────────

/** All course-type enrollments for the employee, joined to courses for names. */
export async function getCourseEnrollments(
  employeeId: string
): Promise<RawEnrollmentRow[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select(
      `id,
       course_id,
       status,
       completion_percentage,
       updated_at,
       courses ( course_name, course_code )`
    )
    .eq('employee_id', employeeId)
    .eq('enrollment_type', 'COURSE')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[myProgressRepository] getCourseEnrollments:', error.message);
    throw new Error(error.message);
  }

  return (data ?? []) as RawEnrollmentRow[];
}

/** All assessment attempts for the employee, joined to assessments for titles. */
export async function getAssessmentAttempts(
  employeeId: string
): Promise<RawAssessmentAttemptRow[]> {
  const { data, error } = await supabase
    .from('assessment_attempts')
    .select(
      `id,
       assessment_id,
       status,
       percentage,
       passed,
       started_at,
       completed_at,
       submitted_at,
       assessments ( assessment_title, assessment_code )`
    )
    .eq('employee_id', employeeId)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('[myProgressRepository] getAssessmentAttempts:', error.message);
    throw new Error(error.message);
  }

  return (data ?? []) as RawAssessmentAttemptRow[];
}

/** All learning path progress rows for the employee, joined to learning_paths. */
export async function getLearningPathProgress(
  employeeId: string
): Promise<RawLearningPathProgressRow[]> {
  const { data, error } = await supabase
    .from('learning_path_progress')
    .select(
      `id,
       learning_path_id,
       status,
       progress_percentage,
       completed_courses,
       total_courses,
       last_accessed_at,
       learning_paths ( path_name, path_code )`
    )
    .eq('employee_id', employeeId)
    .order('last_accessed_at', { ascending: false });

  if (error) {
    console.error('[myProgressRepository] getLearningPathProgress:', error.message);
    throw new Error(error.message);
  }

  return (data ?? []) as RawLearningPathProgressRow[];
}
