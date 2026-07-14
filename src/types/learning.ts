// src/types/learning.ts
// Column names match the existing migration-defined schema exactly.

// ─────────────────────────────────────────────────────────────────────────────
// Section types
// ─────────────────────────────────────────────────────────────────────────────

export interface LearningCourse {
  enrollmentId:         string;
  courseId:             string;
  courseCode:           string;
  courseName:           string;
  thumbnail:            string;
  completionPercentage: number;
  status:               string;
  dueDate:              string;
  completedAt:          string | null;
}

export interface LearningPath {
  progressId:          string;
  learningPathId:      string;
  pathCode:            string;
  pathName:            string;
  difficultyLevel:     string;
  estimatedDuration:   number;
  progressPercentage:  number;
  status:              string;
  completedAt:         string | null;
}

export interface LearningAssessment {
  assignmentId:    string;
  assessmentId:    string;
  assessmentCode:  string;
  assessmentTitle: string;
  endDate:         string;
  status:          string;
}

export interface LearningCertificate {
  id:               string;
  certificateNo:    string;
  certificateTitle: string;
  issueDate:        string;
  certificateUrl:   string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

export interface LearningHomeSummary {
  totalCourses:        number;
  completedCourses:    number;
  inProgressCourses:   number;
  totalPaths:          number;
  completedPaths:      number;
  totalAssessments:    number;
  totalCertificates:   number;
  overallProgressPct:  number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root payload returned by loadLearningHome()
// ─────────────────────────────────────────────────────────────────────────────

export interface LearningHome {
  summary:      LearningHomeSummary;
  courses:      LearningCourse[];
  paths:        LearningPath[];
  assessments:  LearningAssessment[];
  certificates: LearningCertificate[];
}
