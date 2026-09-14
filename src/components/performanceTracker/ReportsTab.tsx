// src/components/performanceTracker/ReportsTab.tsx
//
// Date-range report table for managers — every evening report in the
// selected range, filterable by team/department, exportable as CSV. Click
// a row to see the full breakdown, correct a typo (real data entry
// mistakes happen — nothing else in this module lets you fix one), and
// leave feedback the employee sees on their own Evening Report screen.

import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadReportsForRange, editReport, leaveManagerComment } from '../../services/performanceTracker/performanceTrackerService';
import { csvDownload, fmtDate } from '../../utils/performanceTrackerUtils';
import type { Employee } from '../../types/employee';
import type { Department } from '../../types/department';
import type { PtTeam, PtReport } from '../../types/performanceTracker';
import { Card, SelectField, NumField, LoadingBlock, Modal, ptInputCls, employeeName } from './ptUi';
import { IconDocument, IconSpinner } from './ptIcons';

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return { start: fmtDate(start), end: fmtDate(end) };
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

export function ReportsTab({ employees, teams, teamMap, departments }: {
  employees: Employee[]; teams: PtTeam[]; teamMap: Record<string, string | null>; departments: Department[];
}) {
  const user = getCurrentUser();
  const [range, setRange] = useState(defaultRange());
  const [teamFilter, setTeamFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<PtReport[]>([]);
  const [openReportId, setOpenReportId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;
    let cancelled = false;
    setLoading(true);
    loadReportsForRange(user.companyId, range.start, range.end)
      .then((r) => { if (!cancelled) setReports(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.companyId, range.start, range.end]);

  const empById = new Map(employees.map((e) => [e.id, e]));
  const filtered = reports.filter((r) => {
    const emp = empById.get(r.employee_id);
    if (teamFilter && teamMap[r.employee_id] !== teamFilter) return false;
    if (deptFilter && emp?.department_id !== deptFilter) return false;
    return true;
  }).sort((a, b) => b.work_date.localeCompare(a.work_date));

  const openReport = openReportId ? reports.find((r) => r.id === openReportId) ?? null : null;

  function exportCsv() {
    const rows: (string | number)[][] = [
      ['Date', 'Employee', 'F2F', 'Site Visits', 'Revisits', 'Calls', 'Connected', 'Talk (min)', 'Leads', 'Meetings Fixed', 'Bookings', 'Score', 'Achievement %', 'Min Criteria Met', 'Manager Feedback'],
      ...filtered.map((r) => [
        r.work_date, employeeName(empById.get(r.employee_id)), r.f2f_done, r.sv_done, r.revisit_done,
        r.calls_done, r.conn_done, r.talk_done, r.leads, r.meetings_fixed, r.bookings,
        r.score != null ? Math.round(r.score) : '', r.achievement_pct ?? '', r.min_criteria_met ? 'Yes' : 'No', r.manager_comment ?? '',
      ]),
    ];
    csvDownload(`performance-tracker-${range.start}-to-${range.end}.csv`, rows);
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
          <input type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} className="rounded-lg bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
          <input type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} className="rounded-lg bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40" />
        </div>
        {teams.length > 0 && <div className="w-44"><SelectField label="Team" value={teamFilter} onChange={setTeamFilter} options={[{ value: '', label: 'All Teams' }, ...teams.map((t) => ({ value: t.id, label: t.name }))]} /></div>}
        <div className="w-44"><SelectField label="Department" value={deptFilter} onChange={setDeptFilter} options={[{ value: '', label: 'All Departments' }, ...departments.map((d) => ({ value: d.id, label: d.department_name }))]} /></div>
        <button onClick={exportCsv} disabled={filtered.length === 0} className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
          <IconDocument className="h-3.5 w-3.5" />Export CSV
        </button>
      </Card>

      <Card className="overflow-hidden">
        {loading ? <div className="p-8"><LoadingBlock /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-4 py-2 font-medium">F2F</th>
                  <th className="px-4 py-2 font-medium">Bookings</th>
                  <th className="px-4 py-2 font-medium">Score</th>
                  <th className="px-4 py-2 font-medium">Achievement</th>
                  <th className="px-4 py-2 font-medium">Min Criteria</th>
                  <th className="px-4 py-2 font-medium">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} onClick={() => setOpenReportId(r.id)} className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-700">{r.work_date}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{employeeName(empById.get(r.employee_id))}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{r.f2f_done}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{r.bookings}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{r.score != null ? Math.round(r.score) : '—'}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{r.achievement_pct != null ? `${r.achievement_pct}%` : '—'}</td>
                    <td className="px-4 py-2">{r.min_criteria_met ? '✓' : r.min_criteria_met === false ? '✗' : '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{r.manager_comment ? '💬' : '—'}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-600">No reports in this range.</td></tr>}
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
    </div>
  );
}
