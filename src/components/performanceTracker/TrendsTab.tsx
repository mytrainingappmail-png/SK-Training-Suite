// src/components/performanceTracker/TrendsTab.tsx
//
// Personal history: a day-by-day score chart for the last 14 days, a
// GitHub-style streak heatmap for the last 90, and how this person's
// average achievement compares to the company's — managers can
// additionally pick any employee to view theirs.

import { useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadMyReportsForRange, loadReportsForRange } from '../../services/performanceTracker/performanceTrackerService';
import { fmtDate, avgAchievement } from '../../utils/performanceTrackerUtils';
import type { Employee } from '../../types/employee';
import type { PtTeam, PtReport } from '../../types/performanceTracker';
import { Card, SelectField, LoadingBlock, employeeName } from './ptUi';

const CHART_DAYS = 14;
const HEATMAP_DAYS = 91; // 13 full weeks

export function TrendsTab({ employees, teams, teamMap, isManagerUp }: {
  employees: Employee[]; teams: PtTeam[]; teamMap: Record<string, string | null>; isManagerUp: boolean;
}) {
  const user = getCurrentUser();
  const [empId, setEmpId] = useState(user?.id ?? '');
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<PtReport[]>([]);
  const [companyReports, setCompanyReports] = useState<PtReport[]>([]);

  const chartRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (CHART_DAYS - 1));
    return { start: fmtDate(start), end: fmtDate(end) };
  }, []);

  const heatmapRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (HEATMAP_DAYS - 1));
    return { start: fmtDate(start), end: fmtDate(end) };
  }, []);

  useEffect(() => {
    if (!empId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      loadMyReportsForRange(empId, heatmapRange.start, heatmapRange.end),
      user?.companyId ? loadReportsForRange(user.companyId, chartRange.start, chartRange.end) : Promise.resolve([]),
    ]).then(([r, cr]) => { if (!cancelled) { setReports(r); setCompanyReports(cr); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [empId, heatmapRange.start, heatmapRange.end, chartRange.start, chartRange.end, user?.companyId]);

  const chartDays = useMemo(() => {
    const out: { date: string; report: PtReport | null }[] = [];
    for (let i = 0; i < CHART_DAYS; i++) {
      const d = new Date(chartRange.start);
      d.setDate(d.getDate() + i);
      const dateStr = fmtDate(d);
      out.push({ date: dateStr, report: reports.find((r) => r.work_date === dateStr) ?? null });
    }
    return out;
  }, [chartRange.start, reports]);

  const heatmapDays = useMemo(() => {
    const out: { date: string; report: PtReport | null }[] = [];
    for (let i = 0; i < HEATMAP_DAYS; i++) {
      const d = new Date(heatmapRange.start);
      d.setDate(d.getDate() + i);
      const dateStr = fmtDate(d);
      out.push({ date: dateStr, report: reports.find((r) => r.work_date === dateStr) ?? null });
    }
    return out;
  }, [heatmapRange.start, reports]);

  const streak = useMemo(() => {
    let count = 0;
    for (let i = heatmapDays.length - 1; i >= 0; i--) {
      if (heatmapDays[i].report?.min_criteria_met) count++;
      else break;
    }
    return count;
  }, [heatmapDays]);

  const avgAch = useMemo(() => {
    const inChartRange = reports.filter((r) => r.work_date >= chartRange.start);
    const vals = inChartRange.map((r) => r.achievement_pct).filter((v): v is number => v != null);
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
  }, [reports, chartRange.start]);

  const companyAvgAch = useMemo(() => avgAchievement(companyReports), [companyReports]);
  const vsCompany = avgAch != null ? Math.round((avgAch - companyAvgAch) * 10) / 10 : null;

  const reportsInChart = reports.filter((r) => r.work_date >= chartRange.start).length;
  const maxScore = Math.max(...chartDays.map((d) => d.report?.score ?? 0), 1);
  const emp = employees.find((e) => e.id === empId);

  function heatColor(day: { report: PtReport | null }): string {
    if (!day.report) return 'bg-slate-100';
    if (day.report.min_criteria_met) return 'bg-emerald-500';
    return 'bg-amber-400';
  }

  // Group heatmap days into weeks (columns), Monday-first.
  const heatmapWeeks = useMemo(() => {
    const weeks: { date: string; report: PtReport | null }[][] = [];
    let week: { date: string; report: PtReport | null }[] = [];
    const firstDow = (new Date(heatmapDays[0].date).getDay() + 6) % 7; // 0 = Monday
    for (let i = 0; i < firstDow; i++) week.push({ date: '', report: null });
    for (const d of heatmapDays) {
      week.push(d);
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) { while (week.length < 7) week.push({ date: '', report: null }); weeks.push(week); }
    return weeks;
  }, [heatmapDays]);

  return (
    <div className="space-y-4">
      {isManagerUp && (
        <div className="w-64">
          <SelectField
            label="" value={empId} onChange={setEmpId}
            options={employees.filter((e) => e.active).map((e) => ({
              value: e.id, label: `${employeeName(e)}${teamMap[e.id] ? ` — ${teams.find((t) => t.id === teamMap[e.id])?.name ?? ''}` : ''}`,
            }))}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-slate-600">Current Streak</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-600">{streak} day{streak === 1 ? '' : 's'}</p>
          <p className="mt-1 text-xs text-slate-600">consecutive days meeting min criteria</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-600">Avg. Achievement ({CHART_DAYS}d)</p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900">{avgAch != null ? `${avgAch}%` : '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-600">vs Company Average</p>
          <p className={`mt-1 font-mono text-2xl font-bold ${vsCompany == null ? 'text-slate-900' : vsCompany >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {vsCompany == null ? '—' : `${vsCompany >= 0 ? '+' : ''}${vsCompany} pts`}
          </p>
          <p className="mt-1 text-xs text-slate-600">company avg {companyAvgAch}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-600">Evening Reports Filed</p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900">{reportsInChart} <span className="text-sm font-normal text-slate-600">/ {CHART_DAYS}</span></p>
        </Card>
      </div>

      <Card className="p-5">
        <p className="mb-4 text-sm font-semibold text-slate-900">{emp ? `${employeeName(emp)}'s` : 'Your'} Score — Last {CHART_DAYS} Days</p>
        {loading ? <LoadingBlock /> : (
          <div className="flex items-end gap-1.5" style={{ height: 120 }}>
            {chartDays.map((d) => {
              const score = d.report?.score ?? 0;
              const h = Math.max(3, (score / maxScore) * 100);
              const met = d.report?.min_criteria_met;
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5" title={`${d.date}: ${d.report ? `${Math.round(score)} pts` : 'No report'}`}>
                  <div className={`w-full rounded-t-md ${d.report ? (met ? 'bg-emerald-500' : 'bg-amber-400') : 'bg-slate-100'}`} style={{ height: `${h}px` }} />
                  <span className="text-[9px] text-slate-600">{new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric' })}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <p className="mb-4 text-sm font-semibold text-slate-900">Streak Heatmap — Last 13 Weeks</p>
        {loading ? <LoadingBlock /> : (
          <div className="overflow-x-auto">
            <div className="flex gap-1">
              {heatmapWeeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                  {week.map((d, di) => (
                    <div
                      key={di}
                      title={d.date ? `${d.date}: ${d.report ? (d.report.min_criteria_met ? 'Criteria met' : 'Below criteria') : 'No report'}` : ''}
                      className={`h-3 w-3 rounded-sm ${d.date ? heatColor(d) : 'bg-transparent'}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Min criteria met</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />Below criteria</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-100" />No report filed</span>
        </div>
      </Card>
    </div>
  );
}
