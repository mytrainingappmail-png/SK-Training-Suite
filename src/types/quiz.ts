// Live Quiz module — Phase 1 types.
// Deliberately separate from src/types/app.ts (User/Employee) — quiz admins
// and quiz participants are not LMS employees.

export type QuizAdminRole = "super_admin" | "admin";
export type QuizAdminStatus = "active" | "disabled";
/** Only meaningful for role "admin" — a super_admin always has full edit rights regardless of this value. "admin" + view_only sees everything, changes nothing; "admin" + edit has full content/session control but can't manage other users. */
export type QuizPermissionLevel = "view_only" | "edit";

export interface QuizAdmin {
  id: string;
  company_id: string;
  auth_user_id: string | null;
  username: string;
  display_name: string;
  role: QuizAdminRole;
  permission_level: QuizPermissionLevel;
  status: QuizAdminStatus;
  contact_email: string | null;
  contact_mobile: string | null;
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
  shuffle_questions: boolean;
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
  question_order: string[] | null;
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
  total_response_time_ms: number;
  tab_switch_count: number;
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
  total_response_time_ms: number;
  rank: number;
  percent_correct: number;
  grade: QuizGrade;
}

/** Who certificates go to for a quiz, admin-configured — a competition, not a participation trophy. */
export type CertEligibility = "all_pass" | "top1" | "top3";

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
  explanation: string | null;
}

export interface OptionColor {
  box: string;
  font: string;
}

export type CertTemplate = "classic_gold" | "royal_blue" | "modern_purple" | "minimal_white" | "dark_elegant";
export type ChampMusic = "builtin" | "custom" | "off";

export interface QuizSettings {
  company_id: string;
  brand_name: string | null;
  brand_tagline: string | null;
  brand_logo_url: string | null;
  login_background_url: string | null;
  login_banner_url: string | null;
  favicon_url: string | null;
  footer_text: string | null;
  option_font_size: number;
  option_colors: OptionColor[];
  sound_enabled: boolean;
  default_join_mode: QuizJoinMode;
  cert_template: CertTemplate;
  cert_company_name: string | null;
  cert_logo_url: string | null;
  cert_title: string;
  cert_achievement_line: string;
  cert_signatory1_name: string | null;
  cert_signatory1_title: string | null;
  cert_signatory1_image_url: string | null;
  cert_signatory2_name: string | null;
  cert_signatory2_title: string | null;
  cert_signatory2_image_url: string | null;
  champ_music: ChampMusic;
  champ_music_url: string | null;
  champ_music_volume: number;
  result_pass_title: string | null;
  result_pass_message: string | null;
  result_improve_title: string | null;
  result_improve_message: string | null;
  result_fail_title: string | null;
  result_fail_message: string | null;
  cert_eligibility: CertEligibility;
  updated_at: string;
}

/** Correctness-free subset a participant's browser can see, via get_quiz_player_settings RPC. */
export interface QuizPlayerSettings {
  option_font_size: number;
  option_colors: OptionColor[];
  sound_enabled: boolean;
  brand_name: string | null;
  brand_logo_url: string | null;
  favicon_url: string | null;
  result_pass_title: string | null;
  result_pass_message: string | null;
  result_improve_title: string | null;
  result_improve_message: string | null;
  result_fail_title: string | null;
  result_fail_message: string | null;
  cert_eligibility: CertEligibility;
}

/** The calling participant's own outcome, via get_my_result RPC. */
export interface MyQuizResult {
  correct_count: number;
  total_questions: number;
  percent_correct: number;
  grade: QuizGrade;
}

/** Pre-auth branding for the quiz admin login page, via get_quiz_public_branding RPC. */
export interface QuizPublicBranding {
  company_name: string | null;
  brand_name: string | null;
  brand_tagline: string | null;
  brand_logo_url: string | null;
  login_background_url: string | null;
  login_banner_url: string | null;
  favicon_url: string | null;
  footer_text: string | null;
}

