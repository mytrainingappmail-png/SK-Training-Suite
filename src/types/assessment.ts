export type AssessmentType =
  | "quiz"
  | "test"
  | "exam"
  | "survey"
  | "practice";

export interface Assessment {

  id: string;

  lesson_id: string;

  assessment_code: string;

  assessment_title: string;

  description: string;

  assessment_type: AssessmentType;

  passing_percentage: number;

  maximum_attempts: number;

  duration_minutes: number;

  question_timer_enabled: boolean;

  question_time_seconds: number;

  shuffle_questions: boolean;

  shuffle_options: boolean;

  negative_marking: boolean;

  negative_marks: number;

  show_result_immediately: boolean;

  show_correct_answers: boolean;

  auto_submit: boolean;

  certificate_enabled: boolean;

  active: boolean;

  created_at: string;

  updated_at: string;

}

export type AssessmentForm = Omit<
  Assessment,
  "id" | "created_at" | "updated_at"
>;

export const defaultAssessmentForm: AssessmentForm = {
  lesson_id:               "",
  assessment_code:         "",
  assessment_title:        "",
  description:             "",
  assessment_type:         "quiz",
  passing_percentage:      70,
  maximum_attempts:        3,
  duration_minutes:        30,
  question_timer_enabled:  false,
  question_time_seconds:   60,
  shuffle_questions:       false,
  shuffle_options:         false,
  negative_marking:        false,
  negative_marks:          0,
  show_result_immediately: true,
  show_correct_answers:    true,
  auto_submit:             true,
  certificate_enabled:     false,
  active:                  true,
};
