import type { Assessment } from "./assessment";
import type { QuestionOption } from "./question";
import type { QuestionType } from "./question";
import type { DifficultyLevel } from "./question";

// ── Attempt status ────────────────────────────────────────────────────────────

export type AttemptStatus =
  | "in_progress"
  | "submitted"
  | "timed_out"
  | "abandoned";

// ── Question palette state ────────────────────────────────────────────────────

export type QuestionState =
  | "not_visited"
  | "answered"
  | "skipped"
  | "current";

// ── assessment_attempts (snake_case = DB columns) ─────────────────────────────

export interface AssessmentAttempt {
  id: string;
  assessment_id: string;
  employee_id: string;
  attempt_no: number;
  started_at: string;
  submitted_at: string | null;
  score: number;
  percentage: number;
  passed: boolean;
  status: AttemptStatus;
  total_questions: number;
  answered_questions: number;
  unanswered_questions: number;
  skipped_questions: number;
  total_marks: number;
  obtained_marks: number;
  time_taken_seconds: number;
  browser_locked: boolean;
  tab_switch_count: number;
  auto_submitted: boolean;
  ip_address: string | null;
  device_info: string | null;
  completed_at: string | null;
}

// ── assessment_answers (snake_case = DB columns) ──────────────────────────────
// AssessmentPlayer.tsx reads: is_skipped, selected_option_ids, text_answer,
// time_taken_seconds — all fields must exist here.

export interface AssessmentAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option_ids: string[];
  answer_text: string;
  is_skipped: boolean;
  time_taken_seconds: number;
  marks_awarded: number;
  is_correct: boolean;
  answered_at: string;
}

// ── PlayerQuestion — self-contained, no extends ───────────────────────────────
// Contains every property accessed by AssessmentPlayer.tsx and
// assessmentPlayerService.ts. Does not extend Question so this file
// has no dependency on the question type hierarchy.

export interface PlayerQuestion {
  // Identity
  id: string;
  assessment_id: string;
  question_code: string;
  // Content
  question_text: string;
  question_type: QuestionType;
  // Scoring
  marks: number;
  negative_marks: number;
  // Display
  difficulty_level: DifficultyLevel;
  display_order: number;
  // Behaviour flags
  mandatory: boolean;
  randomize_options: boolean;
  active: boolean;
  // Media
  image_url: string;
  attachment_url: string;
  // Supplementary text
  hint: string;
  explanation: string;
  // Timer
  time_limit_seconds: number;
  // DB timestamps
  created_at: string;
  updated_at: string;
  // Enriched by service — not a DB column
  options: QuestionOption[];
}

// ── Full payload the service returns to the component ────────────────────────

export interface AssessmentPlayerPayload {
  assessment: Assessment;
  attempt: AssessmentAttempt;
  questions: PlayerQuestion[];
  existingAnswers: AssessmentAnswer[];
}

// ── In-memory answer tracked by the component (UI layer only) ────────────────

export interface LocalAnswer {
  questionId: string;
  selectedOptionIds: string[];
  textAnswer: string;
  isSkipped: boolean;
  timeTakenSeconds: number;
  state: QuestionState;
}

// ── Payload the component sends to saveQuestionAnswer ────────────────────────
// isSkipped IS included because AssessmentPlayer.tsx passes it at line 455.

export interface SaveAnswerPayload {
  attemptId: string;
  questionId: string;
  selectedOptionIds: string[];
  textAnswer: string;
  isSkipped: boolean;
  timeTakenSeconds: number;
}

// ── Payload the component sends to submitAssessment ──────────────────────────
// AssessmentPlayer.tsx calls submitAssessment({ attemptId, timeTakenSeconds, status })
// only — autoSubmitted and totalQuestions are NOT passed by the component.
// The service derives counts from the DB; the caller supplies only what it knows.

export interface SubmitRequest {
  attemptId: string;
  timeTakenSeconds: number;
  status: AttemptStatus;
  autoSubmitted?: boolean;
  totalQuestions?: number;
}

// ── Internal service → repository payload (built inside the service) ──────────

export interface SubmitAssessmentPayload {
  attemptId: string;
  timeTakenSeconds: number;
  status: AttemptStatus;
  autoSubmitted: boolean;
  answeredQuestions: number;
  unansweredQuestions: number;
  skippedQuestions: number;
}