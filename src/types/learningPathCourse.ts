export interface LearningPathCourse {

  id: string;

  learning_path_id: string;

  course_id: string;

  sequence_no: number;

  mandatory: boolean;

  unlock_previous: boolean;

  estimated_duration: number;

  active: boolean;

  created_at: string;

  updated_at: string;

}

export type LearningPathCourseForm = Omit<
  LearningPathCourse,
  "id" | "created_at" | "updated_at"
>;

export const defaultLearningPathCourseForm: LearningPathCourseForm = {
  learning_path_id:   "",
  course_id:          "",
  sequence_no:        1,
  mandatory:          false,
  unlock_previous:    false,
  estimated_duration: 0,
  active:             true,
};
