// Reports -> Pending tests: who still has to pass which test, built from the raw data (see the repository).
// A row exists for every (employee, test) that was handed out and not passed yet:
//   - assessments assigned to a single employee (Assessment -> Assignments), and
//   - the test card of every Induction day the employee has already completed (that is when the test opens).
// All numbers come from the data (the test's own pass % and attempt limit) - nothing is fixed here.

import { employeeLocationKey, visibleInLocation } from '../../constants/locations';
import type { PendingTestsData } from '../../repositories/pendingTests/pendingTestsRepository';

export type PendingStatus = 'not_started' | 'in_progress' | 'failed' | 'no_attempts_left';

export interface PendingRow {
  key: string;
  source: 'assessment' | 'induction';
  employeeId: string;
  name: string;
  code: string;
  branch: string;
  testId: string;
  testTitle: string;
  /** Where the test comes from, e.g. "Assessment" or "Induction · Day 2". */
  where: string;
  dueDate: string | null;
  /** The assignment's "mandatory" switch (null for Induction tests, which have none). */
  mandatory: boolean | null;
  attempts: number;
  maxAttempts: number;
  bestPct: number | null;
  passPct: number;
  status: PendingStatus;
  overdue: boolean;
  lastAttemptAt: string | null;
}

const STATUS_ORDER: Record<PendingStatus, number> = { no_attempts_left: 0, failed: 1, not_started: 2, in_progress: 3 };

export function buildPendingRows(data: PendingTestsData, now: Date = new Date()): PendingRow[] {
  const emp = new Map(data.employees.map((e) => [e.id, e]));
  const test = new Map(data.assessments.map((a) => [a.id, a]));
  const branchName = new Map(data.induction.branches.map((b) => [b.id, b.branch_name]));
  const branchLocation = new Map(data.induction.branches.map((b) => [b.id, employeeLocationKey(b)]));

  const attemptsBy = new Map<string, typeof data.attempts>();
  for (const a of data.attempts) {
    const k = `${a.employee_id}:${a.assessment_id}`;
    attemptsBy.set(k, [...(attemptsBy.get(k) ?? []), a]);
  }
  const bestPct = new Map<string, number>();
  const passed = new Set<string>();
  for (const r of data.results) {
    const k = `${r.employee_id}:${r.assessment_id}`;
    if (r.passed) passed.add(k);
    bestPct.set(k, Math.max(bestPct.get(k) ?? 0, Number(r.percentage) || 0));
  }

  const today = now.toISOString().slice(0, 10);
  const seen = new Set<string>();
  const rows: PendingRow[] = [];

  function add(source: PendingRow['source'], employeeId: string, testId: string, where: string, extra: { dueDate: string | null; mandatory: boolean | null; maxAttempts: number | null; expired: boolean }) {
    const key = `${employeeId}:${testId}`;
    if (seen.has(key) || passed.has(key)) return;
    const e = emp.get(employeeId);
    const t = test.get(testId);
    if (!e || !e.active || !t) return;
    seen.add(key);
    const attempts = attemptsBy.get(key) ?? [];
    const maxAttempts = extra.maxAttempts || t.maximum_attempts || 1;
    const latest = [...attempts].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0];
    let status: PendingStatus;
    if (attempts.some((a) => a.status === 'in_progress')) status = 'in_progress';
    else if (attempts.length === 0) status = 'not_started';
    else if (attempts.length >= maxAttempts) status = 'no_attempts_left';
    else status = 'failed';
    const due = extra.dueDate ? extra.dueDate.slice(0, 10) : null;
    rows.push({
      key: `${source}:${key}`, source, employeeId, name: `${e.first_name} ${e.last_name ?? ''}`.trim(), code: e.employee_code,
      branch: e.branch_id ? branchName.get(e.branch_id) ?? '' : '', testId, testTitle: t.assessment_title || 'Untitled test', where,
      dueDate: due, mandatory: extra.mandatory, attempts: attempts.length, maxAttempts, bestPct: bestPct.has(key) ? bestPct.get(key)! : null,
      passPct: Number(t.passing_percentage) || 0, status,
      overdue: extra.expired || (due !== null && due < today),
      lastAttemptAt: latest ? latest.submitted_at ?? latest.completed_at ?? latest.started_at : null,
    });
  }

  for (const a of data.assignments) {
    add('assessment', a.employee_id, a.assessment_id, 'Assessment', { dueDate: a.end_date, mandatory: !!a.mandatory, maxAttempts: a.maximum_attempts, expired: a.assignment_status === 'expired' });
  }

  const ind = data.induction;
  const dayById = new Map(ind.days.map((d) => [d.id, d]));
  const testsByDay = new Map<string, typeof ind.sections>();
  for (const s of ind.sections) {
    if (s.section_type === 'test' && s.assessment_id) testsByDay.set(s.day_id, [...(testsByDay.get(s.day_id) ?? []), s]);
  }
  for (const a of ind.assignments) {
    if (a.status === 'completed') continue;
    const e = emp.get(a.employee_id);
    if (!e) continue;
    const myLocation = e.branch_id ? branchLocation.get(e.branch_id) ?? null : null;
    for (const c of ind.completions.filter((x) => x.employee_id === a.employee_id)) {
      const day = dayById.get(c.day_id);
      for (const s of testsByDay.get(c.day_id) ?? []) {
        if (!visibleInLocation(s.locations, myLocation)) continue;
        add('induction', a.employee_id, s.assessment_id!, `Induction · ${day?.title ?? 'Day'}`, { dueDate: null, mandatory: null, maxAttempts: null, expired: false });
      }
    }
  }

  return rows.sort((x, y) => Number(y.overdue) - Number(x.overdue) || STATUS_ORDER[x.status] - STATUS_ORDER[y.status] || x.name.localeCompare(y.name));
}
