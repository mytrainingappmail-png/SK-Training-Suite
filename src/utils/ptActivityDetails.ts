// Performance Tracker — small pure helpers for the optional "activity details" (which project, what time, which client,
// the write-up) that sit behind the daily numbers. No UI here, so every rule can be checked on its own.

import type {
  PtActivityDetails, PtBookingRow, PtMeetingKind, PtMeetingRow, PtPlanDetails, PtReport, PtSettings,
} from '../types/performanceTracker';

export const MEETING_KINDS: { key: PtMeetingKind; label: string; singular: string }[] = [
  { key: 'f2f', label: 'F2F meetings', singular: 'F2F meeting' },
  { key: 'sv', label: 'Site visits', singular: 'Site visit' },
  { key: 'revisit', label: 'Revisits', singular: 'Revisit' },
];

/** "F2F meetings", "site visits", "revisit" — the kind written inside a sentence (F2F keeps its capitals). */
export function kindNoun(kind: PtMeetingKind, n: number): string {
  const m = MEETING_KINDS.find((k) => k.key === kind)!;
  const base = n === 1 ? m.singular : m.label;
  return base.startsWith('F2F') ? base : base.charAt(0).toLowerCase() + base.slice(1);
}

export function newId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function blankMeeting(over: Partial<PtMeetingRow> = {}): PtMeetingRow {
  return { id: newId(), project: '', time: '', client: '', mobile: '', note: '', ...over };
}

export function blankBooking(over: Partial<PtBookingRow> = {}): PtBookingRow {
  return { id: newId(), client: '', mobile: '', project: '', unit: '', amount: '', note: '', ...over };
}

/** A row nobody typed anything in (status / planned flags do not count as "typed"). */
export function isBlankMeeting(r: PtMeetingRow): boolean {
  return !r.project.trim() && !r.time.trim() && !r.client.trim() && !r.mobile.trim() && !r.note.trim();
}

export function isBlankBooking(r: PtBookingRow): boolean {
  return !r.client.trim() && !r.mobile.trim() && !r.project.trim() && !r.unit.trim() && !r.amount.trim() && !r.note.trim();
}

/** How the admin has set up the detail boxes. A company that never saved the setting gets the defaults. */
export interface DetailsConfig {
  enabled: boolean;
  askTime: boolean;
  askClient: boolean;
  askMobile: boolean;
  askWriteup: boolean;
  useProjects: boolean;
  visibility: 'managers' | 'team';
}

export function detailsConfig(s: Partial<PtSettings> | null | undefined): DetailsConfig {
  return {
    enabled: s?.details_enabled ?? true,
    askTime: s?.details_ask_time ?? true,
    askClient: s?.details_ask_client ?? true,
    askMobile: s?.details_ask_mobile ?? false,
    askWriteup: s?.details_ask_writeup ?? true,
    useProjects: s?.details_use_projects ?? true,
    visibility: s?.details_visibility === 'team' ? 'team' : 'managers',
  };
}

