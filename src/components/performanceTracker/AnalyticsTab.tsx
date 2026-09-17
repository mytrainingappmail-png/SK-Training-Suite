// src/components/performanceTracker/AnalyticsTab.tsx
//
// Manager-level aggregate view — company-wide KPIs, department breakdown,
// and top/bottom performers over a selectable period.

import { useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadReportsForRange } from '../../services/performanceTracker/performanceTrackerService';
import { rangeForPeriod, periodLabel, PERIOD_OPTIONS, avgAchievement } from '../../utils/performanceTrackerUtils';
import type { PtPeriod } from '../../utils/performanceTrackerUtils';
import type { Employee } from '../../types/employee';
import type { Department } from '../../types/department';
import type { PtReport } from '../../types/performanceTracker';
import { Card, LoadingBlock, employeeName } from './ptUi';

export function AnalyticsTab({ employees, departments }: { employees: Employee[]; departments: Department[] }) {
  const user = getCurrentUser();
  const [period, setPeriod] = useState<PtPeriod>('monthly');
  const range = useMemo(() => rangeForPeriod(period), [period]);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<PtReport[]>([]);

  useEffect(() => {
    if (!user?.companyId) return;
    let cancelled = false;
    setLoading(true);
    loadReportsForRange(user.companyId, range.start, range.end)
      .then((r) => { if (!cancelled) setReports(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.companyId, range.start, range.end]);

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const byEmp = useMemo(() => {
    const m = new Map<string, PtReport[]>();
    for (const r of reports) {
      if (!m.has(r.employee_id)) m.set(r.employee_id, []);
      m.get(r.employee_id)!.push(r);
    }
    return m;
  }, [reports]);

  const perEmployee = useMemo(() => Array.from(byEmp.entries()).map(([empId, reps]) => ({
    empId, name: employeeName(empById.get(empId)),
    avgAchievement: avgAchievement(reps), totalScore: Math.round(reps.reduce((s, r) => s + (r.score ?? 0), 0)), totalBookings: reps.reduce((s, r) => s + r.bookings, 0),
    daysFiled: reps.length,
  })).sort((a, b) => b.avgAchievement - a.avgAchievement), [byEmp, empById]);

  // With fewer than ~10 people who've filed a report, a plain top-5/bottom-5
  // slice shows the SAME people in both cards (just reordered) — exclude
  // whoever's already in Top 5 from the "Needs Attention" list instead of
  // just re-slicing from the other end.
  const top5 = perEmployee.slice(0, 5);
  const topIds = new Set(top5.map((p) => p.empId));
  const bottom5 = [...perEmployee].reverse().filter((p) => !topIds.has(p.empId)).slice(0, 5);

  const deptChart = useMemo(() => {
    const byDept = new Map<string, number[]>();
    for (const [empId, reps] of byEmp.entries()) {
      const dname = departments.find((d) => d.id === empById.get(empId)?.department_id)?.department_name ?? 'Unassigned';
      const ach = avgAchievement(reps);
      if (!byDept.has(dname)) byDept.set(dname, []);
      byDept.get(dname)!.push(ach);
    }
    return Array.from(byDept.entries()).map(([label, vals]) => ({ label, value: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 }));
  }, [byEmp, empById, departments]);
  const deptMax = Math.max(...deptChart.map((d) => d.value), 1);

  const label = periodLabel(period, range);
  const totalBookings = reports.reduce((s, r) => s + r.bookings, 0);
  const totalScore = Math.round(reports.reduce((s, r) => s + (r.score ?? 0), 0));
  const overallAch = avgAchievement(reports);
  const activeCount = employees.filter((e) => e.active).length;
  const submissionRate = activeCount > 0 ? Math.round((byEmp.size / activeCount) * 100) : 0;

  if (loading) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-slate-100 p-0.5">
          {PERIOD_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => setPeriod(o.value)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${period === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>{o.label}</button>
          ))}
        </div>
        <span className="text-xs text-slate-500">{label}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-slate-600">Avg. Achievement</p><p className="mt-1 font-mono text-2xl font-bold text-emerald-600">{overallAch}%</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-600">Total Score</p><p className="mt-1 font-mono text-2xl font-bold text-slate-900">{totalScore}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-600">Total Bookings</p><p className="mt-1 font-mono text-2xl font-bold text-slate-900">{totalBookings}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-600">Participation</p><p className="mt-1 font-mono text-2xl font-bold text-slate-900">{submissionRate}%</p><p className="mt-1 text-xs text-slate-500">{byEmp.size} of {activeCount} filed at least once</p></Card>
      </div>

      <Card className="p-5">
        <p className="mb-3 text-sm font-semibold text-slate-900">Department-wise Achievement — {label}</p>
        {deptChart.length > 0 ? (
          <div className="space-y-2.5">
            {deptChart.map((d) => (
              <div key={d.label} className="flex items-center gap-3">
                <span className="w-32 flex-shrink-0 truncate text-xs text-slate-600">{d.label}</span>
                <div className="h-2.5 flex-1 rounded-full bg-slate-100"><div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${Math.max(4, (d.value / deptMax) * 100)}%` }} /></div>
                <span className="w-14 flex-shrink-0 text-right font-mono text-xs font-semibold text-slate-700">{d.value}%</span>
              </div>
            ))}
          </div>
        ) : <p className="py-10 text-center text-xs text-slate-500">No data for this period.</p>}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Top 5 Performers</div>
          <div className="p-2">
            {top5.map((p) => (
              <div key={p.empId} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{p.name}</span>
                <span className="font-mono font-semibold text-emerald-700">{p.avgAchievement}%</span>
              </div>
            ))}
            {perEmployee.length === 0 && <p className="py-8 text-center text-xs text-slate-500">No data yet.</p>}
          </div>
        </Card>
        <Card>
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Needs Attention (Bottom 5)</div>
          <div className="p-2">
            {bottom5.map((p) => (
              <div key={p.empId} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{p.name}</span>
                <span className="font-mono font-semibold text-rose-600">{p.avgAchievement}%</span>
              </div>
            ))}
            {perEmployee.length === 0 && <p className="py-8 text-center text-xs text-slate-500">No data yet.</p>}
            {perEmployee.length > 0 && bottom5.length === 0 && <p className="py-8 text-center text-xs text-slate-500">Not enough separate data yet — everyone who's filed is already in Top Performers.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
