// src/repositories/coursePlayer/coursePlayerRepository.ts
//
// Supabase queries only — zero business logic.
//
// FIX: enrollments -> courses is a to-ONE relationship (many
// enrollments belong to one course), so PostgREST returns `courses`
// as a single object, NOT an array — unlike courses -> modules,
// modules -> lessons, and lessons -> learning_resources, which are all
// to-MANY and correctly come back as arrays. The old code did
// `row.courses?.[0]`, which silently returned undefined for an object
// (array-indexing a non-array), causing every course to fail with
// "Course not found." This now handles both shapes safely via unwrap().

import { supabase } from '../../lib/supabase';
import type {
  CoursePlayerData,
  CoursePlayerCourse,
  CoursePlayerModule,
  CoursePlayerLesson,
  CoursePlayerResource,
  CoursePlayerEnrollment,
} from '../../types/coursePlayer';

// ── Private Supabase-shaped interfaces ───────────────────────────────────────

interface SBResource {
  id:             string;
  resource_title: string;
  resource_type:  string;
  file_url:       string;
  description:    string;
  display_order:  number;
  downloadable:   boolean;
}

interface SBLesson {
  id:               string;
  lesson_title:     string;
  lesson_type:      string;
  content:          string;
  video_url:        string;
  duration_minutes: number;
  display_order:    number;
  downloadable:     boolean;
  learning_resources: SBResource[] | null;
}

interface SBModule {
  id:                string;
  module_code:       string;
  module_name:       string;
  description:       string;
  module_order:      number;
  estimated_minutes: number;
  lessons:           SBLesson[] | null;
}

interface SBCourse {
  id:                  string;
  course_code:         string;
  course_name:         string;
  short_description:   string;
  thumbnail:           string;
  level:               string;
  duration_days:       number;
  duration_hours:      number;
  passing_percentage:  number;
  certificate_enabled: boolean;
  modules:             SBModule[] | null;
}

interface SBEnrollmentRow {
  id:                    string;
  status:                string;
  completion_percentage: number;
  due_date:              string;
  completed_at:          string | null;
  courses:               SBCourse | SBCourse[] | null;
}

// ── Normalise helpers ─────────────────────────────────────────────────────────

// Supabase JS can return a to-one embed as either a single object or a
// single-item array depending on how PostgREST resolves the
// relationship — this handles both shapes safely everywhere it's used.
function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normaliseResource(r: SBResource): CoursePlayerResource {
  return {
    id:            r.id,
    resourceTitle: r.resource_title,
    resourceType:  r.resource_type  as CoursePlayerResource['resourceType'],
    fileUrl:       r.file_url       ?? '',
    description:   r.description    ?? '',
    displayOrder:  r.display_order  ?? 1,
    downloadable:  r.downloadable   ?? false,
  };
}

function normaliseLesson(l: SBLesson, completedIds: Set<string>): CoursePlayerLesson {
  return {
    id:              l.id,
    lessonTitle:     l.lesson_title,
    lessonType:      l.lesson_type      as CoursePlayerLesson['lessonType'],
    content:         l.content          ?? '',
    videoUrl:        l.video_url        ?? '',
    durationMinutes: l.duration_minutes ?? 0,
    displayOrder:    l.display_order    ?? 1,
    downloadable:    l.downloadable     ?? false,
    resources:       (l.learning_resources ?? []).map(normaliseResource)
                       .sort((a, b) => a.displayOrder - b.displayOrder),
    completed:       completedIds.has(l.id),
  };
}

function normaliseModule(m: SBModule, completedIds: Set<string>): CoursePlayerModule {
  return {
    id:               m.id,
    moduleCode:       m.module_code       ?? '',
    moduleName:       m.module_name,
    description:      m.description       ?? '',
    moduleOrder:      m.module_order      ?? 1,
    estimatedMinutes: m.estimated_minutes ?? 0,
    lessons:          (m.lessons ?? [])
                        .map((l) => normaliseLesson(l, completedIds))
                        .sort((a, b) => a.displayOrder - b.displayOrder),
  };
}

