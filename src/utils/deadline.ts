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

// ── Employee-facing "how am I doing" formatting ──────────────────────────────

export function formatMinutesRemaining(minutes: number): string {
  if (minutes <= 0) return '';
  if (minutes < 60) return `~${minutes} min left`;
  const hours = Math.round(minutes / 60);
  return `~${hours} hr${hours === 1 ? '' : 's'} left`;
}

export function formatDueCountdown(dueDate: string): { text: string; overdue: boolean } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`, overdue: true };
  if (diffDays === 0) return { text: 'Due today', overdue: false };
  return { text: `${diffDays} day${diffDays === 1 ? '' : 's'} left`, overdue: false };
}
