// src/repositories/learning/learningRepository.ts
//
// Supabase queries only — zero business logic.
//
// Fix: Supabase JS infers nested relations as Array | null, not Object | null.
// Each function declares a private "Supabase-shaped" interface where the
// relation is typed as Array, reads data into that type, then normalises each
// row (takes [0] from the array) before casting to the exported interface whose
// relation field is typed as Object | null.  The service never changes — it
// continues to access e.courses?.course_name etc. without error.
//
// Import path from src/repositories/learning/:
//   ../../lib/supabase → src/lib/supabase.ts  (exports: supabase)

import { supabase } from '../../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Exported row shapes  (relation = single object | null)
// These are what the service receives and accesses with optional chaining.
// ─────────────────────────────────────────────────────────────────────────────

export interface RawCourseRow {
  id:                    string;
  course_id:             string;
  status:                string;
  completion_percentage: number;
  due_date:              string;
  completed_at:          string | null;
  courses: {
    course_code: string;
    course_name: string;
    thumbnail:   string;
  } | null;
}

export interface RawPathRow {
  id:                  string;
  learning_path_id:    string;
  progress_percentage: number;
  status:              string;
  completed_at:        string | null;
  learning_paths: {
    path_code:          string;
    path_name:          string;
    difficulty_level:   string;
    estimated_duration: number;
  } | null;
}

export interface RawAssessmentRow {
  id:                string;
  assessment_id:     string;
  assignment_status: string;
  end_date:          string;
  assessments: {
    assessment_code:  string;
    assessment_title: string;
  } | null;
}

export interface RawCertificateRow {
  id:                string;
  certificate_no:    string;
  certificate_title: string;
  issue_date:        string;
  certificate_url:   string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Private Supabase-shaped interfaces
// Supabase JS returns relations as Array | null even for FK → single row.
// Typed here so TypeScript accepts the query result without "as any".
// ─────────────────────────────────────────────────────────────────────────────

interface SupabaseCourseRow {
  id:                    string;
  course_id:             string;
  status:                string;
  completion_percentage: number;
  due_date:              string;
  completed_at:          string | null;
  courses: Array<{
    course_code: string;
    course_name: string;
    thumbnail:   string;
  }> | null;
}

interface SupabasePathRow {
  id:                  string;
  learning_path_id:    string;
  progress_percentage: number;
  status:              string;
  completed_at:        string | null;
  learning_paths: Array<{
    path_code:          string;
    path_name:          string;
    difficulty_level:   string;
    estimated_duration: number;
  }> | null;
}

interface SupabaseAssessmentRow {
  id:                string;
  assessment_id:     string;
  assignment_status: string;
  end_date:          string;
  assessments: Array<{
    assessment_code:  string;
    assessment_title: string;
  }> | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation helpers
// Convert the array-shaped relation to the single-object shape the service
// expects.  Takes index [0] — Supabase always returns at most one row for a
// FK-to-PK join.
// ─────────────────────────────────────────────────────────────────────────────

function normaliseCourse(row: SupabaseCourseRow): RawCourseRow {
  return {
    id:                    row.id,
    course_id:             row.course_id,
    status:                row.status,
    completion_percentage: row.completion_percentage,
    due_date:              row.due_date,
    completed_at:          row.completed_at,
    courses:               row.courses?.[0] ?? null,
  };
}

function normalisePath(row: SupabasePathRow): RawPathRow {
  return {
    id:                  row.id,
    learning_path_id:    row.learning_path_id,
    progress_percentage: row.progress_percentage,
    status:              row.status,
    completed_at:        row.completed_at,
    learning_paths:      row.learning_paths?.[0] ?? null,
  };
}

function normaliseAssessment(row: SupabaseAssessmentRow): RawAssessmentRow {
  return {
    id:                row.id,
    assessment_id:     row.assessment_id,
    assignment_status: row.assignment_status,
    end_date:          row.end_date,
    assessments:       row.assessments?.[0] ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository functions
// ─────────────────────────────────────────────────────────────────────────────

export async function getCoursesForEmployee(
  employeeId: string
): Promise<RawCourseRow[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      course_id,
      status,
      completion_percentage,
      due_date,
      completed_at,
      courses ( course_code, course_name, thumbnail )
    `)
    .eq('employee_id', employeeId)
    .eq('enrollment_type', 'COURSE')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[learningRepository] getCoursesForEmployee:', error.message);
    throw new Error(error.message);
  }

  return (data as SupabaseCourseRow[] ?? []).map(normaliseCourse);
}

export async function getPathsForEmployee(
  employeeId: string
): Promise<RawPathRow[]> {
  const { data, error } = await supabase
    .from('learning_path_progress')
    .select(`
      id,
      learning_path_id,
      progress_percentage,
      status,
      completed_at,
      learning_paths ( path_code, path_name, difficulty_level, estimated_duration )
    `)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[learningRepository] getPathsForEmployee:', error.message);
    throw new Error(error.message);
  }

  return (data as SupabasePathRow[] ?? []).map(normalisePath);
}

export async function getAssessmentsForEmployee(
  employeeId: string
): Promise<RawAssessmentRow[]> {
  const { data, error } = await supabase
    .from('assessment_assignments')
    .select(`
      id,
      assessment_id,
      assignment_status,
      end_date,
      assessments ( assessment_code, assessment_title )
    `)
    .eq('employee_id', employeeId)
    .order('end_date', { ascending: true });

  if (error) {
    console.error('[learningRepository] getAssessmentsForEmployee:', error.message);
    throw new Error(error.message);
  }

  return (data as SupabaseAssessmentRow[] ?? []).map(normaliseAssessment);
}

export async function getCertificatesForEmployee(
  employeeId: string
): Promise<RawCertificateRow[]> {
  const { data, error } = await supabase
    .from('certificates')
    .select('id, certificate_no, certificate_title, issue_date, certificate_url')
    .eq('employee_id', employeeId)
    .eq('generated', true)
    .eq('published', true)
    .order('issue_date', { ascending: false });

  if (error) {
    console.error('[learningRepository] getCertificatesForEmployee:', error.message);
    throw new Error(error.message);
  }

  return data ?? [];
}
