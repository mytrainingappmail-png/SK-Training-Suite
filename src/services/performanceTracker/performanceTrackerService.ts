// src/services/performanceTracker/performanceTrackerService.ts
//
// Business logic + orchestration for Performance Tracker.

import * as repo from '../../repositories/performanceTracker/performanceTrackerRepository';
import { createNotification } from '../../repositories/notification/notificationRepository';
import { sendNotificationNow } from '../notification/notificationService';
import { defaultNotificationForm } from '../../types/notification';
import type {
  PtTeam, PtSettings, PtCustomField, PtCommitment, PtCommitmentForm,
  PtReport, PtReportForm, PtChampionCategory, PtLeaderboardFormula, PtChampionMetricKey,
} from '../../types/performanceTracker';
import type { Employee } from '../../types/employee';

export const todayStr = repo.todayStr;

// ── Teams ────────────────────────────────────────────────────────────────

export async function loadTeams(companyId: string): Promise<PtTeam[]> {
  return repo.getTeams(companyId);
}

export async function saveTeam(companyId: string, name: string, teamLeaderEmployeeId: string | null): Promise<PtTeam> {
  if (!name.trim()) throw new Error('Team name is required.');
  return repo.createTeam(companyId, name.trim(), teamLeaderEmployeeId);
}

export async function editTeam(id: string, patch: Partial<PtTeam>): Promise<void> {
  return repo.updateTeam(id, patch);
}

export async function removeTeam(id: string): Promise<void> {
  return repo.deleteTeam(id);
}

export async function assignEmployeeTeam(employeeId: string, teamId: string | null): Promise<void> {
  return repo.setEmployeeTeam(employeeId, teamId);
}

export async function loadEmployeeTeamMap(companyId: string): Promise<Record<string, string | null>> {
  return repo.getEmployeeTeamMap(companyId);
}

// ── Settings ─────────────────────────────────────────────────────────────

export async function loadSettings(companyId: string): Promise<PtSettings> {
  return repo.getSettings(companyId);
}

export async function saveSettings(companyId: string, patch: Partial<PtSettings>): Promise<PtSettings> {
  return repo.saveSettings(companyId, patch);
}

// ── Custom KPI fields ────────────────────────────────────────────────────

export async function loadCustomFields(companyId: string): Promise<PtCustomField[]> {
  return repo.getCustomFields(companyId);
}

export async function saveCustomField(
  companyId: string,
  input: {
    field_key: string; label: string; applies_morning: boolean; applies_evening: boolean;
    counts_toward_score?: boolean; score_weight?: number; min_threshold?: number | null;
  }
): Promise<PtCustomField> {
  if (!input.label.trim()) throw new Error('Field label is required.');
  if (!input.field_key.trim()) throw new Error('Field key is required.');
  return repo.createCustomField(companyId, {
    ...input,
    field_key: input.field_key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    label: input.label.trim(),
    counts_toward_score: input.counts_toward_score ?? false,
    score_weight: input.score_weight ?? 0,
    min_threshold: input.min_threshold ?? null,
  });
}

export async function editCustomField(id: string, patch: Partial<PtCustomField>): Promise<void> {
  return repo.updateCustomField(id, patch);
}

export async function removeCustomField(id: string): Promise<void> {
  return repo.deleteCustomField(id);
}

// ── Morning commitment ───────────────────────────────────────────────────

export async function loadMyCommitment(employeeId: string, workDate: string): Promise<PtCommitment | null> {
  return repo.getMyCommitment(employeeId, workDate);
}

export async function submitCommitment(input: PtCommitmentForm): Promise<PtCommitment> {
  return repo.submitCommitment(input);
}

export async function loadCommitmentsForDate(companyId: string, workDate: string): Promise<PtCommitment[]> {
  return repo.listCommitmentsForDate(companyId, workDate);
}

export async function loadCommitmentsForRange(companyId: string, startDate: string, endDate: string): Promise<PtCommitment[]> {
  return repo.listCommitmentsForRange(companyId, startDate, endDate);
}

export async function editCommitment(id: string, patch: Partial<PtCommitmentForm>): Promise<PtCommitment> {
  if (!id) throw new Error('Invalid commitment ID.');
  return repo.updateCommitment(id, patch);
}

// ── Evening report ───────────────────────────────────────────────────────

export async function loadMyReport(employeeId: string, workDate: string): Promise<PtReport | null> {
  return repo.getMyReport(employeeId, workDate);
}

export async function submitReport(input: PtReportForm): Promise<PtReport> {
  return repo.submitReport(input);
}

export async function loadReportsForDate(companyId: string, workDate: string): Promise<PtReport[]> {
  return repo.listReportsForDate(companyId, workDate);
}

export async function loadReportsForRange(companyId: string, startDate: string, endDate: string): Promise<PtReport[]> {
  return repo.listReportsForRange(companyId, startDate, endDate);
}

export async function loadMyReportsForRange(employeeId: string, startDate: string, endDate: string): Promise<PtReport[]> {
  return repo.listMyReportsForRange(employeeId, startDate, endDate);
}

export async function editReport(id: string, patch: Partial<PtReportForm>): Promise<PtReport> {
  if (!id) throw new Error('Invalid report ID.');
  return repo.updateReport(id, patch);
}

export async function leaveManagerComment(id: string, comment: string, byEmployeeId: string): Promise<PtReport> {
  if (!comment.trim()) throw new Error('Comment cannot be empty.');
  return repo.setManagerComment(id, comment.trim(), byEmployeeId);
}

// ── Champion categories ──────────────────────────────────────────────────

export async function loadChampionCategories(companyId: string): Promise<PtChampionCategory[]> {
  return repo.getChampionCategories(companyId);
}

