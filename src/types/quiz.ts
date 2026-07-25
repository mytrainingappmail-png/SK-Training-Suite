// Live Quiz module — Phase 1 types.
// Deliberately separate from src/types/app.ts (User/Employee) — quiz admins
// and quiz participants are not LMS employees.

export type QuizAdminRole = "super_admin" | "admin";
export type QuizAdminStatus = "active" | "disabled";

export interface QuizAdmin {
  id: string;
  company_id: string;
  auth_user_id: string | null;
  username: string;
  display_name: string;
  role: QuizAdminRole;
  status: QuizAdminStatus;
  created_at: string;
}

export interface QuizCategory {
  id: string;
  company_id: string;
  name: string;
  display_order: number;
}

export type QuizDifficulty = "Easy" | "Medium" | "Hard";
export type QuizStatus = "draft" | "published";

export interface Quiz {
  id: string;
  company_id: string;
  created_by: string | null;
  title: string;
  description: string;
  category_id: string | null;
  difficulty: QuizDifficulty;
  default_timer_seconds: number;
  passing_score_pct: number;
  improve_threshold_pct: number;
  shuffle_options: boolean;
  status: QuizStatus;
  created_at: string;
  updated_at: string;
}

export type QuizQuestionType = "mcq" | "truefalse";

export interface QuizQuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  display_order: number;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  type: QuizQuestionType;
  timer_seconds: number | null;
  marks: number;
  explanation: string;
  display_order: number;
  options: QuizQuestionOption[];
}

/** A quiz with its questions/options — the shape the builder edits as one unit. */
export interface QuizWithQuestions extends Quiz {
  questions: QuizQuestion[];
}

export interface QuizRosterEntry {
  id: string;
  company_id: string;
  employee_code: string;
  name: string;
  phone: string;
  active: boolean;
}

export type QuizSessionPhase = "lobby" | "question" | "paused" | "ended";
export type QuizJoinMode = "open" | "strict";

export interface QuizSession {
  id: string;
  quiz_id: string;
  company_id: string;
  host_admin_id: string | null;
  pin: string;
  phase: QuizSessionPhase;
  current_question_index: number;
  join_mode: QuizJoinMode;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface QuizParticipant {
  id: string;
  session_id: string;
  auth_user_id: string;
  display_name: string;
  score: number;
  correct_count: number;
  joined_at: string;
}

export interface QuizAnswer {
  id: string;
  session_id: string;
  participant_id: string;
  question_id: string;
  selected_option_id: string | null;
  is_correct: boolean;
  response_time_ms: number;
  answered_at: string;
}

export type QuizGrade = "PASS" | "NEED_IMPROVEMENT" | "FAIL";

export interface QuizSessionResultRow {
  session_id: string;
  quiz_id: string;
  company_id: string;
  quiz_title: string;
  passing_score_pct: number;
  improve_threshold_pct: number;
  started_at: string | null;
  ended_at: string | null;
  total_questions: number;
  participant_id: string;
  display_name: string;
  score: number;
  correct_count: number;
  percent_correct: number;
  grade: QuizGrade;
}

/** Public, correctness-free payload returned by get_current_quiz_question RPC. */
export interface PublicQuizQuestionOption {
  option_id: string;
  option_text: string;
  option_order: number;
}

export interface PublicQuizQuestion {
  question_id: string;
  question_text: string;
  type: QuizQuestionType;
  timer_seconds: number;
  question_index: number;
  total_questions: number;
  options: PublicQuizQuestionOption[];
}

export interface SubmitAnswerResult {
  is_correct: boolean;
  correct_option_id: string | null;
  points_awarded: number;
}
