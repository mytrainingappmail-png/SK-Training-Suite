// A Day should not unlock purely on "previous day's test passed" — an
// employee could otherwise binge every Day back-to-back in one sitting,
// defeating the point of a paced, day-by-day onboarding program. The
// previous Day must also have been completed on an EARLIER calendar date
// than today (UTC, matching this app's existing inline
// `new Date().toISOString().slice(0, 10)` convention used elsewhere for
// date-only comparisons — see attendanceService.ts, LicenseManagement.tsx).

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/** The earliest calendar date (UTC, 'YYYY-MM-DD') the NEXT day may open —
 * the day after the previous day's completion date. */
export function nextUnlockDate(prevCompletedAtIso: string): string {
  const d = new Date(dateOnly(prevCompletedAtIso) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** True once today's date has reached the previous day's unlock date. */
export function isDateUnlocked(prevCompletedAtIso: string): boolean {
  return todayDateString() >= nextUnlockDate(prevCompletedAtIso);
}

export function formatUnlockDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