function normaliseCourse(c: SBCourse, completedIds: Set<string>): CoursePlayerCourse {
  return {
    id:                 c.id,
    courseCode:         c.course_code         ?? '',
    courseName:         c.course_name,
    shortDescription:   c.short_description   ?? '',
    thumbnail:          c.thumbnail           ?? '',
    level:              c.level               ?? 'beginner',
    durationDays:       c.duration_days       ?? 0,
    durationHours:      c.duration_hours      ?? 0,
    passingPercentage:  c.passing_percentage  ?? 50,
    certificateEnabled: c.certificate_enabled ?? false,
    modules:            (c.modules ?? [])
                          .map((m) => normaliseModule(m, completedIds))
                          .sort((a, b) => a.moduleOrder - b.moduleOrder),
  };
}

// ── Public repository function ────────────────────────────────────────────────

export async function getCoursePlayerData(
  enrollmentId: string,
  employeeId:   string,
): Promise<CoursePlayerData> {
  // 1. Fetch enrollment + full course tree
  const { data: enrollRow, error: enrollErr } = await supabase
    .from('enrollments')
    .select(
      `id,
       status,
       completion_percentage,
       due_date,
       completed_at,
       courses (
         id,
         course_code,
         course_name,
         short_description,
         thumbnail,
         level,
         duration_days,
         duration_hours,
         passing_percentage,
         certificate_enabled,
         modules (
           id,
           module_code,
           module_name,
           description,
           module_order,
           estimated_minutes,
           lessons (
             id,
             lesson_title,
             lesson_type,
             content,
             video_url,
             duration_minutes,
             display_order,
             downloadable,
             learning_resources (
               id,
               resource_title,
               resource_type,
               file_url,
               description,
               display_order,
               downloadable
             )
           )
         )
       )`
    )
    .eq('id', enrollmentId)
    .eq('employee_id', employeeId)
    .single();

  if (enrollErr) throw new Error(enrollErr.message);
  if (!enrollRow) throw new Error('Enrollment not found.');

  const row = enrollRow as unknown as SBEnrollmentRow;
  const sbCourse = unwrap(row.courses);
  if (!sbCourse) throw new Error('Course not found.');

  // 2. Fetch completed lesson IDs for this employee + course
  const allLessonIds: string[] = (sbCourse.modules ?? [])
    .flatMap((m) => (m.lessons ?? []).map((l) => l.id));

  const completedIds = new Set<string>();

  if (allLessonIds.length > 0) {
    // assessment_results tracks lesson completion via assessment_assignments
    // Use learning_path_progress or a dedicated lesson progress table if available.
    // For now derive from enrollment completion_percentage being 100 as a safe fallback.
    // Actual lesson-level progress requires a lesson_progress table (not yet migrated).
    // We leave completedIds empty — UI shows 0% per lesson until that table exists.
    void allLessonIds; // prevent unused-variable warning
  }

  const enrollment: CoursePlayerEnrollment = {
    enrollmentId:         row.id,
    status:               row.status,
    completionPercentage: row.completion_percentage ?? 0,
    dueDate:              row.due_date              ?? '',
    completedAt:          row.completed_at          ?? null,
  };

  const course = normaliseCourse(sbCourse, completedIds);

  return { course, enrollment };
}

export async function markLessonComplete(
  enrollmentId: string,
  _lessonId:    string,
  percentage:   number,
): Promise<void> {
  const { error } = await supabase
    .from('enrollments')
    .update({
      completion_percentage: percentage,
      status:                percentage >= 100 ? 'COMPLETED' : 'IN_PROGRESS',
      completed_at:          percentage >= 100 ? new Date().toISOString() : null,
    })
    .eq('id', enrollmentId);

  if (error) throw new Error(error.message);
}