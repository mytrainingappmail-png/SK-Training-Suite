// src/components/performanceTracker/ReportsTab.tsx
//
// Flexible report builder for managers — pick a single day or any date
// range, filter by any combination of employees/teams/departments, choose
// which metrics matter (F2F-only, Site-Visit-only, or any mix), see just
// the Plan, just the Achievement, or both side by side, and view it as
// daily detail, one row per employee, or rolled up per Team Leader (so a
// leader's own performance — their whole team's combined plan/achievement —
// can be judged too). CSV export matches exactly what's on screen.

import { useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadCommitmentsForRange, loadReportsForRange, editReport, editCommitment, leaveManagerComment } from '../../services/performanceTracker/performanceTrackerService';
import { fmtDate, weekRange, weekendRange, monthRange } from '../../utils/performanceTrackerUtils';
import { csvEscape, downloadCsvFile } from '../../services/quiz/quizCsvService';
import type { Employee } from '../../types/employee';
import type { Department } from '../../types/department';
import type { PtTeam, PtCommitment, PtReport } from '../../types/performanceTracker';
import { Card, SelectField, MultiSelectField, NumField, LoadingBlock, Modal, ptInputCls, employeeName } from './ptUi';
import { IconDocument, IconSpinner } from './ptIcons';

// ── Metric config — every "activity type" in this module is a fixed pair of
// columns (Planned + Done), not a row with a type — see performanceTracker.ts. ──

type MetricKey = 'f2f' | 'sv' | 'revisit' | 'calls' | 'conn' | 'talk';

const METRICS: { key: MetricKey; label: string; plannedKey: keyof PtCommitment; doneKey: keyof PtReport }[] = [
  { key: 'f2f', label: 'F2F', plannedKey: 'f2f_planned', doneKey: 'f2f_done' },
  { key: 'sv', label: 'Site Visits', plannedKey: 'sv_planned', doneKey: 'sv_done' },
  { key: 'revisit', label: 'Revisits', plannedKey: 'revisit_planned', doneKey: 'revisit_done' },
  { key: 'calls', label: 'Calls', plannedKey: 'calls_planned', doneKey: 'calls_done' },
  { key: 'conn', label: 'Connected', plannedKey: 'conn_target', doneKey: 'conn_done' },
  { key: 'talk', label: 'Talk (min)', plannedKey: 'talk_target', doneKey: 'talk_done' },
];

type DataMode = 'plan' | 'achievement' | 'both';
type GroupMode = 'daily' | 'employee' | 'leader';

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return { start: fmtDate(start), end: fmtDate(end) };
}

function pct(done: number | null, planned: number | null): number | null {
  if (planned === null || planned <= 0 || done === null) return null;
  return Math.round((done / planned) * 100);
}

// One row per (employee, date) that has EITHER a commitment or a report —
// a future date with a plan but no evening report yet still gets a row,
// with every "done" value simply absent (this is what makes "what's the
// weekend plan" answerable before anyone's reported back).
interface MergedRow {
  key: string;
  employee_id: string;
  work_date: string;
  commitment: PtCommitment | null;
  report: PtReport | null;
}

