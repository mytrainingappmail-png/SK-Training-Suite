// src/repositories/performanceTracker/performanceTrackerRepository.ts
//
// Repository layer — Supabase ONLY.

import { supabase } from '../../lib/supabase';
import type {
  PtTeam, PtSettings, PtCustomField, PtCommitment, PtCommitmentForm,
  PtReport, PtReportForm, PtChampionCategory,
} from '../../types/performanceTracker';

export const todayStr = () => new Date().toISOString().slice(0, 10);

// ── Teams ────────────────────────────────────────────────────────────────

export async function getTeams(companyId: string): Promise<PtTeam[]> {
  const { data, error } = await supabase.from('pt_teams').select('*').eq('company_id', companyId).order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createTeam(companyId: string, name: string, teamLeaderEmployeeId: string | null): Promise<PtTeam> {
  const { data, error } = await supabase
    .from('pt_teams')
    .insert({ company_id: companyId, name, team_leader_employee_id: teamLeaderEmployeeId })
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateTeam(id: string, patch: Partial<PtTeam>): Promise<void> {
  const { error } = await supabase.from('pt_teams').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase.from('pt_teams').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setEmployeeTeam(employeeId: string, teamId: string | null): Promise<void> {
  const { error } = await supabase.from('employees').update({ pt_team_id: teamId }).eq('id', employeeId);
  if (error) throw new Error(error.message);
}

// employees.pt_team_id isn't part of the shared Employee type (kept local
// to this module rather than widening a core type every consumer sees) —
// fetched separately and joined client-side wherever a team name is shown.
export async function getEmployeeTeamMap(companyId: string): Promise<Record<string, string | null>> {
  const { data, error } = await supabase.from('employees').select('id, pt_team_id').eq('company_id', companyId);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((e) => [e.id, e.pt_team_id as string | null]));
}

// ── Settings ─────────────────────────────────────────────────────────────

export async function getSettings(companyId: string): Promise<PtSettings> {
  const { data, error } = await supabase.from('pt_settings').select('*').eq('company_id', companyId).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  // Lazy-seed on first read — upsert + ignoreDuplicates so a concurrent
  // caller (e.g. React StrictMode's double effect invocation in dev, or the
  // pt_reports_compute_score trigger's own "insert on conflict do nothing"
  // seeding) can't crash this on the primary-key conflict.
  const { error: insErr } = await supabase.from('pt_settings').upsert({ company_id: companyId }, { onConflict: 'company_id', ignoreDuplicates: true });
  if (insErr) throw new Error(insErr.message);
  const { data: created, error: refetchErr } = await supabase.from('pt_settings').select('*').eq('company_id', companyId).single();
  if (refetchErr) throw new Error(refetchErr.message);
  return created;
}

export async function saveSettings(companyId: string, patch: Partial<PtSettings>): Promise<PtSettings> {
  const { data, error } = await supabase
    .from('pt_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('company_id', companyId)
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

// The primary key (company_id, kind, run_date) IS the dedupe: this insert
// either succeeds (nobody has run today's check for this company+kind
// yet — go ahead) or fails on a duplicate-key conflict (someone already
// has — including a second browser tab racing this exact moment), never
// both. Returns whether THIS caller won the claim.
export async function tryClaimAutoReminderRun(companyId: string, kind: 'morning' | 'evening', runDate: string): Promise<boolean> {
  const { error } = await supabase.from('pt_auto_reminder_runs').insert({ company_id: companyId, kind, run_date: runDate });
  if (!error) return true;
  if (error.code === '23505') return false; // unique_violation — already claimed
  throw new Error(error.message);
}

// ── Custom KPI fields ────────────────────────────────────────────────────

export async function getCustomFields(companyId: string): Promise<PtCustomField[]> {
  const { data, error } = await supabase
    .from('pt_custom_fields').select('*').eq('company_id', companyId).eq('is_active', true).order('sort_order');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCustomField(
  companyId: string,
  input: Pick<PtCustomField, 'field_key' | 'label' | 'applies_morning' | 'applies_evening' | 'counts_toward_score' | 'score_weight' | 'min_threshold'>
): Promise<PtCustomField> {
  const { data: existing } = await supabase
    .from('pt_custom_fields').select('sort_order').eq('company_id', companyId).order('sort_order', { ascending: false }).limit(1);
  const nextSort = (existing?.[0]?.sort_order ?? -1) + 1;
  const { data, error } = await supabase
    .from('pt_custom_fields').insert({ company_id: companyId, ...input, sort_order: nextSort }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCustomField(id: string, patch: Partial<PtCustomField>): Promise<void> {
  const { error } = await supabase.from('pt_custom_fields').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCustomField(id: string): Promise<void> {
  const { error } = await supabase.from('pt_custom_fields').update({ is_active: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Morning commitment ───────────────────────────────────────────────────

export async function getMyCommitment(employeeId: string, workDate: string): Promise<PtCommitment | null> {
  const { data, error } = await supabase
    .from('pt_commitments').select('*').eq('employee_id', employeeId).eq('work_date', workDate).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function submitCommitment(input: PtCommitmentForm): Promise<PtCommitment> {
  const { data, error } = await supabase.from('pt_commitments').insert(input).select().single();
  if (error) {
    if (error.code === '23505') throw new Error("You've already submitted today's commitment — it can't be edited after submission.");
    throw new Error(error.message);
  }
  return data;
}

export async function listCommitmentsForDate(companyId: string, workDate: string): Promise<PtCommitment[]> {
  const { data, error } = await supabase.from('pt_commitments').select('*').eq('company_id', companyId).eq('work_date', workDate);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Admin/manager correction of a typo — the "cannot be edited after
// submission" rule above is enforced by the UI (no self-edit button, per
// the employee-facing tabs), not by RLS, matching this app's convention
// that role-based restriction is a frontend concern.
export async function updateCommitment(id: string, patch: Partial<PtCommitmentForm>): Promise<PtCommitment> {
  const { data, error } = await supabase.from('pt_commitments').update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listCommitmentsForRange(companyId: string, startDate: string, endDate: string): Promise<PtCommitment[]> {
  const { data, error } = await supabase
    .from('pt_commitments').select('*').eq('company_id', companyId).gte('work_date', startDate).lte('work_date', endDate);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Evening report ───────────────────────────────────────────────────────

export async function getMyReport(employeeId: string, workDate: string): Promise<PtReport | null> {
  const { data, error } = await supabase
    .from('pt_reports').select('*').eq('employee_id', employeeId).eq('work_date', workDate).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function submitReport(input: PtReportForm): Promise<PtReport> {
  // score/achievement_pct/min_criteria_met are overwritten server-side by
  // the pt_reports_compute_score trigger regardless of what's sent here.
  const { data, error } = await supabase.from('pt_reports').insert(input).select().single();
  if (error) {
    if (error.code === '23505') throw new Error("You've already submitted today's evening report — it can't be edited after submission.");
    throw new Error(error.message);
  }
  return data;
}

// Admin/manager correction of a typo — score/achievement/min_criteria_met
// are recomputed automatically by the trigger on this update too.
export async function updateReport(id: string, patch: Partial<PtReportForm>): Promise<PtReport> {
  const { data, error } = await supabase.from('pt_reports').update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function setManagerComment(id: string, comment: string, byEmployeeId: string): Promise<PtReport> {
  const { data, error } = await supabase
    .from('pt_reports')
    .update({ manager_comment: comment, manager_comment_by: byEmployeeId, manager_comment_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listReportsForDate(companyId: string, workDate: string): Promise<PtReport[]> {
  const { data, error } = await supabase.from('pt_reports').select('*').eq('company_id', companyId).eq('work_date', workDate);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listReportsForRange(companyId: string, startDate: string, endDate: string): Promise<PtReport[]> {
  const { data, error } = await supabase
    .from('pt_reports').select('*').eq('company_id', companyId).gte('work_date', startDate).lte('work_date', endDate).order('work_date');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listMyReportsForRange(employeeId: string, startDate: string, endDate: string): Promise<PtReport[]> {
  const { data, error } = await supabase
    .from('pt_reports').select('*').eq('employee_id', employeeId).gte('work_date', startDate).lte('work_date', endDate).order('work_date');
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Champion categories ──────────────────────────────────────────────────

const DEFAULT_CHAMPION_CATEGORIES: { metric_key: PtChampionCategory['metric_key']; label: string; sort_order: number }[] = [
  { metric_key: 'f2f', label: 'Most Meetings', sort_order: 0 },
  { metric_key: 'sv', label: 'Site Visit Champion', sort_order: 1 },
  { metric_key: 'bookings', label: 'Most Bookings', sort_order: 2 },
  { metric_key: 'achievement', label: 'Best Achievement', sort_order: 3 },
];

export async function getChampionCategories(companyId: string): Promise<PtChampionCategory[]> {
  const { data, error } = await supabase.from('pt_champion_categories').select('*').eq('company_id', companyId).order('sort_order');
  if (error) throw new Error(error.message);
  if (data && data.length > 0) return data;
  // Lazy-seed on first read (same pattern as getSettings). Two tabs can hit
  // this at once (e.g. React StrictMode's double effect invocation in dev),
  // so upsert with ignoreDuplicates instead of a plain insert — a losing
  // concurrent call would otherwise crash on the unique constraint — then
  // re-select for the authoritative set either call actually produced.
  const { error: seedErr } = await supabase
    .from('pt_champion_categories')
    .upsert(DEFAULT_CHAMPION_CATEGORIES.map((c) => ({ company_id: companyId, ...c })), { onConflict: 'company_id,metric_key', ignoreDuplicates: true });
  if (seedErr) throw new Error(seedErr.message);
  const { data: seeded, error: refetchErr } = await supabase.from('pt_champion_categories').select('*').eq('company_id', companyId).order('sort_order');
  if (refetchErr) throw new Error(refetchErr.message);
  return seeded ?? [];
}

export async function updateChampionCategory(id: string, patch: Partial<PtChampionCategory>): Promise<void> {
  const { error } = await supabase.from('pt_champion_categories').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}
