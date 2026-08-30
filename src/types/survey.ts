// Survey — a Live Quiz admin section for opinion-gathering, not
// knowledge-testing: no score, no pass/fail, no result shown back to
// the respondent. Deliberately its own type file, not quiz.ts — the
// data shapes and the whole taking flow are unrelated to a quiz.

export type SurveyStatus = "draft" | "published";
export type SurveyQuestionType = "single_choice" | "multi_choice" | "scale" | "open_text";
export type SurveySentiment = "positive" | "neutral" | "negative";

export interface Survey {
  id: string;
  company_id: string;
  created_by: string | null;
  title: string;
  description: string;
  access_code: string;
  status: SurveyStatus;
  /** After this, the survey stops accepting responses and the public link shows "not available" — null means it never closes on its own. */
  closes_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SurveySettings {
  company_id: string;
  option_font_size: number;
  option_colors: { box: string; font: string }[];
  updated_at: string;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  question_text: string;
  type: SurveyQuestionType;
  required: boolean;
  scale_min: number | null;
  scale_max: number | null;
  display_order: number;
}

export interface SurveyQuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  /** Only meaningful for single_choice/multi_choice — drives the overall positivity score, same idea as calling_app_dispositions' outcome_type. */
  sentiment: SurveySentiment;
  display_order: number;
}

/** A question with its options attached — the shape the builder edits as one unit. */
export interface SurveyQuestionWithOptions extends SurveyQuestion {
  options: SurveyQuestionOption[];
}

export interface SurveyWithQuestions extends Survey {
  questions: SurveyQuestionWithOptions[];
}

// ── Public taking flow ──────────────────────────────────────────────
// Flattened row shape returned by get_survey_by_code — one row per
// (question, option) pair, grouped client-side into
// PublicSurveyQuestion[].

export interface PublicSurveyRow {
  survey_id: string;
  title: string;
  description: string;
  question_id: string;
  question_text: string;
  type: SurveyQuestionType;
  required: boolean;
  scale_min: number | null;
  scale_max: number | null;
  question_order: number;
  option_id: string | null;
  option_text: string | null;
  option_order: number | null;
}

export interface PublicSurveyQuestion {
  question_id: string;
  question_text: string;
  type: SurveyQuestionType;
  required: boolean;
  scale_min: number | null;
  scale_max: number | null;
  options: { option_id: string; option_text: string }[];
}

export interface PublicSurvey {
  survey_id: string;
  title: string;
  description: string;
  questions: PublicSurveyQuestion[];
}

/** One entry per question the respondent answered — only the field(s) relevant to that question's type need to be set. */
export interface SurveyAnswerInput {
  question_id: string;
  selected_option_ids?: string[];
  scale_value?: number;
  text_value?: string;
}

// ── Admin results/aggregation ───────────────────────────────────────
// Computed client-side from the raw (identity-free) answer rows — see
// buildSurveyResults in the repository.

export interface SurveyChoiceResult {
  option_id: string;
  option_text: string;
  sentiment: SurveySentiment;
  count: number;
}

export interface SurveyQuestionResult {
  question: SurveyQuestion;
  totalAnswers: number;
  /** Populated for single_choice/multi_choice. */
  choiceBreakdown?: SurveyChoiceResult[];
  /** Populated for scale. */
  averageScale?: number;
  scaleDistribution?: { value: number; count: number }[];
  /** Populated for open_text — every free-text answer, newest first. */
  textAnswers?: string[];
  /** 0-100 — how "positive" this question's answers were, or undefined for open_text (nothing numeric to score). Scale: normalized min→max. Choice: share of answers on a "positive" option. */
  positivityScore?: number;
}

export interface SurveyResults {
  totalResponses: number;
  /** From get_company_active_employee_count — null if it couldn't be resolved. */
  eligibleCount: number | null;
  questions: SurveyQuestionResult[];
  /** Mean of every question's positivityScore that has one — undefined if no question contributed a score. */
  overallPositivityScore?: number;
}
