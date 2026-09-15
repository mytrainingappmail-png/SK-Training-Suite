// src/components/performanceTracker/PerformanceTrackerTvMode.tsx
//
// Full-bleed, no-chrome auto-rotating leaderboard for an office TV/monitor
// — not a day-to-day screen. Cycles Top Performers -> Team Rankings ->
// Champions every few seconds, and refreshes its data periodically so it
// can run unattended all day. Reuses the normal employee session (no
// separate login) — reached via "Open TV Mode" on the Leaderboard tab.

import { useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadCompany } from '../../services/company/companyService';
import {
  loadTeams, loadEmployeeTeamMap, loadChampionCategories,
  loadReportsForRange, leaderboardValue, championMetricTotal, championMetricUnit,
} from '../../services/performanceTracker/performanceTrackerService';
import { employeeService } from '../../services/employee/employeeService';
import { rangeForPeriod, avgAchievement } from '../../utils/performanceTrackerUtils';
import type { Employee } from '../../types/employee';
import type { Company } from '../../types/company';
import type { PtTeam, PtReport, PtChampionCategory } from '../../types/performanceTracker';
import { employeeName } from './ptUi';
import { IconTrophy, IconAward, IconUsers } from './ptIcons';

const ROTATE_SECONDS = 12;
const REFRESH_MS = 60_000;
const VIEWS = ['executives', 'teams', 'champions'] as const;

