export type ProgressStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface LearningPathProgress {

  id: string;

  enrollment_id: string;

  learning_path_id: string;

  employee_id: string;

  current_course_id: string;

  completed_courses: number;

  total_courses: number;

  progress_percentage: number;

  started_at: string | null;

  last_accessed_at: string | null;

  completed_at: string | null;

  status: ProgressStatus;

  certificate_generated: boolean;

  active: boolean;

  remarks: string;

  created_at: string;

  updated_at: string;

}

export type LearningPathProgressForm = Omit<
  LearningPathProgress,
  "id" | "created_at" | "updated_at"
>;

export const defaultProgressForm: LearningPathProgressForm = {
  enrollment_id:         "",
  learning_path_id:      "",
  employee_id:           "",
  current_course_id:     "",
  completed_courses:     0,
  total_courses:         0,
  progress_percentage:   0,
  started_at:            null,
  last_accessed_at:      null,
  completed_at:          null,
  status:                "not_started",
  certificate_generated: false,
  active:                true,
  remarks:               "",
};
