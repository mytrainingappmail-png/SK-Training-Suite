// "Count each person's attempts" for quizzes and exams (the switch is `quizzes.track_attempts`, off by default).
// Nothing extra is stored: the attempts are worked out from the results that already exist. A person is recognised by
// their NAME (that is all a player types), ignoring capitals, spaces and full stops, across all sessions of the same
// test. Attempts are numbered in the order the sessions were held.

export interface AttemptInput {
  /** Unique per result row (the participant id). */
  key: string;
  quizId: string;
  name: string;
  /** When the attempt happened (session start / end) - decides the order. */
  at: string;
  percent: number;
  passed: boolean;
}

export interface AttemptStep { key: string; at: string; percent: number; passed: boolean }

export interface AttemptInfo {
  /** This row's own number (1 = first attempt). */
  attemptNo: number;
  totalAttempts: number;
  /** Every attempt of this person on this test, oldest first. */
  history: AttemptStep[];
  /** The first attempt that reached the pass mark (null = not passed yet). */
  passedOnAttempt: number | null;
}

export interface PersonAttempts {
  quizId: string;
  /** The name as it was typed most recently. */
  name: string;
  history: AttemptStep[];
  passedOnAttempt: number | null;
}

/** "rohit  Verma." and "Rohit Verma" are the same person. */
export function normalizePersonName(name: string): string {
  return name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

function group(rows: AttemptInput[], tracked: Set<string>): Map<string, AttemptInput[]> {
  const by = new Map<string, AttemptInput[]>();
  for (const r of rows) {
    if (!tracked.has(r.quizId)) continue;
    const who = normalizePersonName(r.name);
    if (!who) continue;
    const k = `${r.quizId}::${who}`;
    by.set(k, [...(by.get(k) ?? []), r]);
  }
  for (const list of by.values()) list.sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key));
  return by;
}

/** For every result row of a tracked test: its attempt number and the person's whole history. Rows of tests that are not tracked are not in the map. */
export function buildAttemptInfo(rows: AttemptInput[], tracked: Set<string>): Map<string, AttemptInfo> {
  const out = new Map<string, AttemptInfo>();
  for (const list of group(rows, tracked).values()) {
    const history = list.map((r) => ({ key: r.key, at: r.at, percent: r.percent, passed: r.passed }));
    const first = history.findIndex((h) => h.passed);
    const passedOnAttempt = first >= 0 ? first + 1 : null;
    list.forEach((r, i) => out.set(r.key, { attemptNo: i + 1, totalAttempts: list.length, history, passedOnAttempt }));
  }
  return out;
}

/** One line per person per tracked test - the "attempts report". */
export function buildPersonAttempts(rows: AttemptInput[], tracked: Set<string>): PersonAttempts[] {
  const out: PersonAttempts[] = [];
  for (const list of group(rows, tracked).values()) {
    const history = list.map((r) => ({ key: r.key, at: r.at, percent: r.percent, passed: r.passed }));
    const first = history.findIndex((h) => h.passed);
    out.push({ quizId: list[0].quizId, name: list[list.length - 1].name.trim(), history, passedOnAttempt: first >= 0 ? first + 1 : null });
  }
  return out;
}

/** "42% → 61% → 78%" */
export function percentTrail(history: AttemptStep[]): string {
  return history.map((h) => `${Math.round(h.percent)}%`).join(' → ');
}

/** The sentence shown next to a result: "2nd attempt · passed on the 2nd" / "3rd attempt · not passed yet". */
export function attemptLabel(info: AttemptInfo): string {
  const own = `${ordinal(info.attemptNo)} attempt`;
  if (info.passedOnAttempt === null) return `${own} · not passed yet`;
  return info.attemptNo === info.passedOnAttempt ? `${own} · passed` : `${own} · passed on the ${ordinal(info.passedOnAttempt)}`;
}
