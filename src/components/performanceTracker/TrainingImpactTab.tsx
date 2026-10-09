// src/components/performanceTracker/TrainingImpactTab.tsx
//
// "Does training actually pay off?" — puts each employee's training (induction, tests passed, lessons) next to their
// field performance (Performance Tracker) and compares people who finished training with people who haven't.
// Company admins only (the database function enforces it too). This shows a pattern, not proof — the screen says so.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { rangeForPeriod, periodLabel, PERIOD_OPTIONS } from '../../utils/performanceTrackerUtils';
import type { PtPeriod } from '../../utils/performanceTrackerUtils';
import { Badge, Card, LoadingBlock } from './ptUi';

interface ImpactRow {
  employee_id: string;
  full_name: string;
  employee_code: string | null;
  joining_date: string | null;
  induction_completed: boolean;
  lessons_completed: number;
  assessments_taken: number;
  assessments_passed: number;
  avg_assessment_pct: number | null;
  pt_days: number;
  pt_score: number;
  pt_bookings: number;
  pt_site_visits: number;
  pt_meetings: number;
  pt_avg_achievement: number | null;
}

/** Trained = finished induction OR passed at least one test. Shown on screen so nobody has to guess. */
const isTrained = (r: ImpactRow) => r.induction_completed || r.assessments_passed > 0;

