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
  thumbnail:        string;
  duration_minutes: number;
  display_order:    number;
  downloadable:     boolean;
  learning_resources: SBResource[] | null;
  assessments:      { id: string } | { id: string }[] | null;
}

interface SBModule {
  id:                string;
  module_code:       string;
  module_name:       string;
  description:       string;
  module_order:      number;
  estimated_minutes: number;
  thumbnail:         string;
  lessons:           SBLesson[] | null;
}

interface SBCourse {
  id:                  string;
  course_code:         string;
  course_name:         string;
  short_description:   string;
  full_description:    string;
  thumbnail:           string;
  level:               string;
  duration_days:       number;
  duration_hours:      number;
  passing_percentage:  number;
  certificate_enabled: boolean;
  require_completion_before_next: boolean;
  test_compulsory_after_module:   boolean;
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
  const assessment = unwrap(l.assessments);
  return {
    id:              l.id,
    lessonTitle:     l.lesson_title,
    lessonType:      l.lesson_type      as CoursePlayerLesson['lessonType'],
    content:         l.content          ?? '',
    videoUrl:        l.video_url        ?? '',
    thumbnail:       l.thumbnail        ?? '',
    durationMinutes: l.duration_minutes ?? 0,
    displayOrder:    l.display_order    ?? 1,
    downloadable:    l.downloadable     ?? false,
    resources:       (l.learning_resources ?? []).map(normaliseResource)
                       .sort((a, b) => a.displayOrder - b.displayOrder),
    completed:       completedIds.has(l.id),
    assessmentId:    assessment?.id ?? null,
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
    thumbnail:        m.thumbnail         ?? '',
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
    fullDescription:    c.full_description    ?? '',
    thumbnail:          c.thumbnail           ?? '',
    level:              c.level               ?? 'beginner',
    durationDays:       c.duration_days       ?? 0,
    durationHours:      c.duration_hours      ?? 0,
    passingPercentage:  c.passing_percentage  ?? 50,
    certificateEnabled: c.certificate_enabled ?? false,
    requireCompletionBeforeNext: c.require_completion_before_next ?? false,
    testCompulsoryAfterModule:   c.test_compulsory_after_module   ?? false,
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
         full_description,
         thumbnail,
         level,
         duration_days,
         duration_hours,
         passing_percentage,
         certificate_enabled,
         require_completion_before_next,
         test_compulsory_after_module,
         modules (
           id,
           module_code,
           module_name,
           description,
           module_order,
           estimated_minutes,
           thumbnail,
           lessons (
             id,
             lesson_title,
             lesson_type,
             content,
             video_url,
             thumbnail,
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
             ),
             assessments (
               id
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

  // 2. Fetch completed lesson IDs for this enrollment from lesson_progress
  const completedIds = new Set<string>();

  const { data: progressRows, error: progressErr } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('enrollment_id', enrollmentId);

  if (progressErr) throw new Error(progressErr.message);
  (progressRows ?? []).forEach((p) => completedIds.add(p.lesson_id as string));

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
  lessonId:     string,
  companyId:    string,
  percentage:   number,
): Promise<void> {
  const { error: progressErr } = await supabase
    .from('lesson_progress')
    .upsert(
      { enrollment_id: enrollmentId, lesson_id: lessonId, company_id: companyId },
      { onConflict: 'enrollment_id,lesson_id' },
    );

  if (progressErr) throw new Error(progressErr.message);

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

// Returns the subset of `assessmentIds` that this employee has PASSED at
// least once — used to gate module progression when
// `testCompulsoryAfterModule` is on.
export async function getPassedAssessmentIds(
  employeeId:    string,
  assessmentIds: string[],
): Promise<Set<string>> {
  if (assessmentIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from('assessment_results')
    .select('assessment_id')
    .eq('employee_id', employeeId)
    .eq('passed', true)
    .in('assessment_id', assessmentIds);

  if (error) throw new Error(error.message);

  return new Set((data ?? []).map((r) => r.assessment_id as string));
}