export async function editChampionCategory(id: string, patch: Partial<PtChampionCategory>): Promise<void> {
  return repo.updateChampionCategory(id, patch);
}

// ── Reminders (in-app notification, reusing this app's existing system) ──

export async function sendReminder(
  companyId: string,
  createdBy: string,
  createdByName: string,
  employeeIds: string[],
  kind: 'morning' | 'evening',
  settings: PtSettings
): Promise<number> {
  if (employeeIds.length === 0) return 0;
  const title = kind === 'morning' ? settings.morning_reminder_title : settings.evening_reminder_title;
  const message = kind === 'morning' ? settings.morning_reminder_message : settings.evening_reminder_message;
  const notification = await createNotification(companyId, createdBy, {
    ...defaultNotificationForm,
    type: 'announcement',
    title,
    message,
    audience_type: 'employee',
    created_by_name: createdByName,
  });
  await sendNotificationNow(notification, employeeIds);
  return employeeIds.length;
}

// No server-side cron exists anywhere in this app (see the auto-reminder
// migration's own header comment), so this is the entire mechanism:
// called once whenever anyone opens Performance Tracker
// (PerformanceTrackerLayout.tsx), fire-and-forget. It only ever does
// real work once per company per kind per day — tryClaimAutoReminderRun's
// unique-key insert is what makes that safe even if two people open the
// tracker around the same moment.
export async function checkAndRunAutoReminders(
  companyId: string,
  triggeringEmployeeId: string,
  employees: Employee[],
): Promise<void> {
  const settings = await repo.getSettings(companyId);
  if (!settings.auto_reminder_enabled) return;

  const today = repo.todayStr();
  const nowHHMMSS = new Date().toTimeString().slice(0, 8);
  const active = employees.filter((e) => e.active);

  for (const kind of ['morning', 'evening'] as const) {
    const cutoff = kind === 'morning' ? settings.auto_reminder_morning_cutoff : settings.auto_reminder_evening_cutoff;
    if (nowHHMMSS < cutoff) continue;

    const claimed = await repo.tryClaimAutoReminderRun(companyId, kind, today);
    if (!claimed) continue; // already ran today (this session or another)

    const records = kind === 'morning'
      ? await repo.listCommitmentsForDate(companyId, today)
      : await repo.listReportsForDate(companyId, today);
    const missing = active.filter((e) => !records.some((r) => r.employee_id === e.id));
    if (missing.length === 0) continue;

    await sendReminder(companyId, triggeringEmployeeId, 'Performance Tracker (Auto-Reminder)', missing.map((e) => e.id), kind, settings);

    // Also roll up each missing employee's team leader into one heads-up
    // notification per leader — resolved via employees.pt_team_id ->
    // pt_teams.team_leader_employee_id (never done anywhere in this app
    // before this).
    const [teamMap, teams] = await Promise.all([repo.getEmployeeTeamMap(companyId), repo.getTeams(companyId)]);
    const leaderById = new Map(teams.map((t) => [t.id, t.team_leader_employee_id]));
    const namesByLeader = new Map<string, string[]>();
    for (const e of missing) {
      const teamId = teamMap[e.id];
      const leaderId = teamId ? leaderById.get(teamId) : null;
      if (!leaderId || leaderId === e.id) continue; // no leader, or the leader IS the missing person
      const name = `${e.first_name} ${e.last_name}`.trim();
      namesByLeader.set(leaderId, [...(namesByLeader.get(leaderId) ?? []), name]);
    }
    const kindLabel = kind === 'morning' ? 'morning commitment' : 'evening report';
    for (const [leaderId, names] of namesByLeader) {
      const notification = await createNotification(companyId, triggeringEmployeeId, {
        ...defaultNotificationForm,
        type: 'announcement',
        title: `${names.length} of your team hasn't submitted today's ${kindLabel}`,
        message: `${names.join(', ')} — still pending for today. You may want to follow up.`,
        audience_type: 'employee',
        created_by_name: 'Performance Tracker (Auto-Reminder)',
      });
      await sendNotificationNow(notification, [leaderId]).catch(() => {});
    }
  }
}

// ── Leaderboard math (pure) ──────────────────────────────────────────────

export function leaderboardValue(r: { score: number | null; bookings: number; achievement_pct: number | null }, formula: PtLeaderboardFormula): number {
  switch (formula) {
    case 'score': return r.score ?? 0;
    case 'bookings': return r.bookings;
    case 'composite': {
      const ach = r.achievement_pct ?? 0;
      const normScore = Math.min((r.score ?? 0) / 5, 100);
      return ach * 0.6 + normScore * 0.4;
    }
    case 'achievement':
    default:
      return r.achievement_pct ?? 0;
  }
}

/** Sums a raw metric across a set of reports — "who did the most X this period". */
export function championMetricTotal(reports: PtReport[], metricKey: PtChampionMetricKey): number {
  switch (metricKey) {
    case 'f2f': return reports.reduce((s, r) => s + r.f2f_done, 0);
    case 'sv': return reports.reduce((s, r) => s + r.sv_done, 0);
    case 'bookings': return reports.reduce((s, r) => s + r.bookings, 0);
    case 'calls': return reports.reduce((s, r) => s + r.calls_done, 0);
    case 'talk': return reports.reduce((s, r) => s + r.talk_done, 0);
    case 'achievement': {
      const vals = reports.map((r) => r.achievement_pct).filter((v): v is number => v != null);
      return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
    }
    default: return 0;
  }
}

export function championMetricUnit(metricKey: PtChampionMetricKey): string {
  switch (metricKey) {
    case 'achievement': return '%';
    case 'talk': return ' mins';
    default: return '';
  }
}
