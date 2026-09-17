// src/utils/performanceTrackerUtils.ts
//
// Period-range math and small formatting helpers for Performance Tracker —
// pure, DB-agnostic functions shared across its Trends/Leaderboard/
// Analytics/Reports tabs.

import type { PtReport } from '../types/performanceTracker';

// Deliberately NOT `d.toISOString().slice(0, 10)` — that reads the UTC
// calendar date, not the local one. For a positive UTC offset (e.g. IST,
// UTC+5:30) that's flat-out wrong for any Date built from local Y/M/D
// components (new Date(y, m, d) is local midnight, which is still the
// PREVIOUS day in UTC — permanently off by one, not just near midnight),
// and even for "new Date() right now" it's wrong for the first ~5:30
// hours of every local day. Reading the Date object's own local
// getFullYear/getMonth/getDate never crosses that UTC boundary.
export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface RangeBucket { label: string; start: string; end: string }
export interface PeriodRange { start: string; end: string; days: string[]; buckets: RangeBucket[] }

export type PtPeriod = 'weekly' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';

export const PERIOD_OPTIONS: { value: PtPeriod; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-Yearly' },
  { value: 'yearly', label: 'Yearly' },
];

export function weekRange(ref = new Date()): PeriodRange {
  const d = new Date(ref);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    days.push(fmtDate(dd));
  }
  const buckets = days.map((dstr) => ({
    label: new Date(dstr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
    start: dstr, end: dstr,
  }));
  return { start: days[0], end: days[6], days, buckets };
}

/** This week's Saturday–Sunday (weekRange's own Mon-based days[5]/days[6]) — the "weekend plan" quick filter. */
export function weekendRange(ref = new Date()): { start: string; end: string } {
  const wr = weekRange(ref);
  return { start: wr.days[5], end: wr.days[6] };
}

export function monthRange(ref = new Date()): PeriodRange {
  const y = ref.getFullYear(), m = ref.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const days: string[] = [];
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) days.push(fmtDate(d));
  const buckets = days.map((dstr) => ({ label: String(new Date(dstr).getDate()), start: dstr, end: dstr }));
  return { start: fmtDate(first), end: fmtDate(last), days, buckets };
}

function monthBuckets(startMonth: Date, count: number): RangeBucket[] {
  const buckets: RangeBucket[] = [];
  for (let i = 0; i < count; i++) {
    const first = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
    const last = new Date(startMonth.getFullYear(), startMonth.getMonth() + i + 1, 0);
    buckets.push({ label: first.toLocaleDateString('en-IN', { month: 'short' }), start: fmtDate(first), end: fmtDate(last) });
  }
  return buckets;
}

export function quarterRange(ref = new Date()): PeriodRange {
  const qStartMonth = Math.floor(ref.getMonth() / 3) * 3;
  const first = new Date(ref.getFullYear(), qStartMonth, 1);
  const buckets = monthBuckets(first, 3);
  return { start: buckets[0].start, end: buckets[2].end, days: [], buckets };
}

export function halfYearRange(ref = new Date()): PeriodRange {
  const hStartMonth = ref.getMonth() < 6 ? 0 : 6;
  const first = new Date(ref.getFullYear(), hStartMonth, 1);
  const buckets = monthBuckets(first, 6);
  return { start: buckets[0].start, end: buckets[5].end, days: [], buckets };
}

export function yearRange(ref = new Date()): PeriodRange {
  const first = new Date(ref.getFullYear(), 0, 1);
  const buckets = monthBuckets(first, 12);
  return { start: buckets[0].start, end: buckets[11].end, days: [], buckets };
}

export function rangeForPeriod(period: PtPeriod, ref = new Date()): PeriodRange {
  switch (period) {
    case 'weekly': return weekRange(ref);
    case 'quarterly': return quarterRange(ref);
    case 'half_yearly': return halfYearRange(ref);
    case 'yearly': return yearRange(ref);
    case 'monthly':
    default: return monthRange(ref);
  }
}

export function periodLabel(period: PtPeriod, range: PeriodRange, ref = new Date()): string {
  switch (period) {
    case 'weekly': return `${range.start} to ${range.end}`;
    case 'monthly': return ref.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    case 'quarterly': return `Q${Math.floor(ref.getMonth() / 3) + 1} ${ref.getFullYear()}`;
    case 'half_yearly': return `${ref.getMonth() < 6 ? 'H1' : 'H2'} ${ref.getFullYear()}`;
    case 'yearly': return String(ref.getFullYear());
    default: return `${range.start} to ${range.end}`;
  }
}

/** Average achievement% across a set of reports, ignoring nulls (no commitment that day). */
export function avgAchievement(reports: PtReport[]): number {
  const vals = reports.map((r) => r.achievement_pct).filter((v): v is number => v != null);
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export function statusTone(achievementPct: number | null): 'green' | 'yellow' | 'red' {
  const v = achievementPct ?? 0;
  if (v >= 80) return 'green';
  if (v >= 50) return 'yellow';
  return 'red';
}
