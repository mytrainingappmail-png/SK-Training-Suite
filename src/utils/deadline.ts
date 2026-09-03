// src/utils/deadline.ts
//
// Shared "complete within X hours/days" duration → deadline math, used by
// every admin assignment flow (course, learning path) so the rule is
// computed identically everywhere.

export type DurationUnit = 'hours' | 'days';

export function computeDeadline(value: number, unit: DurationUnit, from: Date = new Date()): string {
  const ms = unit === 'hours' ? value * 60 * 60 * 1000 : value * 24 * 60 * 60 * 1000;
  return new Date(from.getTime() + ms).toISOString();
}

export function formatDuration(value: number, unit: DurationUnit): string {
  if (value <= 0) return 'No deadline';
  const label = unit === 'hours' ? 'hour' : 'day';
  return `${value} ${label}${value === 1 ? '' : 's'}`;
}

export function formatDeadline(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
