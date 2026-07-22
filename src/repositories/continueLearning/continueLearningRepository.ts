// src/repositories/continueLearning/continueLearningRepository.ts
//
// Supabase queries only — zero business logic.
//
// FIX: the original single 5-level-deep nested select (enrollments ->
// courses -> modules -> lessons -> learning_resources) triggered a
// genuine PostgREST internal aliasing bug ("column modules_2.display_
// order does not exist") — a known limitation with very deep nested
// embeds, not a real schema problem. This now fetches each level as
// its own simple, flat query and joins them in JS, exactly like the
// pattern already used elsewhere in this app (moduleService +
// lessonBuilderService, etc.) — same real data, no PostgREST depth
// limit involved.

import { supabase } from '../../lib/supabase';

// ── Raw row types (minimal — only columns Continue Learning needs) ────────────

export interface RawResourceRow {
  id:             string;
  resource_title: string;
  file_url:       string;
  resource_type:  string;
  display_order:  number;
  active:         boolean;
  lesson_id:      string;
}

export interface RawLessonRow {
  id:                 string;
  lesson_title:       string;
  display_order:      number;
  duration_minutes:   number;
  active:             boolean;
  module_id:          string;
  learning_resources: RawResourceRow[] | null;
}

export interface RawModuleRow {
  id:        string;
  active:    boolean;
  course_id: string;
  lessons:   RawLessonRow[] | null;
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
  courses:               RawCourseRow[] | RawCourseRow | null;
}

/**
 * All in-progress (or not-yet-started) course enrollments for the employee,
 * with the full course -> modules -> lessons -> resources tree assembled
 * from separate, flat queries (rather than one deep nested embed) so the
 * service layer can derive the resume point without further queries.
 */
export async function getInProgressCourseEnrollments(
  employeeId: string
): Promise<RawContinueLearningEnrollmentRow[]> {
  // 1. Enrollments + their course's basic info (2 levels — safe depth)
  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from('enrollments')
    .select(
      `id,
       course_id,
       status,
       completion_percentage,
       updated_at,
       courses ( id, course_name, course_code, thumbnail )`
    )
    .eq('employee_id', employeeId)
    .eq('enrollment_type', 'COURSE')
    .in('status', ['PENDING', 'IN_PROGRESS'])
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  if (enrollmentError) {
    console.error('[continueLearningRepository] enrollments:', enrollmentError.message);
    throw new Error(enrollmentError.message);
  }

  const enrollments = enrollmentData ?? [];
  const courseIds = Array.from(
    new Set(
      enrollments
        .map((e) => {
          const c = Array.isArray(e.courses) ? e.courses[0] : e.courses;
          return c?.id;
        })
        .filter((id): id is string => !!id)
    )
  );

  if (courseIds.length === 0) {
    return enrollments as unknown as RawContinueLearningEnrollmentRow[];
  }

  // 2. Modules for those courses (flat, 1 level)
  const { data: moduleData, error: moduleError } = await supabase
    .from('modules')
    .select('id, active, course_id')
    .in('course_id', courseIds);

  if (moduleError) {
    console.error('[continueLearningRepository] modules:', moduleError.message);
    throw new Error(moduleError.message);
  }

  const modules = moduleData ?? [];
  const moduleIds = modules.map((m) => m.id);

  // 3. Lessons + their resources for those modules (2 levels — safe depth)
  const { data: lessonData, error: lessonError } = moduleIds.length > 0
    ? await supabase
        .from('lessons')
        .select(
          `id, lesson_title, display_order, duration_minutes, active, module_id,
           learning_resources ( id, resource_title, file_url, resource_type, display_order, active, lesson_id )`
        )
        .in('module_id', moduleIds)
    : { data: [], error: null };

  if (lessonError) {
    console.error('[continueLearningRepository] lessons:', lessonError.message);
    throw new Error(lessonError.message);
  }

  const lessons = (lessonData ?? []) as unknown as RawLessonRow[];

  // 4. Assemble the tree in JS — same shape the service layer expects
  const lessonsByModuleId = new Map<string, RawLessonRow[]>();
  lessons.forEach((l) => {
    const list = lessonsByModuleId.get(l.module_id) ?? [];
    list.push(l);
    lessonsByModuleId.set(l.module_id, list);
  });

  const modulesByCourseId = new Map<string, RawModuleRow[]>();
  modules.forEach((m) => {
    const list = modulesByCourseId.get(m.course_id) ?? [];
    list.push({ ...m, lessons: lessonsByModuleId.get(m.id) ?? [] });
    modulesByCourseId.set(m.course_id, list);
  });

  return enrollments.map((e) => {
    const rawCourse = Array.isArray(e.courses) ? e.courses[0] : e.courses;
    const course: RawCourseRow | null = rawCourse
      ? { ...rawCourse, modules: modulesByCourseId.get(rawCourse.id) ?? [] }
      : null;

    return {
      id:                    e.id,
      course_id:             e.course_id,
      status:                e.status,
      completion_percentage: e.completion_percentage,
      updated_at:            e.updated_at,
      courses:               course,
    };
  });
}