const perDay = (total: number, days: number) => (days > 0 ? total / days : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

interface GroupStats { people: number; scorePerDay: number; sitePerDay: number; bookingsEach: number; achievement: number | null }

function stats(rows: ImpactRow[]): GroupStats {
  const n = rows.length;
  const ach = rows.filter((r) => r.pt_avg_achievement != null);
  return {
    people: n,
    scorePerDay: n ? round1(rows.reduce((s, r) => s + perDay(r.pt_score, r.pt_days), 0) / n) : 0,
    sitePerDay: n ? round1(rows.reduce((s, r) => s + perDay(r.pt_site_visits, r.pt_days), 0) / n) : 0,
    bookingsEach: n ? round1(rows.reduce((s, r) => s + r.pt_bookings, 0) / n) : 0,
    achievement: ach.length ? round1(ach.reduce((s, r) => s + (r.pt_avg_achievement ?? 0), 0) / ach.length) : null,
  };
}

function Delta({ a, b }: { a: number; b: number }) {
  if (b <= 0 && a <= 0) return <span className="text-xs text-slate-400">—</span>;
  if (b <= 0) return <Badge tone="active">new</Badge>;
  const pct = Math.round(((a - b) / b) * 100);
  if (pct === 0) return <Badge tone="gray">same</Badge>;
  return <Badge tone={pct > 0 ? 'active' : 'rejected'}>{pct > 0 ? '+' : ''}{pct}%</Badge>;
}

export function TrainingImpactTab() {
  const [period, setPeriod] = useState<PtPeriod>('monthly');
  const range = useMemo(() => rangeForPeriod(period), [period]);
  const [rows, setRows] = useState<ImpactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    supabase
      .rpc('get_training_impact', { p_from: range.start, p_to: range.end })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) { setError(err.message); setRows([]); } else setRows((data ?? []) as ImpactRow[]);
      })
      .then(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range.start, range.end]);

  // Only people who actually filed reports in the range can be compared on performance.
  const reporters = useMemo(() => rows.filter((r) => r.pt_days > 0), [rows]);
  const trained = useMemo(() => stats(reporters.filter(isTrained)), [reporters]);
  const notYet = useMemo(() => stats(reporters.filter((r) => !isTrained(r))), [reporters]);
  const comparable = trained.people >= 2 && notYet.people >= 2;

  const needsTraining = useMemo(
    () => reporters.filter((r) => !isTrained(r)).sort((a, b) => perDay(a.pt_score, a.pt_days) - perDay(b.pt_score, b.pt_days)).slice(0, 5),
    [reporters]
  );

  const table = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.full_name.toLowerCase().includes(q) || (r.employee_code ?? '').toLowerCase().includes(q))
      .sort((a, b) => perDay(b.pt_score, b.pt_days) - perDay(a.pt_score, a.pt_days));
  }, [rows, search]);

  const label = periodLabel(period, range);

  if (loading) return <LoadingBlock />;
  if (error) return <Card className="p-6 text-sm text-rose-600">{error}</Card>;

  const metric = (title: string, a: number, b: number, unit = '') => (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-medium text-slate-500">{title}</p>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="font-mono text-xl font-bold text-emerald-700">{a}{unit}</span>
        <span className="text-xs text-slate-400">vs {b}{unit}</span>
        <Delta a={a} b={b} />
      </div>
    </div>
  );

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

      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">Trained vs not-yet-trained — {label}</p>
        <p className="mt-1 text-xs text-slate-500">
          <b>Trained</b> = finished the induction or passed at least one test. Compared among people who filed at least one report in this period.
        </p>

        {reporters.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">Nobody has filed a performance report in this period yet.</p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold text-emerald-800">✅ Trained</p>
                <p className="font-mono text-2xl font-bold text-emerald-700">{trained.people} <span className="text-xs font-normal text-emerald-700/70">people</span></p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold text-amber-800">⏳ Not yet trained</p>
                <p className="font-mono text-2xl font-bold text-amber-700">{notYet.people} <span className="text-xs font-normal text-amber-700/70">people</span></p>
              </div>
            </div>

            {comparable ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {metric('Score per working day (average per person)', trained.scorePerDay, notYet.scorePerDay)}
                {metric('Site visits per working day', trained.sitePerDay, notYet.sitePerDay)}
                {metric('Bookings per person', trained.bookingsEach, notYet.bookingsEach)}
                {trained.achievement != null && notYet.achievement != null
                  ? metric('Achievement against own plan', trained.achievement, notYet.achievement, '%')
                  : <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Achievement % needs morning commitments from both groups.</div>}
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                A fair comparison needs at least 2 people in each group who filed reports. Right now: {trained.people} trained, {notYet.people} not yet trained.
              </p>
            )}
            <p className="mt-3 text-[11px] text-slate-400">The first number is trained people, after “vs” is not-yet-trained. This shows a pattern in your own team — it is not proof of cause (for example, newer joiners may also be less trained).</p>
          </>
        )}
      </Card>

      {needsTraining.length > 0 && (
        <Card>
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Train these first</div>
          <p className="px-4 pt-2 text-xs text-slate-500">Not trained yet and the lowest score per day in {label}.</p>
          <div className="p-2">
            {needsTraining.map((r) => (
              <div key={r.employee_id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{r.full_name}</span>
                <span className="font-mono text-xs font-semibold text-rose-600">{round1(perDay(r.pt_score, r.pt_days))} / day</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-semibold text-slate-900">Everyone — training next to performance</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or code" className="w-full rounded-lg bg-slate-50 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-400/40 sm:w-56" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Employee</th>
                <th className="px-3 py-2">Training</th>
                <th className="px-3 py-2 text-right">Days filed</th>
                <th className="px-3 py-2 text-right">Score / day</th>
                <th className="px-3 py-2 text-right">Site visits</th>
                <th className="px-3 py-2 text-right">Bookings</th>
                <th className="px-3 py-2 text-right">Achievement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.map((r) => (
                <tr key={r.employee_id}>
                  <td className="px-4 py-2 font-medium text-slate-800">{r.full_name}{r.employee_code && <span className="ml-1 text-[11px] font-normal text-slate-400">{r.employee_code}</span>}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={r.induction_completed ? 'active' : 'gray'}>{r.induction_completed ? 'Induction ✓' : 'No induction'}</Badge>
                      <Badge tone={r.assessments_passed > 0 ? 'active' : 'gray'}>Tests {r.assessments_passed}/{r.assessments_taken}</Badge>
                      {r.avg_assessment_pct != null && <Badge tone="info">avg {Math.round(r.avg_assessment_pct)}%</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{r.pt_days}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{r.pt_days ? round1(perDay(r.pt_score, r.pt_days)) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.pt_days ? r.pt_site_visits : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.pt_days ? r.pt_bookings : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.pt_avg_achievement != null ? `${r.pt_avg_achievement}%` : '—'}</td>
                </tr>
              ))}
              {table.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-500">No employees found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