export function formatTime(t: string): string {
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  const h = Number(m[1]);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${m[2]} ${suffix}`;
}

/** "Tulip Monsella · 11:00 AM · Mr Sharma" — a one-line description of a meeting. */
export function describeMeeting(r: Pick<PtMeetingRow, 'project' | 'time' | 'client'>): string {
  return [r.project.trim(), r.time ? formatTime(r.time) : '', r.client.trim()].filter(Boolean).join(' · ');
}

// ── morning plan ──

/** Exactly `n` slots, keeping what is already typed; blank slots are added at the end, extra slots dropped from the end. */
export function resizeSlots(rows: PtMeetingRow[], n: number): PtMeetingRow[] {
  const want = Math.max(0, Math.floor(n));
  if (rows.length === want) return rows;
  if (rows.length > want) return rows.slice(0, want);
  return [...rows, ...Array.from({ length: want - rows.length }, () => blankMeeting())];
}

/** At least `n` slots: blank ones are added when short, but nothing typed is ever thrown away when the number goes down
 * (so retyping "2" over "3" does not lose the text) — only the first `n` are shown and saved. */
export function padSlots(rows: PtMeetingRow[], n: number): PtMeetingRow[] {
  return rows.length >= n ? rows : resizeSlots(rows, n);
}

/** The editor hands back only the visible slots; this puts them back in front of the slots that are currently hidden. */
export function mergeSlots(visible: PtMeetingRow[], all: PtMeetingRow[]): PtMeetingRow[] {
  return [...visible, ...all.slice(visible.length)];
}

/** What is saved with the morning commitment: only meetings that have something written, within the planned number. */
export function cleanPlan(rows: Record<PtMeetingKind, PtMeetingRow[]>, counts: Record<PtMeetingKind, number>): PtPlanDetails {
  const out: PtPlanDetails = {};
  for (const k of MEETING_KINDS) {
    const kept = rows[k.key].slice(0, counts[k.key]).filter((r) => !isBlankMeeting(r)).map((r) => ({ id: r.id, project: r.project.trim(), time: r.time, client: r.client.trim(), mobile: r.mobile.trim(), note: r.note.trim() }));
    if (kept.length > 0) out[k.key] = kept;
  }
  return out;
}

// ── evening report ──

/** The planned meetings of the morning, as evening rows waiting for "Done / Not done" — padded with blank planned rows up
 * to the planned NUMBER, so "planned 2, wrote details for 1" still shows 2 planned meetings. */
export function plannedRowsForEvening(plan: PtPlanDetails | undefined, kind: PtMeetingKind, plannedCount: number): PtMeetingRow[] {
  const detailed = (plan?.[kind] ?? []).map((r): PtMeetingRow => ({
    ...blankMeeting({ id: r.id, project: r.project, time: r.time, client: r.client, mobile: r.mobile, note: '' }),
    planned: true,
    planned_as: describeMeeting(r) || undefined,
  }));
  const padded = [...detailed];
  while (padded.length < plannedCount) padded.push({ ...blankMeeting(), planned: true });
  return padded;
}

export const doneCount = (rows: PtMeetingRow[]): number => rows.filter((r) => r.status === 'done').length;
export const unansweredCount = (rows: PtMeetingRow[]): number => rows.filter((r) => r.planned && !r.status).length;

/** What is saved with the evening report: planned rows always (with their status); extra rows only when something was
 * written or they are marked done. */
export function cleanReportRows(rows: PtMeetingRow[]): PtMeetingRow[] {
  return rows
    .filter((r) => r.planned || r.status === 'done' || !isBlankMeeting(r))
    .map((r) => ({
      id: r.id, project: r.project.trim(), time: r.time, client: r.client.trim(), mobile: r.mobile.trim(), note: r.note.trim(),
      status: r.status ?? (r.planned ? undefined : 'done'),
      planned: !!r.planned,
      ...(r.planned_as ? { planned_as: r.planned_as } : {}),
    }));
}

export function cleanBookings(rows: PtBookingRow[]): PtBookingRow[] {
  return rows.map((r) => ({ ...r, client: r.client.trim(), mobile: r.mobile.trim(), project: r.project.trim(), unit: r.unit.trim(), amount: r.amount.trim(), note: r.note.trim() }));
}

/** Does anything in this report carry details worth showing? */
export function hasDetails(d: PtActivityDetails | null | undefined): boolean {
  if (!d) return false;
  return (d.f2f?.length ?? 0) + (d.sv?.length ?? 0) + (d.revisit?.length ?? 0) + (d.bookings?.length ?? 0) > 0
    || !!d.calling?.note?.trim() || (d.calling?.prospects ?? 0) > 0;
}

// ── export: one line per activity (a meeting, a booking, the calling write-up) ──

export interface ActivityLine {
  date: string;
  employee: string;
  type: string;
  project: string;
  time: string;
  client: string;
  mobile: string;
  status: string;
  detail: string;
  note: string;
}

export function flattenReport(report: PtReport, employee: string): ActivityLine[] {
  const d = report.activity_details ?? {};
  const lines: ActivityLine[] = [];
  for (const k of MEETING_KINDS) {
    for (const r of d[k.key] ?? []) {
      lines.push({
        date: report.work_date, employee, type: k.singular, project: r.project, time: r.time ? formatTime(r.time) : '',
        client: r.client, mobile: r.mobile,
        status: r.status === 'missed' ? 'Not done' : r.status === 'done' ? (r.planned ? 'Done (planned)' : 'Done (not planned)') : 'Not marked',
        detail: r.planned_as ? `Planned: ${r.planned_as}` : '', note: r.note,
      });
    }
  }
  for (const b of d.bookings ?? []) {
    lines.push({ date: report.work_date, employee, type: 'Booking', project: b.project, time: '', client: b.client, mobile: b.mobile, status: 'Booked', detail: [b.unit, b.amount].filter(Boolean).join(' · '), note: b.note });
  }
  if (d.calling && ((d.calling.prospects ?? 0) > 0 || d.calling.note?.trim())) {
    lines.push({ date: report.work_date, employee, type: 'Data calling', project: '', time: '', client: '', mobile: '', status: '', detail: `${d.calling.prospects} prospect${d.calling.prospects === 1 ? '' : 's'} created`, note: d.calling.note });
  }
  return lines;
}
