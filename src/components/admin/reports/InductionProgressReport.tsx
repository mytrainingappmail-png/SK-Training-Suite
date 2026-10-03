// Reports → Induction: how far each employee in induction has got — for the company's admin and
// trainers. Which day they are on, how many days and tests they have finished, how many cards of the
// current day they have opened, when they were last active, and who looks stuck.

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { loadInductionReportData } from '../../../repositories/induction/inductionReportRepository';
import type { InductionReportData } from '../../../repositories/induction/inductionReportRepository';
import { resolveForBranch } from '../../../utils/branchScoping';
import { dayLabels, withLabel } from '../../../utils/inductionDayLabel';
import { csvEscape, downloadCsvFile } from '../../../services/quiz/quizCsvService';

type Status = 'completed' | 'in_progress' | 'not_started' | 'stuck';

const STUCK_AFTER_DAYS = 3;
const DAY_MS = 86_400_000;

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  in_progress: { label: 'In progress', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  not_started: { label: 'Not started', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  stuck: { label: `No activity ${STUCK_AFTER_DAYS}+ days`, cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
};

interface DayDetail { dayId: string; title: string; label: string; completedAt: string | null; testsPassed: number; testsTotal: number; opened: number; reading: number }
interface Row {
  employeeId: string;
  name: string;
  code: string;
  branch: string;
  status: Status;
  daysDone: number;
  daysTotal: number;
  currentDay: string;
  testsPassed: number;
  testsTotal: number;
  lastActivity: string | null;
  details: DayDetail[];
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const d = Math.floor((Date.now() - Date.parse(iso)) / DAY_MS);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}

function buildRows(data: InductionReportData): Row[] {
  const branchName = new Map(data.branches.map((b) => [b.id, b.branch_name]));
  const emp = new Map(data.employees.map((e) => [e.id, e]));
  const sectionsByDay = new Map<string, typeof data.sections>();
  for (const s of data.sections) sectionsByDay.set(s.day_id, [...(sectionsByDay.get(s.day_id) ?? []), s]);
  const viewed = new Map<string, Set<string>>();
  const lastView = new Map<string, string>();
  for (const v of data.views) {
    if (!viewed.has(v.employee_id)) viewed.set(v.employee_id, new Set());
    viewed.get(v.employee_id)!.add(v.section_id);
    if (!lastView.has(v.employee_id) || v.viewed_at > lastView.get(v.employee_id)!) lastView.set(v.employee_id, v.viewed_at);
  }
  const passed = new Set(data.passes.map((p) => `${p.employee_id}:${p.assessment_id}`));

  return data.assignments
    .map((a): Row | null => {
      const e = emp.get(a.employee_id);
      if (!e) return null;
      const days = resolveForBranch(data.days, e.branch_id).filter((d) => d.active).sort((x, y) => x.display_order - y.display_order);
      const doneAt = new Map(data.completions.filter((c) => c.employee_id === e.id).map((c) => [c.day_id, c.completed_at]));
      const myViews = viewed.get(e.id) ?? new Set<string>();

      const labels = dayLabels(days);
      const details: DayDetail[] = days.map((d, i) => {
        const secs = sectionsByDay.get(d.id) ?? [];
        const tests = secs.filter((s) => s.section_type === 'test' && s.assessment_id);
        const reading = secs.filter((s) => s.section_type !== 'test');
        return {
          dayId: d.id, title: d.title, label: labels[i], completedAt: doneAt.get(d.id) ?? null,
          testsPassed: tests.filter((t) => passed.has(`${e.id}:${t.assessment_id}`)).length, testsTotal: tests.length,
          opened: reading.filter((s) => myViews.has(s.id)).length, reading: reading.length,
        };
      });

      const daysDone = details.filter((d) => d.completedAt).length;
      const current = details.find((d) => !d.completedAt) ?? null;
      const activityDates = [...doneAt.values(), lastView.get(e.id)].filter((x): x is string => !!x).sort();
      const lastActivity = activityDates.length ? activityDates[activityDates.length - 1] : null;

      let status: Status;
      if (a.status === 'completed' || (details.length > 0 && daysDone === details.length)) status = 'completed';
      else if (!lastActivity) status = 'not_started';
      else if (Date.now() - Date.parse(lastActivity) >= STUCK_AFTER_DAYS * DAY_MS) status = 'stuck';
      else status = 'in_progress';

      return {
        employeeId: e.id,
        name: `${e.first_name} ${e.last_name ?? ''}`.trim(),
        code: e.employee_code,
        branch: e.branch_id ? branchName.get(e.branch_id) ?? '' : '',
        status,
        daysDone,
        daysTotal: details.length,
        currentDay: current ? withLabel(current.label, current.title) : details.length ? 'All days done' : '—',
        testsPassed: details.reduce((n, d) => n + d.testsPassed, 0),
        testsTotal: details.reduce((n, d) => n + d.testsTotal, 0),
        lastActivity,
        details,
      };
    })
    .filter((r): r is Row => r !== null)
    .sort((x, y) => (x.status === 'stuck' ? -1 : 0) - (y.status === 'stuck' ? -1 : 0) || x.name.localeCompare(y.name));
}

export default function InductionProgressReport() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setRows(buildRows(await loadInductionReportData())); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load the induction report.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { completed: 0, in_progress: 0, not_started: 0, stuck: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (filter === 'all' || r.status === filter) && (!q || `${r.name} ${r.code} ${r.branch}`.toLowerCase().includes(q)));
  }, [rows, filter, search]);

  function exportCsv() {
    const head = ['Employee', 'Code', 'Branch', 'Status', 'Days done', 'Days total', 'Current day', 'Tests passed', 'Tests total', 'Last activity'];
    const lines = shown.map((r) => [r.name, r.code, r.branch, STATUS_META[r.status].label, String(r.daysDone), String(r.daysTotal), r.currentDay, String(r.testsPassed), String(r.testsTotal), r.lastActivity ?? '']);
    downloadCsvFile(`induction-progress-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...lines].map((l) => l.map(csvEscape).join(',')).join('\r\n'));
  }

  return (
    <div className="space-y-5 p-6">
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([['in_progress', 'In progress'], ['stuck', `No activity ${STUCK_AFTER_DAYS}+ days`], ['not_started', 'Not started'], ['completed', 'Completed']] as [Status, string][]).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(filter === k ? 'all' : k)}
            className={`rounded-2xl border p-4 text-left shadow-sm transition ${filter === k ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-800">{counts[k]}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee, code or branch…"
          className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-yellow-400 focus:bg-white" />
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Refresh</button>
          <button type="button" onClick={exportCsv} disabled={shown.length === 0} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40">Export CSV</button>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">{rows.length === 0 ? 'Nobody is in induction yet. Add employees in Admin → Induction.' : 'No one matches this filter.'}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Progress</th><th className="px-4 py-3">Current day</th><th className="px-4 py-3">Tests</th><th className="px-4 py-3">Last activity</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((r) => (
                <Fragment key={r.employeeId}>
                  <tr onClick={() => setOpen(open === r.employeeId ? null : r.employeeId)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-3"><p className="font-semibold text-slate-800">{r.name}</p><p className="text-xs text-slate-400">{r.code}{r.branch ? ` · ${r.branch}` : ''}</p></td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_META[r.status].cls}`}>{STATUS_META[r.status].label}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.daysTotal ? Math.round((r.daysDone / r.daysTotal) * 100) : 0}%` }} /></div>
                        <span className="text-xs text-slate-600">{r.daysDone}/{r.daysTotal} days</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.currentDay}</td>
                    <td className="px-4 py-3 text-slate-700">{r.testsTotal ? `${r.testsPassed}/${r.testsTotal} passed` : '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{ago(r.lastActivity)}</td>
                  </tr>
                  {open === r.employeeId && (
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {r.details.map((d) => (
                            <div key={d.dayId} className={`rounded-xl border p-3 text-xs ${d.completedAt ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                              <p className="font-semibold text-slate-800">{withLabel(d.label, d.title)}</p>
                              <p className="mt-1 text-slate-600">{d.completedAt ? `✓ Completed ${fmt(d.completedAt)}` : 'Not completed yet'}</p>
                              {d.reading > 0 && <p className="text-slate-500">Cards opened: {d.opened}/{d.reading}</p>}
                              {d.testsTotal > 0 && <p className="text-slate-500">Test: {d.testsPassed}/{d.testsTotal} passed</p>}
                            </div>
                          ))}
                          {r.details.length === 0 && <p className="text-xs text-slate-400">No active induction days for this employee's branch.</p>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
