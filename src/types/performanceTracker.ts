// src/types/performanceTracker.ts
//
// Performance Tracker — a daily sales-activity commitment & scoring
// tracker. See supabase/migrations/20260914120000_performance_tracker_module.sql
// for the schema and the scoring trigger this mirrors.

export interface PtTeam {
  id: string;
  company_id: string;
  name: string;
  team_leader_employee_id: string | null;
  is_active: boolean;
  created_at: string;
}

export type PtLeaderboardFormula = 'achievement' | 'score' | 'bookings' | 'composite';

export interface PtSettings {
  company_id: string;
  min_f2f: number;
  min_sv: number;
  min_revisit: number;
  min_calls: number;
  min_conn: number;
  min_talk: number;
  score_f2f: number;
  score_sv: number;
  score_revisit: number;
  score_booking: number;
  score_conn: number;
  score_talk_per5: number;
  // The admin's "delete" for a core metric they don't use — a disabled
  // metric drops out of Score, Achievement %, and the min-criteria gate
  // for any NEW report (historical data is untouched). Bookings has no
  // toggle — it always counts.
  f2f_enabled: boolean;
  sv_enabled: boolean;
  revisit_enabled: boolean;
  calls_enabled: boolean;
  conn_enabled: boolean;
  talk_enabled: boolean;
  leaderboard_formula: PtLeaderboardFormula;
  morning_reminder_title: string;
  morning_reminder_message: string;
  evening_reminder_title: string;
  evening_reminder_message: string;
  // Client-triggered auto-reminder — checked once whenever anyone opens
  // Performance Tracker (no server cron exists in this app), so it only
  // actually fires if someone opens the tracker after the cutoff time on
  // a given day. See pt_auto_reminder_runs for the once-per-day dedupe.
  auto_reminder_enabled: boolean;
  auto_reminder_morning_cutoff: string;
  auto_reminder_evening_cutoff: string;
  updated_at: string;
}

export interface PtCustomField {
  id: string;
  company_id: string;
  field_key: string;
  label: string;
  applies_morning: boolean;
  applies_evening: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  // The admin's "add" for a genuinely new SCORED metric — opts this field
  // into the same Score/min-criteria machinery the 6 core metrics use,
  // instead of sitting there as purely tracked, inert data.
  counts_toward_score: boolean;
  score_weight: number;
  min_threshold: number | null;
}

export interface PtCommitment {
  id: string;
  company_id: string;
  employee_id: string;
  work_date: string;
  f2f_planned: number;
  sv_planned: number;
  revisit_planned: number;
  calls_planned: number;
  conn_target: number;
  talk_target: number;
  remarks: string | null;
  custom_values: Record<string, number>;
  submitted_at: string;
  created_at: string;
}

export type PtCommitmentForm = Omit<PtCommitment, 'id' | 'submitted_at' | 'created_at'>;

export interface PtReport {
  id: string;
  company_id: string;
  employee_id: string;
  work_date: string;
  f2f_done: number;
  sv_done: number;
  revisit_done: number;
  calls_done: number;
  conn_done: number;
  talk_done: number;
  leads: number;
  meetings_fixed: number;
  bookings: number;
  remarks: string | null;
  custom_values: Record<string, number>;
  // Computed server-side by the pt_reports_compute_score trigger.
  score: number | null;
  achievement_pct: number | null;
  min_criteria_met: boolean | null;
  // A manager's written feedback on this specific day's report — visible
  // to the employee once left, closing the loop instead of leaving this a
  // one-way data-collection form.
  manager_comment: string | null;
  manager_comment_by: string | null;
  manager_comment_at: string | null;
  submitted_at: string;
  created_at: string;
}

export type PtReportForm = Omit<PtReport, 'id' | 'submitted_at' | 'created_at' | 'score' | 'achievement_pct' | 'min_criteria_met' | 'manager_comment' | 'manager_comment_by' | 'manager_comment_at'>;

export type PtChampionMetricKey = 'f2f' | 'sv' | 'bookings' | 'achievement' | 'calls' | 'talk';

export interface PtChampionCategory {
  id: string;
  company_id: string;
  metric_key: PtChampionMetricKey;
  label: string;
  is_active: boolean;
  sort_order: number;
}
