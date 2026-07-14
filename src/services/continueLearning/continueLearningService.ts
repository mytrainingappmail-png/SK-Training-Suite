// src/services/continueLearning/continueLearningService.ts
//
// Business logic only — no Supabase imports.
// Derives the resume point (lesson + resource, remaining lessons, estimated
// time remaining) for each in-progress course enrollment.

import { getInProgressCourseEnrollments } from '../../repositories/continueLearning/continueLearningRepository';
import type {
  RawContinueLearningEnrollmentRow,
  RawLessonRow,
} from '../../repositories/continueLearning/continueLearningRepository';

import type {
  ContinueLearningItem,
  ContinueLearningLesson,
  ContinueLearningResource,
} from '../../types/continueLearning';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface FlatLesson {
  order:  number;
  lesson: RawLessonRow;
}

/** Flattens active modules/lessons into a single ordered sequence. */
function flattenLessons(row: RawContinueLearningEnrollmentRow): FlatLesson[] {
  const course  = row.courses?.[0];
  const modules = (course?.modules ?? [])
    .filter((m) => m.active)
    .sort((a, b) => a.id.localeCompare(b.id));

  const flat: FlatLesson[] = [];
  let order = 0;

  modules.forEach((mod) => {
    const lessons = (mod.lessons ?? [])
      .filter((l) => l.active)
      .sort((a, b) => a.display_order - b.display_order);

    lessons.forEach((lesson) => {
      flat.push({ order, lesson });
      order += 1;
    });
  });

  return flat;
}

function resolveResource(lesson: RawLessonRow): ContinueLearningResource | null {
  const resources = (lesson.learning_resources ?? [])
    .filter((r) => r.active)
    .sort((a, b) => a.display_order - b.display_order);

  const first = resources[0];
  if (!first) return null;

  return {
    id:            first.id,
    resourceTitle: first.resource_title ?? '',
    fileUrl:       first.file_url       ?? '',
    resourceType:  first.resource_type  ?? '',
  };
}

function buildResumeLesson(lesson: RawLessonRow): ContinueLearningLesson {
  return {
    id:              lesson.id,
    lessonTitle:     lesson.lesson_title ?? '',
    durationMinutes: lesson.duration_minutes ?? 0,
    resource:        resolveResource(lesson),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — single export consumed by ContinueLearning component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads a Continue Learning list for the given employee: one card per
 * in-progress (or not-yet-started) course enrollment, each carrying the
 * derived resume lesson/resource, remaining lesson count and estimated
 * time remaining.
 */
export async function loadContinueLearning(
  employeeId: string
): Promise<ContinueLearningItem[]> {
  if (!employeeId) {
    throw new Error('Employee ID is required to load continue learning.');
  }

  const enrollmentRows = await getInProgressCourseEnrollments(employeeId);

  return enrollmentRows
    .map((row): ContinueLearningItem | null => {
      const course = row.courses?.[0];
      if (!course) return null;

      const flatLessons  = flattenLessons(row);
      const totalLessons = flatLessons.length;
      const pct          = row.completion_percentage ?? 0;

      const currentIndex =
        totalLessons > 0
          ? Math.min(totalLessons - 1, Math.floor((pct / 100) * totalLessons))
          : 0;

      const currentFlat  = flatLessons[currentIndex] ?? null;
      const resumeLesson = currentFlat ? buildResumeLesson(currentFlat.lesson) : null;

      const isComplete        = pct >= 100 || totalLessons === 0;
      const remainingLessons  = isComplete ? 0 : Math.max(totalLessons - currentIndex, 0);

      const estimatedMinutesRemaining = isComplete
        ? 0
        : flatLessons
            .slice(currentIndex)
            .reduce((sum, f) => sum + (f.lesson.duration_minutes ?? 0), 0);

      return {
        enrollmentId:              row.id,
        courseId:                  row.course_id,
        courseName:                course.course_name ?? 'Untitled Course',
        courseCode:                course.course_code ?? '',
        courseThumbnail:           course.thumbnail    ?? '',
        completionPercentage:      pct,
        lastAccessedDate:          row.updated_at ?? null,
        totalLessons,
        remainingLessons,
        estimatedMinutesRemaining,
        resumeLesson,
      };
    })
    .filter((item): item is ContinueLearningItem => item !== null);
}
