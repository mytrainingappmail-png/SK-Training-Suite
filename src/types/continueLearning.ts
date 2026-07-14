// src/types/continueLearning.ts
// Continue Learning data types for the employee-facing "resume where you
// left off" widget. All field names are camelCase; underlying DB columns
// come only from enrollments, courses, lessons and learning_resources.

// ── Resume resource (first resource of the resume lesson, if any) ────────────

export interface ContinueLearningResource {
  id:            string;
  resourceTitle: string;
  fileUrl:       string;
  resourceType:  string;
}

// ── Resume lesson ──────────────────────────────────────────────────────────────

export interface ContinueLearningLesson {
  id:              string;
  lessonTitle:     string;
  durationMinutes: number;
  resource:        ContinueLearningResource | null;
}

// ── Full continue-learning card payload ───────────────────────────────────────

export interface ContinueLearningItem {
  enrollmentId:              string;
  courseId:                  string;
  courseName:                string;
  courseCode:                string;
  courseThumbnail:           string;
  completionPercentage:      number; // 0–100
  lastAccessedDate:          string | null;
  totalLessons:              number;
  remainingLessons:          number;
  estimatedMinutesRemaining: number;
  resumeLesson:              ContinueLearningLesson | null;
}
