export type QuestionType =
  | "mcq"
  | "multiple_select"
  | "true_false"
  | "fill_blank"
  | "short_answer"
  | "long_answer";

export type DifficultyLevel =
  | "easy"
  | "medium"
  | "hard";

// ── question_options row ──────────────────────────────────────────────────────

export interface QuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  display_order: number;
  created_at: string;
}

export type QuestionOptionForm = Omit<
  QuestionOption,
  "id" | "question_id" | "created_at"
>;

// ── question_bank row ─────────────────────────────────────────────────────────

export interface Question {

  id: string;

  assessment_id: string;

  question_code: string;

  question_text: string;

  question_type: QuestionType;

  difficulty_level: DifficultyLevel;

  marks: number;

  negative_marks: number;

  time_limit_seconds: number;

  explanation: string;

  hint: string;

  display_order: number;

  mandatory: boolean;

  randomize_options: boolean;

  attachment_url: string;

  image_url: string;

  active: boolean;

  created_at: string;

  updated_at: string;

}

export type QuestionForm = Omit<
  Question,
  "id" | "created_at" | "updated_at"
>;

// ── Form type that includes editable options ──────────────────────────────────

export interface QuestionWithOptionsForm extends QuestionForm {
  options: QuestionOptionForm[];
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const defaultQuestionForm: QuestionWithOptionsForm = {
  assessment_id:    "",
  question_code:    "",
  question_text:    "",
  question_type:    "mcq",
  difficulty_level: "medium",
  marks:            1,
  negative_marks:   0,
  time_limit_seconds: 0,
  explanation:      "",
  hint:             "",
  display_order:    1,
  mandatory:        false,
  randomize_options: false,
  attachment_url:   "",
  image_url:        "",
  active:           true,
  options: [
    { option_text: "", is_correct: false, display_order: 1 },
    { option_text: "", is_correct: false, display_order: 2 },
  ],
};

// ── True/False auto-options ───────────────────────────────────────────────────

export const TRUE_FALSE_OPTIONS: QuestionOptionForm[] = [
  { option_text: "True",  is_correct: true,  display_order: 1 },
  { option_text: "False", is_correct: false, display_order: 2 },
];
