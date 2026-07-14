// src/types/myProgress.ts
// My Progress data types for the employee-facing progress overview.
// All field names are camelCase; underlying DB columns match the
// enrollments, assessment_attempts and learning_path_progress tables.

// ── Overall summary card ──────────────────────────────────────────────────────

export interface MyProgressSummary {
  totalCourses:            number;
  coursesCompleted:        number;
  coursesInProgress:       number;
  overallCourseProgressPct: number; // 0–100, average of course completion_percentage
  totalLearningPaths:      number;
  learningPathsCompleted:  number;
  totalAssessmentAttempts: number;
  assessmentsPassed:       number;
  averageAssessmentScore:  number; // 0–100
  lastActivityDate:        string | null;
}

// ── Per-course progress row (enrollments, enrollment_type = COURSE) ───────────

export interface MyCourseProgressItem {
  enrollmentId:          string;
  courseId:              string;
  courseName:            string;
  courseCode:            string;
  status:                string; // EnrollmentStatus value
  completionPercentage:  number; // 0–100
  lastActivityDate:      string | null;
}

// ── Per-path progress row (learning_path_progress) ────────────────────────────

export interface MyLearningPathProgressItem {
  progressId:           string;
  learningPathId:       string;
  pathName:             string;
  pathCode:             string;
  status:               string; // ProgressStatus value
  progressPercentage:   number; // 0–100
  completedCourses:     number;
  totalCourses:         number;
  lastActivityDate:     string | null;
}

// ── Per-attempt assessment row (assessment_attempts) ──────────────────────────

export interface MyAssessmentProgressItem {
  attemptId:       string;
  assessmentId:    string;
  assessmentTitle: string;
  assessmentCode:  string;
  status:          string; // AttemptStatus value
  percentage:      number; // 0–100
  passed:          boolean;
  attemptDate:     string | null;
}

// ── Full payload returned by myProgressService.loadMyProgress() ──────────────

export interface MyProgress {
  summary:       MyProgressSummary;
  courses:       MyCourseProgressItem[];
  learningPaths: MyLearningPathProgressItem[];
  assessments:   MyAssessmentProgressItem[];
}
