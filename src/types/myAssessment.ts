// src/types/myAssessment.ts

export type MyAssessmentStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed';

export interface MyAssessment {
  assignmentId:    string;
  assessmentId:    string;
  assessmentTitle: string;
  assessmentCode:  string;
  assessmentType:  string;
  durationMinutes: number;
  totalMarks:      number;
  passingMarks:    number;
  dueDate:         string;
  status:          MyAssessmentStatus;
  attemptCount:    number;
  maximumAttempts: number;
  lastAttemptDate: string | null;
  resultId:        string | null;
  percentage:      number | null;
  passed:          boolean | null;
}
