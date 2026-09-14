// src/utils/performanceTrackerUtils.ts
//
// Period-range math and small formatting helpers for Performance Tracker —
// pure, DB-agnostic functions shared across its Trends/Leaderboard/
// Analytics/Reports tabs.

import type { PtReport } from '../types/performanceTracker';

export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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

export function csvDownload(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => {
      const s = String(cell ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
