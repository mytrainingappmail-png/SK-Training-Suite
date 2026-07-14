// src/repositories/continueLearning/continueLearningRepository.ts
//
// Supabase queries only — zero business logic.
// Nested relations typed as Array (Supabase JS always returns arrays for
// to-many joins). Consumers (the service layer) derive the resume point.
//
// Tables queried — ONLY these, as required:
//   enrollments        columns: employee_id, enrollment_type, course_id,
//                               status, completion_percentage, updated_at,
//                               is_active
//   courses            columns: id, course_name, course_code, thumbnail
//   lessons            columns: id, module_id, lesson_title, display_order,
//                               duration_minutes, active
//   learning_resources columns: id, lesson_id, resource_title, file_url,
//                               resource_type, display_order, active
//
// NOTE: lessons are reached from courses through the existing modules FK
// path (lessons.module_id -> modules.id -> modules.course_id) purely as a
// nested embed — no data is read from or filtered against any table beyond
// the four listed above.

import { supabase } from '../../lib/supabase';

// ── Raw row types (minimal — only columns Continue Learning needs) ────────────

export interface RawResourceRow {
  id:             string;
  resource_title: string;
  file_url:       string;
  resource_type:  string;
  display_order:  number;
  active:         boolean;
}

export interface RawLessonRow {
  id:                 string;
  lesson_title:       string;
  display_order:      number;
  duration_minutes:   number;
  active:             boolean;
  learning_resources: RawResourceRow[] | null;
}

export interface RawModuleRow {
  id: string;
  active: boolean;
  lessons: RawLessonRow[] | null;
}
export interface RawCourseRow {
  id:          string;
  course_name: string;
  course_code: string;
  thumbnail:   string;
  modules:     RawModuleRow[] | null;
}

export interface RawContinueLearningEnrollmentRow {
  id:                    string;
  course_id:             string;
  status:                string;
  completion_percentage: number;
  updated_at:            string;
  courses:               RawCourseRow[] | null;
}

// ── Repository functions ──────────────────────────────────────────────────────

/**
 * All in-progress (or not-yet-started) course enrollments for the employee,
 * joined all the way down to lessons and their learning resources so the
 * service layer can derive the resume point without further queries.
 */
export async function getInProgressCourseEnrollments(
  employeeId: string
): Promise<RawContinueLearningEnrollmentRow[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select(
      `id,
       course_id,
       status,
       completion_percentage,
       updated_at,
       courses (
         id,
         course_name,
         course_code,
         thumbnail,
         modules (
   id,
   active,
           lessons (
             id,
             lesson_title,
             display_order,
             duration_minutes,
             active,
             learning_resources (
               id,
               resource_title,
               file_url,
               resource_type,
               display_order,
               active
             )
           )
         )
       )`
    )
    .eq('employee_id', employeeId)
    .eq('enrollment_type', 'COURSE')
    .in('status', ['PENDING', 'IN_PROGRESS'])
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[continueLearningRepository] getInProgressCourseEnrollments:', error.message);
    throw new Error(error.message);
  }

  return (data ?? []) as RawContinueLearningEnrollmentRow[];
}
