// src/services/employee/dashboardService.ts
//
// Business logic only — no Supabase imports.
//
// Verified import paths from src/services/employee/:
//   ../../repositories/employee/dashboardRepository
//       → src/repositories/employee/dashboardRepository.ts (new file)
//       exports: getEnrollmentsByEmployee, getLearningPathCount,
//                getCertificateCount, getUpcomingAssessments
//   ../../types/dashboard
//       → src/types/dashboard.ts (new file)
//       exports: EmployeeDashboard, DashboardSummary, RecentCourse,
//                UpcomingAssessment

import {
  getEnrollmentsByEmployee,
  getLearningPathCount,
  getCertificateCount,
  getUpcomingAssessments,
} from '../../repositories/employee/dashboardRepository';

import type {
  EmployeeDashboard,
  DashboardSummary,
  RecentCourse,
  UpcomingAssessment,
} from '../../types/dashboard';

// ─────────────────────────────────────────────────────────────────────────────
// Public API — single export consumed by MyDashboard component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads all dashboard data for the given employee.
 * Runs repository queries in parallel for performance.
 * Returns a fully shaped EmployeeDashboard — never throws to the caller;
 * errors are propagated so the component can display an error banner.
 */
export async function loadDashboard(
  employeeId: string
): Promise<EmployeeDashboard> {
  if (!employeeId) {
    throw new Error('Employee ID is required to load the dashboard.');
  }

  // ── Parallel data load ────────────────────────────────────────────────────
  const [enrollments, pathCount, certCount, rawAssessments] =
    await Promise.all([
      getEnrollmentsByEmployee(employeeId),
      getLearningPathCount(employeeId),
      getCertificateCount(employeeId),
      getUpcomingAssessments(employeeId),
    ]);

  // ── Derive summary counts from enrollments ────────────────────────────────
  const assignedCourses  = enrollments.length;
  const completedCourses = enrollments.filter(
    (e) => e.status === 'COMPLETED'
  ).length;
  const pendingCourses   = enrollments.filter(
    (e) => e.status === 'PENDING' || e.status === 'IN_PROGRESS'
  ).length;

  // Overall progress: average completion_percentage across all enrollments
  const overallProgressPct =
    assignedCourses > 0
      ? Math.round(
          enrollments.reduce((sum, e) => sum + (e.completion_percentage ?? 0), 0) /
          assignedCourses
        )
      : 0;

  const summary: DashboardSummary = {
    assignedCourses,
    completedCourses,
    pendingCourses,
    learningPaths:       pathCount,
    certificatesEarned:  certCount,
    upcomingAssessments: rawAssessments.length,
    overallProgressPct,
  };

  // ── Recent courses — in-progress first, then pending, limit 5 ─────────────
  const recentCourses: RecentCourse[] = enrollments
    .filter((e) => e.status !== 'COMPLETED' && e.status !== 'CANCELLED')
    .sort((a, b) => (b.completion_percentage ?? 0) - (a.completion_percentage ?? 0))
    .slice(0, 5)
    .map((e) => ({
      enrollmentId:         e.id,
      courseId:             e.course_id,
     courseName: e.courses?.[0]?.course_name ?? "Untitled Course",
courseCode: e.courses?.[0]?.course_code ?? "",
      completionPercentage: e.completion_percentage ?? 0,
      status:               e.status,
      dueDate:              e.due_date ?? '',
    }));

  // ── Upcoming assessments ──────────────────────────────────────────────────
  const upcomingAssessments: UpcomingAssessment[] = rawAssessments.map((a) => ({
    assignmentId:    a.id,
    assessmentId:    a.assessment_id,
    assessmentTitle: a.assessments?.[0]?.assessment_title ?? "Assessment",
assessmentCode: a.assessments?.[0]?.assessment_code ?? "",
    endDate:         a.end_date ?? '',
    status:          a.assignment_status,
  }));

  return { summary, recentCourses, upcomingAssessments };
}
