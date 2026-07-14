// src/types/dashboard.ts
// Dashboard data types for the employee-facing My Dashboard.
// All field names match the existing database schema exactly.

// ── Summary card counts ───────────────────────────────────────────────────────

export interface DashboardSummary {
  assignedCourses:       number;
  completedCourses:      number;
  pendingCourses:        number;
  learningPaths:         number;
  certificatesEarned:    number;
  upcomingAssessments:   number;
  overallProgressPct:    number; // 0–100
}

// ── Recent learning items (in-progress enrollments) ───────────────────────────

export interface RecentCourse {
  enrollmentId:          string;
  courseId:              string;
  courseName:            string;
  courseCode:            string;
  completionPercentage:  number; // 0–100
  status:                string;  // EnrollmentStatus value
  dueDate:               string;
}

// ── Upcoming assessment assignments ──────────────────────────────────────────

export interface UpcomingAssessment {
  assignmentId:    string;
  assessmentId:    string;
  assessmentTitle: string;
  assessmentCode:  string;
  endDate:         string;
  status:          string;
}

// ── Full dashboard payload returned by dashboardService.loadDashboard() ───────

export interface EmployeeDashboard {
  summary:              DashboardSummary;
  recentCourses:        RecentCourse[];
  upcomingAssessments:  UpcomingAssessment[];
}
