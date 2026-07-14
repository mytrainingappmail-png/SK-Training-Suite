// src/services/learning/learningService.ts
//
// Business logic only — no Supabase imports.
//
// Import paths from src/services/learning/:
//   ../../repositories/learning/learningRepository
//       exports: getCoursesForEmployee, getPathsForEmployee,
//                getAssessmentsForEmployee, getCertificatesForEmployee
//   ../../types/learning
//       exports: LearningHome, LearningHomeSummary, LearningCourse,
//                LearningPath, LearningAssessment, LearningCertificate

import {
  getCoursesForEmployee,
  getPathsForEmployee,
  getAssessmentsForEmployee,
  getCertificatesForEmployee,
} from '../../repositories/learning/learningRepository';

import type {
  LearningHome,
  LearningHomeSummary,
  LearningCourse,
  LearningPath,
  LearningAssessment,
  LearningCertificate,
} from '../../types/learning';

// ─────────────────────────────────────────────────────────────────────────────
// Public API — single export, consumed only by LearningHome component
// ─────────────────────────────────────────────────────────────────────────────

export async function loadLearningHome(
  employeeId: string
): Promise<LearningHome> {
  if (!employeeId) {
    throw new Error('Employee ID is required to load learning data.');
  }

  const [rawCourses, rawPaths, rawAssessments, rawCerts] = await Promise.all([
    getCoursesForEmployee(employeeId),
    getPathsForEmployee(employeeId),
    getAssessmentsForEmployee(employeeId),
    getCertificatesForEmployee(employeeId),
  ]);

  const courses: LearningCourse[] = rawCourses.map((e) => ({
    enrollmentId:         e.id,
    courseId:             e.course_id,
    courseCode:           e.courses?.course_code ?? '',
    courseName:           e.courses?.course_name ?? 'Untitled Course',
    thumbnail:            e.courses?.thumbnail   ?? '',
    completionPercentage: e.completion_percentage ?? 0,
    status:               e.status,
    dueDate:              e.due_date    ?? '',
    completedAt:          e.completed_at ?? null,
  }));

  const paths: LearningPath[] = rawPaths.map((p) => ({
    progressId:         p.id,
    learningPathId:     p.learning_path_id,
    pathCode:           p.learning_paths?.path_code          ?? '',
    pathName:           p.learning_paths?.path_name          ?? 'Untitled Path',
    difficultyLevel:    p.learning_paths?.difficulty_level   ?? 'beginner',
    estimatedDuration:  p.learning_paths?.estimated_duration ?? 0,
    progressPercentage: p.progress_percentage ?? 0,
    status:             p.status,
    completedAt:        p.completed_at ?? null,
  }));

  const assessments: LearningAssessment[] = rawAssessments.map((a) => ({
    assignmentId:    a.id,
    assessmentId:    a.assessment_id,
    assessmentCode:  a.assessments?.assessment_code  ?? '',
    assessmentTitle: a.assessments?.assessment_title ?? 'Assessment',
    endDate:         a.end_date ?? '',
    status:          a.assignment_status,
  }));

  const certificates: LearningCertificate[] = rawCerts.map((c) => ({
    id:               c.id,
    certificateNo:    c.certificate_no    ?? '',
    certificateTitle: c.certificate_title ?? 'Certificate',
    issueDate:        c.issue_date        ?? '',
    certificateUrl:   c.certificate_url   ?? '',
  }));

  const completedCourses  = courses.filter((c) => c.status === 'COMPLETED').length;
  const inProgressCourses = courses.filter((c) => c.status === 'IN_PROGRESS').length;
  const completedPaths    = paths.filter((p) => p.status === 'completed').length;

  const overallProgressPct =
    courses.length > 0
      ? Math.round(
          courses.reduce((sum, c) => sum + c.completionPercentage, 0) / courses.length
        )
      : 0;

  const summary: LearningHomeSummary = {
    totalCourses:       courses.length,
    completedCourses,
    inProgressCourses,
    totalPaths:         paths.length,
    completedPaths,
    totalAssessments:   assessments.length,
    totalCertificates:  certificates.length,
    overallProgressPct,
  };

  return { summary, courses, paths, assessments, certificates };
}
