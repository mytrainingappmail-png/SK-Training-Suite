// src/components/performanceTracker/LeaderboardTab.tsx

import { useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import {
  loadReportsForRange, loadChampionCategories, leaderboardValue, championMetricTotal, championMetricUnit,
} from '../../services/performanceTracker/performanceTrackerService';
import { rangeForPeriod, periodLabel, PERIOD_OPTIONS, avgAchievement } from '../../utils/performanceTrackerUtils';
import type { PtPeriod } from '../../utils/performanceTrackerUtils';
import type { Employee } from '../../types/employee';
import type { PtTeam, PtReport, PtSettings, PtLeaderboardFormula, PtChampionCategory } from '../../types/performanceTracker';
import { Card, SelectField, Badge, LoadingBlock, employeeName } from './ptUi';
import { IconTrophy, IconAward, IconTv } from './ptIcons';
import { ROUTES } from '../../constants/routes';

const FORMULA_OPTIONS: { value: PtLeaderboardFormula; label: string }[] = [
  { value: 'achievement', label: 'Achievement % (Recommended)' },
  { value: 'score', label: 'Total Score Points' },
  { value: 'bookings', label: 'Bookings Generated' },
  { value: 'composite', label: 'Composite (60% Achievement + 40% Score)' },
];

export function LeaderboardTab({ employees, teams, teamMap, settings, isManagerUp }: {
  employees: Employee[]; teams: PtTeam[]; teamMap: Record<string, string | null>; settings: PtSettings; isManagerUp: boolean;
}) {
  const user = getCurrentUser();
  const [period, setPeriod] = useState<PtPeriod>('monthly');
  const range = useMemo(() => rangeForPeriod(period), [period]);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<PtReport[]>([]);
  const [metric, setMetric] = useState<PtLeaderboardFormula>(settings.leaderboard_formula);
  const [teamFilter, setTeamFilter] = useState('');
  const [categories, setCategories] = useState<PtChampionCategory[]>([]);

  useEffect(() => {
    if (!user?.companyId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      loadReportsForRange(user.companyId, range.start, range.end),
      loadChampionCategories(user.companyId),
    ]).then(([r, cats]) => { if (!cancelled) { setReports(r); setCategories(cats); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.companyId, range.start, range.end]);

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const execRanked = useMemo(() => {
    const byEmp = new Map<string, PtReport[]>();
    for (const r of reports) {
      if (teamFilter && teamMap[r.employee_id] !== teamFilter) continue;
      if (!byEmp.has(r.employee_id)) byEmp.set(r.employee_id, []);
      byEmp.get(r.employee_id)!.push(r);
    }
    const rows = Array.from(byEmp.entries()).map(([empId, reps]) => {
      const emp = empById.get(empId);
      const agg = { score: reps.reduce((s, r) => s + (r.score ?? 0), 0), bookings: reps.reduce((s, r) => s + r.bookings, 0), achievement_pct: avgAchievement(reps) };
      return { empId, name: employeeName(emp), team: teams.find((t) => t.id === teamMap[empId])?.name ?? '—', value: leaderboardValue(agg, metric) };
    });
    return rows.sort((a, b) => b.value - a.value).slice(0, 10);
  }, [reports, empById, teams, teamMap, teamFilter, metric]);

  const teamRanked = useMemo(() => {
    const byTeam = new Map<string, PtReport[]>();
    for (const r of reports) {
      const teamName = teams.find((t) => t.id === teamMap[r.employee_id])?.name ?? 'Unassigned';
      if (!byTeam.has(teamName)) byTeam.set(teamName, []);
      byTeam.get(teamName)!.push(r);
    }
    const rows = Array.from(byTeam.entries()).map(([name, reps]) => ({
      name, avgAchievement: avgAchievement(reps), totalScore: Math.round(reps.reduce((s, r) => s + (r.score ?? 0), 0)), totalBookings: reps.reduce((s, r) => s + r.bookings, 0),
    }));
    return rows.sort((a, b) => b.avgAchievement - a.avgAchievement);
  }, [reports, teams, teamMap]);

  const champions = useMemo(() => {
    const byEmp = new Map<string, PtReport[]>();
    for (const r of reports) {
      if (!byEmp.has(r.employee_id)) byEmp.set(r.employee_id, []);
      byEmp.get(r.employee_id)!.push(r);
    }
    return categories.filter((c) => c.is_active).map((cat) => {
      let best: { empId: string; value: number } | null = null;
      for (const [empId, reps] of byEmp.entries()) {
        const value = championMetricTotal(reps, cat.metric_key);
        if (!best || value > best.value) best = { empId, value };
      }
      const emp = best ? empById.get(best.empId) : null;
      return { category: cat, empName: emp ? employeeName(emp) : null, value: best?.value ?? 0 };
    });
  }, [categories, reports, empById]);

  const label = periodLabel(period, range);
  const fmtVal = (v: number) => (metric === 'score' ? Math.round(v) : metric === 'bookings' ? v : `${Math.round(v * 10) / 10}%`);

  if (loading) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-slate-100 p-0.5">
          {PERIOD_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => setPeriod(o.value)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${period === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="w-64"><SelectField label="" value={metric} onChange={setMetric} options={FORMULA_OPTIONS} /></div>
        {isManagerUp && teams.length > 0 && (
          <div className="w-44"><SelectField label="" value={teamFilter} onChange={setTeamFilter} options={[{ value: '', label: 'All Teams' }, ...teams.map((t) => ({ value: t.id, label: t.name }))]} /></div>
        )}
        <span className="text-xs text-slate-500">{label}</span>
        {isManagerUp && (
          <a href={ROUTES.PERFORMANCE_TRACKER_TV} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700">
            <IconTv className="h-3.5 w-3.5" />Open TV Mode
          </a>
        )}
      </div>

      {champions.length > 0 && (
        <Card className="border-amber-100 bg-gradient-to-br from-amber-50 via-white to-white p-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900"><IconAward className="h-4 w-4 text-amber-500" />Champions — {label}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {champions.map((c) => (
              <div key={c.category.id} className="rounded-xl border border-amber-100 bg-white p-3.5 text-center shadow-sm">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">{c.category.label}</p>
                <p className="truncate text-sm font-bold text-slate-900">{c.empName ?? '—'}</p>
                <p className="font-mono text-xs text-slate-600">{c.value}{championMetricUnit(c.category.metric_key)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><IconTrophy className="h-3.5 w-3.5 text-amber-500" />Top 10 Executives</span>
            <Badge tone="pending">By {FORMULA_OPTIONS.find((f) => f.value === metric)?.label.split(' (')[0]}</Badge>
          </div>
          <div className="p-2">
            {execRanked.map((r, i) => (
              <div key={r.empId} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50">
                <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500'}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.team}</p>
                </div>
                <span className="font-mono text-sm font-semibold text-emerald-700">{fmtVal(r.value)}</span>
              </div>
            ))}
            {execRanked.length === 0 && <p className="py-8 text-center text-xs text-slate-500">No submissions for this period.</p>}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Team Rankings</div>
          <div className="p-2">
            {teamRanked.map((t, i) => (
              <div key={t.name} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50">
                <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.totalScore} pts · {t.totalBookings} bookings</p>
                </div>
                <span className="font-mono text-sm font-semibold text-emerald-700">{t.avgAchievement}%</span>
              </div>
            ))}
            {teamRanked.length === 0 && <p className="py-8 text-center text-xs text-slate-500">No data yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