export interface QuizCertificate {
  id: string;
  cert_number: string;
  candidate_name: string;
  quiz_title: string;
  score_line: string;
  template: CertTemplate;
  issued_at: string;
  company_name: string;
  cert_title: string;
  achievement_line: string;
  signatory1_name: string | null;
  signatory1_title: string | null;
  signatory1_image_url: string | null;
  signatory2_name: string | null;
  signatory2_title: string | null;
  signatory2_image_url: string | null;
}

export interface AnswerDistributionOption {
  option_id: string;
  option_text: string;
  is_correct: boolean;
  count: number;
}

export interface AnswerDistributionQuestion {
  question_id: string;
  question_text: string;
  display_order: number;
  options: AnswerDistributionOption[];
  totalAnswered: number;
}

export interface DashboardFilters {
  fromIso?: string;
  toIso?: string;
  categoryId?: string | null;
  quizId?: string | null;
  trainerId?: string | null;
  employeeName?: string | null;
}

export interface DashboardTrendPoint {
  label: string;
  value: number;
}

export interface DashboardKpis {
  totalQuizzes: number;
  publishedQuizzes: number;
  draftQuizzes: number;
  liveSessionsNow: number;
  completedSessions: number;
  todaysParticipants: number;
  totalParticipants: number;
  questionBankSize: number;
  averageScorePct: number;
  passPct: number;
  failPct: number;
  improvePct: number;
  completionPct: number;
  avgResponseTimeMs: number;
  certificatesGenerated: number;
}

export interface DashboardFilterOptions {
  categories: { id: string; name: string }[];
  quizzes: { id: string; title: string }[];
  trainers: { id: string; name: string }[];
  employees: string[];
}

export interface QuizPerformanceRow {
  quizId: string;
  title: string;
  categoryName: string | null;
  difficulty: QuizDifficulty;
  status: QuizStatus;
  sessionsCount: number;
  participantsCount: number;
  averageScorePct: number;
  passPct: number;
}

export interface DashboardRecentQuiz {
  id: string;
  title: string;
  status: QuizStatus;
  updatedAt: string;
}

export interface DashboardRecentSession {
  id: string;
  quizTitle: string;
  phase: QuizSessionPhase;
  participantCount: number;
  createdAt: string;
}

export interface DashboardRecentResult {
  sessionId: string;
  participantId: string;
  quizTitle: string;
  displayName: string;
  percent: number;
  grade: QuizGrade;
  endedAt: string;
}

export interface DashboardRecentCertificate {
  id: string;
  candidateName: string;
  quizTitle: string;
  issuedAt: string;
}

export interface DashboardSnapshot {
  kpis: DashboardKpis;
  participationTrend: DashboardTrendPoint[];
  scoreTrend: DashboardTrendPoint[];
  certificateTrend: DashboardTrendPoint[];
  passFail: { label: string; value: number; color: string }[];
  categoryPerformance: DashboardTrendPoint[];
  difficultyPerformance: DashboardTrendPoint[];
  trainerPerformance: DashboardTrendPoint[];
  topQuizzes: DashboardTrendPoint[];
  bottomQuizzes: DashboardTrendPoint[];
  topParticipants: DashboardTrendPoint[];
  quizPerformanceTable: QuizPerformanceRow[];
  recentQuizActivity: DashboardRecentQuiz[];
  recentSessions: DashboardRecentSession[];
  recentResults: DashboardRecentResult[];
  recentCertificates: DashboardRecentCertificate[];
}

export interface ChampionRow {
  participant_id: string;
  display_name: string;
  best_percent: number;
  sessions_played: number;
}

/** One row per option, returned by get_my_answer_review — group client-side by question_index. */
export interface AnswerReviewOptionRow {
  question_index: number;
  question_text: string;
  explanation: string;
  option_id: string;
  option_text: string;
  is_correct: boolean;
  was_chosen: boolean;
}

export interface AnswerReviewQuestion {
  question_index: number;
  question_text: string;
  explanation: string;
  options: { option_id: string; option_text: string; is_correct: boolean; was_chosen: boolean }[];
}
