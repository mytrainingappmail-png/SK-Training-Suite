// src/services/myProgress/myProgressService.ts
//
// Business logic only — no Supabase imports.

import {
  getCourseEnrollments,
  getAssessmentAttempts,
  getLearningPathProgress,
} from '../../repositories/myProgress/myProgressRepository';

import type {
  MyProgress,
  MyProgressSummary,
  MyCourseProgressItem,
  MyLearningPathProgressItem,
  MyAssessmentProgressItem,
} from '../../types/myProgress';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function latestDate(dates: Array<string | null | undefined>): string | null {
  const valid = dates
    .filter((d): d is string => !!d)
    .map((d) => new Date(d).getTime())
    .filter((t) => !Number.isNaN(t));

  if (valid.length === 0) return null;
  return new Date(Math.max(...valid)).toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — single export consumed by MyProgress component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads a full progress overview for the given employee.
 * Runs repository queries in parallel for performance.
 * Aggregates enrollments, assessment attempts and learning path progress
 * into summary counters plus per-item breakdown lists.
 */
export async function loadMyProgress(employeeId: string): Promise<MyProgress> {
  if (!employeeId) {
    throw new Error('Employee ID is required to load progress.');
  }

  const [enrollmentRows, attemptRows, pathProgressRows] = await Promise.all([
    getCourseEnrollments(employeeId),
    getAssessmentAttempts(employeeId),
    getLearningPathProgress(employeeId),
  ]);

  // ── Course progress ────────────────────────────────────────────────────────

  const courses: MyCourseProgressItem[] = enrollmentRows.map((e) => ({
    enrollmentId:         e.id,
    courseId:             e.course_id,
    courseName:           e.courses?.[0]?.course_name ?? 'Untitled Course',
    courseCode:           e.courses?.[0]?.course_code ?? '',
    status:               e.status,
    completionPercentage: e.completion_percentage ?? 0,
    lastActivityDate:     e.updated_at ?? null,
  }));

  const totalCourses      = courses.length;
  const coursesCompleted  = courses.filter((c) => c.status === 'COMPLETED').length;
  const coursesInProgress = courses.filter(
    (c) => c.status === 'IN_PROGRESS' || c.status === 'PENDING'
  ).length;
  const overallCourseProgressPct =
    totalCourses > 0
      ? Math.round(
          courses.reduce((sum, c) => sum + c.completionPercentage, 0) / totalCourses
        )
      : 0;

  // ── Learning path progress ─────────────────────────────────────────────────

  const learningPaths: MyLearningPathProgressItem[] = pathProgressRows.map((p) => ({
    progressId:         p.id,
    learningPathId:     p.learning_path_id,
    pathName:           p.learning_paths?.[0]?.path_name ?? 'Untitled Path',
    pathCode:           p.learning_paths?.[0]?.path_code ?? '',
    status:             p.status,
    progressPercentage: p.progress_percentage ?? 0,
    completedCourses:   p.completed_courses   ?? 0,
    totalCourses:       p.total_courses       ?? 0,
    lastActivityDate:   p.last_accessed_at    ?? null,
  }));

  const totalLearningPaths     = learningPaths.length;
  const learningPathsCompleted = learningPaths.filter((p) => p.status === 'completed').length;

  // ── Assessment statistics ──────────────────────────────────────────────────

  const assessments: MyAssessmentProgressItem[] = attemptRows.map((a) => ({
    attemptId:       a.id,
    assessmentId:    a.assessment_id,
    assessmentTitle: a.assessments?.[0]?.assessment_title ?? 'Assessment',
    assessmentCode:  a.assessments?.[0]?.assessment_code  ?? '',
    status:          a.status,
    percentage:      a.percentage ?? 0,
    passed:          a.passed ?? false,
    attemptDate:     a.completed_at ?? a.submitted_at ?? a.started_at ?? null,
  }));

  const scoredAttempts = assessments.filter(
    (a) => a.status !== 'in_progress' && a.status !== 'abandoned'
  );
  const totalAssessmentAttempts = assessments.length;
  const assessmentsPassed       = assessments.filter((a) => a.passed).length;
  const averageAssessmentScore =
    scoredAttempts.length > 0
      ? Math.round(
          scoredAttempts.reduce((sum, a) => sum + a.percentage, 0) / scoredAttempts.length
        )
      : 0;

  // ── Last activity across all three sources ────────────────────────────────

  const lastActivityDate = latestDate([
    ...courses.map((c) => c.lastActivityDate),
    ...learningPaths.map((p) => p.lastActivityDate),
    ...assessments.map((a) => a.attemptDate),
  ]);

  const summary: MyProgressSummary = {
    totalCourses,
    coursesCompleted,
    coursesInProgress,
    overallCourseProgressPct,
    totalLearningPaths,
    learningPathsCompleted,
    totalAssessmentAttempts,
    assessmentsPassed,
    averageAssessmentScore,
    lastActivityDate,
  };

  return { summary, courses, learningPaths, assessments };
}
