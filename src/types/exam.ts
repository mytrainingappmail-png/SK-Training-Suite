// Exams - a paper-style test: the whole paper on one screen, one clock for
// the whole paper, results hidden until the admin releases them. Questions
// are the Live Quiz's own (see types/quiz.ts), so nothing about a question
// is redefined here.

export type ExamAdminStatus = "lobby" | "running" | "closing" | "finished";
export type ExamPlayerStatus = "lobby" | "running" | "finished";

export interface ExamSession {
  id: string;
  quiz_id: string;
  company_id: string;
  host_admin_id: string | null;
  pin: string;
  duration_seconds: number;
  opens_at: string;
  deadline_at: string;
  finished_at: string | null;
  results_released: boolean;
  results_released_at: string | null;
  folder_id?: string | null;
  created_at: string;
}

/** get_exam_session_admin - the admin's live view of one session. */
export interface ExamSessionAdmin {
  session_id: string;
  quiz_id: string;
  quiz_title: string;
  pin: string;
  duration_seconds: number;
  opens_at: string;
  deadline_at: string;
  finished_at: string | null;
  /** The database clock at the moment of this response. */
  server_now: string;
  results_released: boolean;
  status: ExamAdminStatus;
  total_questions: number;
  total_marks: number;
  passing_score_pct: number;
  joined: number;
  submitted: number;
}

export interface ExamParticipantAdmin {
  participant_id: string;
  display_name: string;
  joined_at: string;
  submitted_at: string | null;
  submit_reason: string | null;
  tab_switches: number;
  answered_count: number;
}

/** get_exam_live_admin - one candidate's running numbers, for the host's own screen. */
export interface ExamLiveRow {
  participant_id: string;
  answered_count: number;
  correct_count: number;
  wrong_count: number;
  written_count: number;
  auto_marks: number;
  possible_marks: number;
  stopped_at: string | null;
  stop_reason: string | null;
}

export interface ExamLiveQuestion {
  question_id: string;
  question_order: number;
  question_text: string;
  qtype: string;
  attempted: number;
  correct: number;
}

export interface ExamResultRow {
  participant_id: string;
  display_name: string;
  submitted_at: string | null;
  submit_reason: string | null;
  tab_switches: number;
  auto_marks: number;
  manual_marks: number;
  pending_written: number;
  possible_marks: number;
}

export interface ExamDetailRow {
  answer_id: string | null;
  question_id: string;
  question_order: number;
  question_text: string;
  type: "mcq" | "truefalse" | "hotspot" | "written";
  marks: number;
  explanation: string;
  image_url: string | null;
  selected_option_text: string | null;
  correct_option_text: string | null;
  text_answer: string | null;
  image_paths: string[];
  click_x: number | null;
  click_y: number | null;
  hotspot_taps: HotspotTap[];
  /** Only populated here for the admin's own review screen — never sent to a trainee. */
  hotspot_zones: unknown[] | null;
  answered: boolean;
  flagged: boolean;
  is_correct: boolean | null;
  marks_awarded: number | null;
  grader_comment: string | null;
}

export interface ExamQuestionStat {
  question_id: string;
  question_order: number;
  question_text: string;
  type: string;
  marks: number;
  attempted: number;
  correct: number;
}

// ── Employee side ───────────────────────────────────────────────────────

export interface ExamState {
  participant_id: string;
  display_name: string;
  quiz_title: string;
  description: string;
  duration_seconds: number;
  opens_at: string;
  deadline_at: string;
  server_now: string;
  status: ExamPlayerStatus;
  submitted_at: string | null;
  results_released: boolean;
  total_questions: number;
  passing_score_pct: number;
}

export interface HotspotTap {
  x: number;
  y: number;
  /** Known once the tap is confirmed and reveal feedback is on — never sent back for a reveal-off save. */
  correct?: boolean;
  /** The tapped zone's own admin-set label, only present when correct is true and a label exists. */
  label?: string | null;
}

/** What is saved for one question - mirrored locally so an offline phone loses nothing. */
export interface ExamAnswerDraft {
  selected_option_id: string | null;
  click_x: number | null;
  click_y: number | null;
  /** Hotspot only — one confirmed tap per identified spot, up to the question's zone count. */
  hotspot_taps: HotspotTap[];
  text: string;
  image_paths: string[];
  flagged: boolean;
  /** mcq/truefalse only — set once the answer is saved and graded, for instant reveal. Never the running score. */
  selected_is_correct: boolean | null;
}

export interface ExamPaperQuestion {
  position: number;
  question_id: string;
  question_text: string;
  type: "mcq" | "truefalse" | "hotspot" | "written";
  marks: number;
  image_url: string | null;
  options: { option_id: string; option_text: string }[];
  saved: ExamAnswerDraft;
  /** Hotspot only — how many points to identify (zone count). Null for a legacy single-target question, which still expects exactly one tap. */
  hotspotZoneCount: number | null;
}

export interface MyExamResultRow {
  question_order: number;
  question_text: string;
  type: string;
  marks: number;
  my_answer_text: string | null;
  my_selected_option_text: string | null;
  correct_option_text: string | null;
  is_correct: boolean | null;
  marks_awarded: number | null;
  grader_comment: string | null;
  answered: boolean;
}