export function PerformanceTrackerTvMode() {
  const user = getCurrentUser();
  const [company, setCompany] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teams, setTeams] = useState<PtTeam[]>([]);
  const [teamMap, setTeamMap] = useState<Record<string, string | null>>({});
  const [categories, setCategories] = useState<PtChampionCategory[]>([]);
  const [reports, setReports] = useState<PtReport[]>([]);
  const [view, setView] = useState<typeof VIEWS[number]>('executives');
  const [tick, setTick] = useState(0);

  const range = useMemo(() => rangeForPeriod('weekly'), []);

  useEffect(() => {
    if (!user?.companyId) return;
    let cancelled = false;
    Promise.all([
      loadCompany(), employeeService.getAll(), loadTeams(user.companyId),
      loadEmployeeTeamMap(user.companyId), loadChampionCategories(user.companyId),
      loadReportsForRange(user.companyId, range.start, range.end),
    ]).then(([co, emps, tms, tmap, cats, reps]) => {
      if (cancelled) return;
      setCompany(co); setEmployees(emps); setTeams(tms); setTeamMap(tmap); setCategories(cats); setReports(reps);
    });
    return () => { cancelled = true; };
  }, [user?.companyId, range.start, range.end, tick]);

  useEffect(() => {
    const refresh = setInterval(() => setTick((t) => t + 1), REFRESH_MS);
    return () => clearInterval(refresh);
  }, []);

  // Depends on `view` so that ANY change to it — the timer's own tick, or
  // a manual dot click below — clears and restarts this interval fresh.
  // Without that dependency, a manual click only changed `view`; this
  // interval kept counting down on its own original schedule underneath,
  // so the next auto-rotation could fire almost immediately afterward
  // (or, from the user's side, a click seemed to do nothing until the
  // pre-existing timer eventually caught up on its own unrelated clock).
  useEffect(() => {
    const rotate = setInterval(() => setView((v) => VIEWS[(VIEWS.indexOf(v) + 1) % VIEWS.length]), ROTATE_SECONDS * 1000);
    return () => clearInterval(rotate);
  }, [view]);

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const execRanked = useMemo(() => {
    const byEmp = new Map<string, PtReport[]>();
    for (const r of reports) {
      if (!byEmp.has(r.employee_id)) byEmp.set(r.employee_id, []);
      byEmp.get(r.employee_id)!.push(r);
    }
    return Array.from(byEmp.entries()).map(([empId, reps]) => {
      const agg = { score: reps.reduce((s, r) => s + (r.score ?? 0), 0), bookings: reps.reduce((s, r) => s + r.bookings, 0), achievement_pct: avgAchievement(reps) };
      return { empId, name: employeeName(empById.get(empId)), team: teams.find((t) => t.id === teamMap[empId])?.name ?? '—', value: leaderboardValue(agg, 'achievement') };
    }).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [reports, empById, teams, teamMap]);

  const teamRanked = useMemo(() => {
    const byTeam = new Map<string, PtReport[]>();
    for (const r of reports) {
      const teamName = teams.find((t) => t.id === teamMap[r.employee_id])?.name ?? 'Unassigned';
      if (!byTeam.has(teamName)) byTeam.set(teamName, []);
      byTeam.get(teamName)!.push(r);
    }
    return Array.from(byTeam.entries()).map(([name, reps]) => ({ name, avgAchievement: avgAchievement(reps), totalBookings: reps.reduce((s, r) => s + r.bookings, 0) }))
      .sort((a, b) => b.avgAchievement - a.avgAchievement);
  }, [reports, teams, teamMap]);

  const champions = useMemo(() => {
    const byEmp = new Map<string, PtReport[]>();
    for (const r of reports) { if (!byEmp.has(r.employee_id)) byEmp.set(r.employee_id, []); byEmp.get(r.employee_id)!.push(r); }
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

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-10 py-8 text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {company?.logo && <img src={company.logo} alt="" className="h-12 w-12 rounded-xl object-contain" />}
          <div>
            <h1 className="text-2xl font-bold">{company?.company_name ?? 'Performance Tracker'}</h1>
            <p className="text-sm text-emerald-300">This Week's Leaderboard — updates automatically</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm">
          <IconTrophy className="h-4 w-4 text-amber-400" />Performance Tracker
        </div>
      </div>

      <div className="mt-10 flex-1">
        {view === 'executives' && (
          <div>
            <h2 className="mb-6 flex items-center gap-3 text-3xl font-bold"><IconTrophy className="h-8 w-8 text-amber-400" />Top Performers</h2>
            <div className="grid grid-cols-2 gap-4">
              {execRanked.map((r, i) => (
                <div key={r.empId} className={`flex items-center gap-4 rounded-2xl p-5 ${i === 0 ? 'bg-gradient-to-r from-amber-500/30 to-transparent ring-1 ring-amber-400/50' : 'bg-white/5'}`}>
                  <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-xl font-bold ${i === 0 ? 'bg-amber-400 text-slate-900' : i === 1 ? 'bg-slate-300 text-slate-900' : i === 2 ? 'bg-orange-400 text-slate-900' : 'bg-white/10'}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-semibold">{r.name}</p>
                    <p className="text-sm text-slate-400">{r.team}</p>
                  </div>
                  <span className="font-mono text-2xl font-bold text-emerald-400">{Math.round(r.value * 10) / 10}%</span>
                </div>
              ))}
              {execRanked.length === 0 && <p className="col-span-2 py-16 text-center text-xl text-slate-400">No submissions yet this week.</p>}
            </div>
          </div>
        )}

        {view === 'teams' && (
          <div>
            <h2 className="mb-6 flex items-center gap-3 text-3xl font-bold"><IconUsers className="h-8 w-8 text-emerald-400" />Team Rankings</h2>
            <div className="grid grid-cols-2 gap-4">
              {teamRanked.map((t, i) => (
                <div key={t.name} className={`flex items-center gap-4 rounded-2xl p-6 ${i === 0 ? 'bg-gradient-to-r from-emerald-500/30 to-transparent ring-1 ring-emerald-400/50' : 'bg-white/5'}`}>
                  <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-xl font-bold ${i === 0 ? 'bg-emerald-400 text-slate-900' : 'bg-white/10'}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-semibold">{t.name}</p>
                    <p className="text-sm text-slate-400">{t.totalBookings} bookings this week</p>
                  </div>
                  <span className="font-mono text-2xl font-bold text-emerald-400">{t.avgAchievement}%</span>
                </div>
              ))}
              {teamRanked.length === 0 && <p className="col-span-2 py-16 text-center text-xl text-slate-400">No submissions yet this week.</p>}
            </div>
          </div>
        )}

        {view === 'champions' && (
          <div>
            <h2 className="mb-6 flex items-center gap-3 text-3xl font-bold"><IconAward className="h-8 w-8 text-amber-400" />This Week's Champions</h2>
            <div className="grid grid-cols-2 gap-6">
              {champions.map((c) => (
                <div key={c.category.id} className="rounded-2xl bg-gradient-to-br from-amber-500/20 via-white/5 to-transparent p-8 text-center ring-1 ring-amber-400/30">
                  <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-amber-300">{c.category.label}</p>
                  <p className="truncate text-3xl font-bold">{c.empName ?? '—'}</p>
                  <p className="mt-2 font-mono text-xl text-slate-300">{c.value}{championMetricUnit(c.category.metric_key)}</p>
                </div>
              ))}
              {champions.length === 0 && <p className="col-span-2 py-16 text-center text-xl text-slate-400">No champion categories configured yet.</p>}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-center gap-2">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-label={`Show ${v}`}
            aria-current={v === view}
            className={`h-1.5 w-10 rounded-full transition-colors ${v === view ? 'bg-emerald-400' : 'bg-white/15 hover:bg-white/30'}`}
          />
        ))}
      </div>
    </div>
  );
}