function ReportDetailModal({ report, employeeLabel, onClose, onSaved }: {
  report: PtReport; employeeLabel: string; onClose: () => void; onSaved: (r: PtReport) => void;
}) {
  const user = getCurrentUser();
  const [draft, setDraft] = useState(report);
  const [comment, setComment] = useState(report.manager_comment ?? '');
  const [savingValues, setSavingValues] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [err, setErr] = useState('');

  async function handleSaveValues() {
    setSavingValues(true);
    setErr('');
    try {
      const saved = await editReport(report.id, {
        f2f_done: draft.f2f_done, sv_done: draft.sv_done, revisit_done: draft.revisit_done,
        calls_done: draft.calls_done, conn_done: draft.conn_done, talk_done: draft.talk_done,
        leads: draft.leads, meetings_fixed: draft.meetings_fixed, bookings: draft.bookings,
        remarks: draft.remarks,
      });
      onSaved(saved);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save correction.');
    } finally {
      setSavingValues(false);
    }
  }

  async function handleSaveComment() {
    if (!user?.id) return;
    setSavingComment(true);
    setErr('');
    try {
      const saved = await leaveManagerComment(report.id, comment, user.id);
      onSaved(saved);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save comment.');
    } finally {
      setSavingComment(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${employeeLabel} — ${report.work_date}`}>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-600">Correct a typo (recomputes Score/Achievement automatically)</p>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="F2F Done" value={draft.f2f_done} onChange={(v) => setDraft((d) => ({ ...d, f2f_done: v }))} />
            <NumField label="Site Visits" value={draft.sv_done} onChange={(v) => setDraft((d) => ({ ...d, sv_done: v }))} />
            <NumField label="Revisits" value={draft.revisit_done} onChange={(v) => setDraft((d) => ({ ...d, revisit_done: v }))} />
            <NumField label="Calls Made" value={draft.calls_done} onChange={(v) => setDraft((d) => ({ ...d, calls_done: v }))} />
            <NumField label="Connected" value={draft.conn_done} onChange={(v) => setDraft((d) => ({ ...d, conn_done: v }))} />
            <NumField label="Talk (mins)" value={draft.talk_done} onChange={(v) => setDraft((d) => ({ ...d, talk_done: v }))} />
            <NumField label="Leads" value={draft.leads} onChange={(v) => setDraft((d) => ({ ...d, leads: v }))} />
            <NumField label="Meetings Fixed" value={draft.meetings_fixed} onChange={(v) => setDraft((d) => ({ ...d, meetings_fixed: v }))} />
            <NumField label="Bookings" value={draft.bookings} onChange={(v) => setDraft((d) => ({ ...d, bookings: v }))} />
          </div>
          <button onClick={handleSaveValues} disabled={savingValues} className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
            {savingValues && <IconSpinner className="h-3 w-3" />}Save Correction
          </button>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold text-slate-600">Manager Feedback (visible to {employeeLabel})</p>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="e.g. Great push on site visits this week — keep the momentum on calls." className={`resize-none ${ptInputCls}`} />
          <button onClick={handleSaveComment} disabled={savingComment || !comment.trim()} className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {savingComment && <IconSpinner className="h-3 w-3" />}Save Feedback
          </button>
          {report.manager_comment_at && (
            <p className="mt-2 text-[11px] text-slate-600">Last updated {new Date(report.manager_comment_at).toLocaleString('en-IN')}.</p>
          )}
        </div>

        {err && <p className="text-xs text-rose-600">{err}</p>}
      </div>
    </Modal>
  );
}

// Mirrors ReportDetailModal's shape, but for correcting a Morning
// Commitment — this UI didn't exist before (only Evening Reports could be
// corrected by a manager) even though the repository/service functions for
// it were already there and simply never called from anywhere.
function CommitmentDetailModal({ commitment, employeeLabel, onClose, onSaved }: {
  commitment: PtCommitment; employeeLabel: string; onClose: () => void; onSaved: (c: PtCommitment) => void;
}) {
  const [draft, setDraft] = useState(commitment);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSave() {
    setSaving(true);
    setErr('');
    try {
      const saved = await editCommitment(commitment.id, {
        f2f_planned: draft.f2f_planned, sv_planned: draft.sv_planned, planned_site: draft.planned_site,
        revisit_planned: draft.revisit_planned, calls_planned: draft.calls_planned,
        conn_target: draft.conn_target, talk_target: draft.talk_target, remarks: draft.remarks,
      });
      onSaved(saved);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save correction.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${employeeLabel} — ${commitment.work_date} (Plan)`}>
      <div className="space-y-4">
        <p className="text-xs font-semibold text-slate-600">Correct a typo in the morning plan</p>
        <div className="grid grid-cols-3 gap-2">
          <NumField label="F2F Planned" value={draft.f2f_planned} onChange={(v) => setDraft((d) => ({ ...d, f2f_planned: v }))} />
          <NumField label="Site Visits" value={draft.sv_planned} onChange={(v) => setDraft((d) => ({ ...d, sv_planned: v }))} />
          <NumField label="Revisits" value={draft.revisit_planned} onChange={(v) => setDraft((d) => ({ ...d, revisit_planned: v }))} />
          <NumField label="Calls" value={draft.calls_planned} onChange={(v) => setDraft((d) => ({ ...d, calls_planned: v }))} />
          <NumField label="Connected Target" value={draft.conn_target} onChange={(v) => setDraft((d) => ({ ...d, conn_target: v }))} />
          <NumField label="Talk Target (mins)" value={draft.talk_target} onChange={(v) => setDraft((d) => ({ ...d, talk_target: v }))} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Planned Site / Location</label>
          <input type="text" value={draft.planned_site ?? ''} onChange={(e) => setDraft((d) => ({ ...d, planned_site: e.target.value || null }))} className={`mt-1 ${ptInputCls}`} />
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
          {saving && <IconSpinner className="h-3 w-3" />}Save Correction
        </button>
        {err && <p className="text-xs text-rose-600">{err}</p>}
      </div>
    </Modal>
  );
}

export function ReportsTab({ employees, teams, teamMap, departments }: {
  employees: Employee[]; teams: PtTeam[]; teamMap: Record<string, string | null>; departments: Department[];
}) {
  const user = getCurrentUser();
  const [range, setRange] = useState(defaultRange());
  const [singleDay, setSingleDay] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [metricFilter, setMetricFilter] = useState<MetricKey[]>(METRICS.map((m) => m.key));
  const [dataMode, setDataMode] = useState<DataMode>('both');
  const [groupMode, setGroupMode] = useState<GroupMode>('daily');
  const [loading, setLoading] = useState(true);
  const [commitments, setCommitments] = useState<PtCommitment[]>([]);
  const [reports, setReports] = useState<PtReport[]>([]);
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [openCommitmentId, setOpenCommitmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      loadCommitmentsForRange(user.companyId, range.start, range.end),
      loadReportsForRange(user.companyId, range.start, range.end),
    ])
      .then(([c, r]) => { if (!cancelled) { setCommitments(c); setReports(r); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.companyId, range.start, range.end]);

  function applyPreset(preset: 'today' | 'yesterday' | 'week' | 'weekend' | 'month') {
    const now = new Date();
    if (preset === 'today') { const d = fmtDate(now); setRange({ start: d, end: d }); setSingleDay(true); }
    else if (preset === 'yesterday') { const y = new Date(now); y.setDate(now.getDate() - 1); const d = fmtDate(y); setRange({ start: d, end: d }); setSingleDay(true); }
    else if (preset === 'week') { const wr = weekRange(now); setRange({ start: wr.start, end: wr.end }); setSingleDay(false); }
    else if (preset === 'weekend') { setRange(weekendRange(now)); setSingleDay(false); }
    else if (preset === 'month') { const mr = monthRange(now); setRange({ start: mr.start, end: mr.end }); setSingleDay(false); }
  }

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  function leaderIdFor(employeeId: string): string | null {
    const teamId = teamMap[employeeId];
    if (!teamId) return null;
    return teamById.get(teamId)?.team_leader_employee_id ?? null;
  }
  function leaderLabelFor(employeeId: string): string {
    const leaderId = leaderIdFor(employeeId);
    return leaderId ? employeeName(empById.get(leaderId)) : '—';
  }

  // Union of every (employee, date) that has a commitment OR a report,
  // filtered by employee/team/department — neither table has a foreign key
  // to the other, only the shared (employee_id, work_date) pair links them.
  const merged: MergedRow[] = useMemo(() => {
    const commByKey = new Map(commitments.map((c) => [`${c.employee_id}|${c.work_date}`, c]));
    const repByKey = new Map(reports.map((r) => [`${r.employee_id}|${r.work_date}`, r]));
    const allKeys = new Set([...commByKey.keys(), ...repByKey.keys()]);

    const rows: MergedRow[] = [];
    for (const key of allKeys) {
      const [employee_id, work_date] = key.split('|');
      if (employeeFilter.length > 0 && !employeeFilter.includes(employee_id)) continue;
      if (teamFilter.length > 0 && !teamFilter.includes(teamMap[employee_id] ?? '')) continue;
      if (deptFilter.length > 0 && !deptFilter.includes(empById.get(employee_id)?.department_id ?? '')) continue;
      rows.push({ key, employee_id, work_date, commitment: commByKey.get(key) ?? null, report: repByKey.get(key) ?? null });
    }
    return rows.sort((a, b) => b.work_date.localeCompare(a.work_date) || employeeName(empById.get(a.employee_id)).localeCompare(employeeName(empById.get(b.employee_id))));
  }, [commitments, reports, employeeFilter, teamFilter, deptFilter, teamMap, empById]);

  const activeMetrics = METRICS.filter((m) => metricFilter.includes(m.key));
  const showPlan = dataMode !== 'achievement';
  const showAchievement = dataMode !== 'plan';

  // ── Column definitions — the SAME set drives both the on-screen table and
  // the CSV export, so what's previewed is exactly what downloads. ──────────

  interface Col { header: string; get: (row: SummaryRow) => string | number }
  interface SummaryRow {
    groupLabel: string;
    teamLeaderLabel: string;
    work_date?: string;
    plannedSite?: string | null;
    daysCount: number;
    metricTotals: Record<MetricKey, { planned: number; done: number | null }>;
    avgAchievement: number | null;
    daysMeetingCriteria?: string;
    score?: number | null;
    minCriteriaMet?: boolean | null;
    managerComment?: string | null;
    reportId?: string | null;
    commitmentId?: string | null;
    clickable: boolean;
  }

  function emptyTotals(): Record<MetricKey, { planned: number; done: number | null }> {
    return { f2f: { planned: 0, done: 0 }, sv: { planned: 0, done: 0 }, revisit: { planned: 0, done: 0 }, calls: { planned: 0, done: 0 }, conn: { planned: 0, done: 0 }, talk: { planned: 0, done: 0 } };
  }

  const summaryRows: SummaryRow[] = useMemo(() => {
    if (groupMode === 'daily') {
      return merged.map((row): SummaryRow => {
        const totals = emptyTotals();
        for (const m of METRICS) {
          totals[m.key] = {
            planned: (row.commitment?.[m.plannedKey] as number | undefined) ?? 0,
            // No Evening Report submitted at all yet (a future/weekend plan,
            // or today before it's reported) is NOT the same as "achieved
            // zero" — keep it null here so the column reads as pending
            // rather than a failure, distinct from a report that genuinely
            // logged 0 for a metric.
            done: row.report ? ((row.report[m.doneKey] as number | undefined) ?? 0) : null,
          };
        }
        return {
          groupLabel: employeeName(empById.get(row.employee_id)),
          teamLeaderLabel: leaderLabelFor(row.employee_id),
          work_date: row.work_date,
          plannedSite: row.commitment?.planned_site ?? null,
          daysCount: 1,
          metricTotals: totals,
          avgAchievement: row.report?.achievement_pct ?? null,
          score: row.report?.score ?? null,
          minCriteriaMet: row.report?.min_criteria_met ?? null,
          managerComment: row.report?.manager_comment ?? null,
          reportId: row.report?.id ?? null,
          commitmentId: row.commitment?.id ?? null,
          clickable: showAchievement && row.report != null,
        };
      });
    }

    // employee / leader — roll many merged rows up into one bucket per
    // employee or per resolved team leader.
    const bucketOf = (row: MergedRow) => groupMode === 'employee' ? row.employee_id : (leaderIdFor(row.employee_id) ?? '__none__');
    const buckets = new Map<string, MergedRow[]>();
    for (const row of merged) {
      const key = bucketOf(row);
      buckets.set(key, [...(buckets.get(key) ?? []), row]);
    }

    return Array.from(buckets.entries()).map(([bucketKey, rows]): SummaryRow => {
      const totals = emptyTotals();
      let achSum = 0, achCount = 0, criteriaMet = 0, criteriaTotal = 0;
      for (const row of rows) {
        for (const m of METRICS) {
          totals[m.key].planned += (row.commitment?.[m.plannedKey] as number | undefined) ?? 0;
          // A sum across many days: a day with no report just contributes 0,
          // which is the correct total either way — unlike the single-day
          // view, a multi-day sum has no ambiguous "0 means pending" case.
          totals[m.key].done = (totals[m.key].done ?? 0) + ((row.report?.[m.doneKey] as number | undefined) ?? 0);
        }
        if (row.report?.achievement_pct != null) { achSum += row.report.achievement_pct; achCount++; }
        if (row.report?.min_criteria_met != null) { criteriaTotal++; if (row.report.min_criteria_met) criteriaMet++; }
      }
      const groupLabel = groupMode === 'employee'
        ? employeeName(empById.get(bucketKey))
        : bucketKey === '__none__' ? 'No Team Leader' : employeeName(empById.get(bucketKey));
      return {
        groupLabel,
        teamLeaderLabel: groupMode === 'employee' ? leaderLabelFor(bucketKey) : groupLabel,
        daysCount: rows.length,
        metricTotals: totals,
        avgAchievement: achCount > 0 ? Math.round((achSum / achCount) * 10) / 10 : null,
        daysMeetingCriteria: criteriaTotal > 0 ? `${criteriaMet}/${criteriaTotal}` : '—',
        clickable: false,
      };
    }).sort((a, b) => a.groupLabel.localeCompare(b.groupLabel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merged, groupMode, empById, teamMap, teamById, showAchievement]);

  const columns: Col[] = useMemo(() => {
    const cols: Col[] = [];
    if (groupMode === 'daily') cols.push({ header: 'Date', get: (r) => r.work_date ?? '' });
    cols.push({ header: groupMode === 'leader' ? 'Team Leader' : 'Employee', get: (r) => r.groupLabel });
    if (groupMode !== 'leader') cols.push({ header: 'Team Leader', get: (r) => r.teamLeaderLabel });
    if (groupMode !== 'daily') cols.push({ header: 'Days', get: (r) => r.daysCount });

    for (const m of activeMetrics) {
      if (showPlan) cols.push({ header: `${m.label} Planned`, get: (r) => r.metricTotals[m.key].planned });
      if (showAchievement) cols.push({ header: `${m.label} Done`, get: (r) => r.metricTotals[m.key].done ?? '—' });
      if (showPlan && showAchievement) {
        cols.push({ header: `${m.label} %`, get: (r) => pct(r.metricTotals[m.key].done, r.metricTotals[m.key].planned) ?? '—' });
      }
      if (m.key === 'sv' && showPlan && groupMode === 'daily') {
        cols.push({ header: 'Planned Site', get: (r) => r.plannedSite ?? '' });
      }
    }

    if (showAchievement) {
      if (groupMode === 'daily') {
        cols.push({ header: 'Score', get: (r) => r.score != null ? Math.round(r.score) : '—' });
        cols.push({ header: 'Achievement %', get: (r) => r.avgAchievement != null ? `${r.avgAchievement}%` : '—' });
        cols.push({ header: 'Min Criteria Met', get: (r) => r.minCriteriaMet ? 'Yes' : r.minCriteriaMet === false ? 'No' : '—' });
        cols.push({ header: 'Manager Feedback', get: (r) => r.managerComment ?? '' });
      } else {
        cols.push({ header: 'Avg Achievement %', get: (r) => r.avgAchievement != null ? `${r.avgAchievement}%` : '—' });
        cols.push({ header: 'Days Meeting Criteria', get: (r) => r.daysMeetingCriteria ?? '—' });
      }
    }
    return cols;
  }, [groupMode, activeMetrics, showPlan, showAchievement]);

  const openReport = openReportId ? reports.find((r) => r.id === openReportId) ?? null : null;
  const openCommitment = openCommitmentId ? commitments.find((c) => c.id === openCommitmentId) ?? null : null;

  function exportCsv() {
    const header = columns.map((c) => c.header);
    const rows = summaryRows.map((r) => columns.map((c) => c.get(r)));
    const csv = [header, ...rows].map((row) => row.map((cell) => csvEscape(String(cell))).join(',')).join('\r\n');
    const modeLabel = groupMode === 'daily' ? 'daily' : groupMode === 'employee' ? 'by-employee' : 'by-leader';
    downloadCsvFile(`pt-report_${range.start}_to_${range.end}_${modeLabel}_${dataMode}.csv`, csv);
  }

  const teamOptions = teams.map((t) => ({ value: t.id, label: t.name }));
  const deptOptions = departments.map((d) => ({ value: d.id, label: d.department_name }));
  const employeeOptions = employees.filter((e) => e.active).map((e) => ({ value: e.id, label: employeeName(e) }));

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 p-1">
            {(['today', 'yesterday', 'week', 'weekend', 'month'] as const).map((p) => (
              <button key={p} onClick={() => applyPreset(p)} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-white hover:shadow-sm">
                {p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === 'week' ? 'This Week' : p === 'weekend' ? 'This Weekend' : 'This Month'}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={singleDay} onChange={(e) => { setSingleDay(e.target.checked); if (e.target.checked) setRange((r) => ({ start: r.start, end: r.start })); }} className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600" />
            Single Day
          </label>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{singleDay ? 'Date' : 'From'}</label>
            <input type="date" value={range.start} onChange={(e) => setRange((r) => ({ start: e.target.value, end: singleDay ? e.target.value : r.end }))} className="rounded-lg bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40" />
          </div>
          {!singleDay && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
              <input type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} className="rounded-lg bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56"><MultiSelectField label="Employees" values={employeeFilter} onChange={setEmployeeFilter} options={employeeOptions} placeholder="All Employees" /></div>
          {teams.length > 0 && <div className="w-48"><MultiSelectField label="Teams" values={teamFilter} onChange={setTeamFilter} options={teamOptions} placeholder="All Teams" /></div>}
          <div className="w-48"><MultiSelectField label="Departments" values={deptFilter} onChange={setDeptFilter} options={deptOptions} placeholder="All Departments" /></div>
          <div className="w-56"><MultiSelectField label="Metrics" values={metricFilter} onChange={(v) => setMetricFilter(v as MetricKey[])} options={METRICS.map((m) => ({ value: m.key, label: m.label }))} placeholder="No metrics selected" /></div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48"><SelectField label="Show" value={dataMode} onChange={(v) => setDataMode(v as DataMode)} options={[{ value: 'both', label: 'Plan vs Achievement' }, { value: 'plan', label: 'Plan Only' }, { value: 'achievement', label: 'Achievement Only' }]} /></div>
          <div className="w-48"><SelectField label="View" value={groupMode} onChange={(v) => setGroupMode(v as GroupMode)} options={[{ value: 'daily', label: 'Daily Detail' }, { value: 'employee', label: 'Summary per Employee' }, { value: 'leader', label: 'Group by Team Leader' }]} /></div>
          <button onClick={exportCsv} disabled={summaryRows.length === 0 || activeMetrics.length === 0} className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            <IconDocument className="h-3.5 w-3.5" />Export CSV
          </button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? <div className="p-8"><LoadingBlock /></div> : activeMetrics.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-600">Pick at least one metric above to see the report.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                  {columns.map((c) => <th key={c.header} className="whitespace-nowrap px-4 py-2 font-medium">{c.header}</th>)}
                  {groupMode === 'daily' && <th className="whitespace-nowrap px-4 py-2 font-medium">Correct</th>}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((r, i) => (
                  <tr
                    key={i}
                    onClick={() => r.clickable && r.reportId && setOpenReportId(r.reportId)}
                    className={`border-b border-slate-50 last:border-0 ${r.clickable ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                  >
                    {columns.map((c) => <td key={c.header} className="whitespace-nowrap px-4 py-2 font-mono text-slate-700 first:font-sans first:font-medium first:text-slate-900 [&:nth-child(2)]:font-sans">{c.get(r)}</td>)}
                    {groupMode === 'daily' && (
                      <td className="whitespace-nowrap px-4 py-2 font-sans">
                        {r.commitmentId && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenCommitmentId(r.commitmentId ?? null); }}
                            className="text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:underline"
                          >
                            Edit Plan
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {summaryRows.length === 0 && <tr><td colSpan={columns.length + (groupMode === 'daily' ? 1 : 0)} className="px-4 py-8 text-center text-sm text-slate-600">No data for this selection.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {openReport && (
        <ReportDetailModal
          report={openReport}
          employeeLabel={employeeName(empById.get(openReport.employee_id))}
          onClose={() => setOpenReportId(null)}
          onSaved={(saved) => setReports((rs) => rs.map((r) => (r.id === saved.id ? saved : r)))}
        />
      )}

      {openCommitment && (
        <CommitmentDetailModal
          commitment={openCommitment}
          employeeLabel={employeeName(empById.get(openCommitment.employee_id))}
          onClose={() => setOpenCommitmentId(null)}
          onSaved={(saved) => setCommitments((cs) => cs.map((c) => (c.id === saved.id ? saved : c)))}
        />
      )}
    </div>
  );
}
