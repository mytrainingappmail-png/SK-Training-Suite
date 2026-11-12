import { describe, expect, it } from 'vitest';
import { buildPendingRows } from '../../services/pendingTests/pendingTestsService';
import type { PendingTestsData } from '../../repositories/pendingTests/pendingTestsRepository';

const emp = (id: string, active = true) => ({ id, employee_code: id.toUpperCase(), first_name: id, last_name: 'X', branch_id: null, active });
const test = (id: string, max = 3, pass = 70) => ({ id, assessment_title: `Test ${id}`, assessment_code: id, passing_percentage: pass, maximum_attempts: max });
const attempt = (employee_id: string, assessment_id: string, status = 'submitted', at = '2026-11-01T10:00:00Z') => ({ employee_id, assessment_id, status, started_at: at, submitted_at: at, completed_at: at });
const result = (employee_id: string, assessment_id: string, percentage: number, passed: boolean) => ({ employee_id, assessment_id, percentage, passed });
const assign = (employee_id: string, assessment_id: string, over: Record<string, unknown> = {}) => ({ assessment_id, employee_id, end_date: null, maximum_attempts: null, mandatory: true, assignment_status: 'published', ...over });

function data(over: Partial<PendingTestsData>): PendingTestsData {
  return {
    assignments: [], assessments: [test('t1')], employees: [emp('a'), emp('b'), emp('c')], attempts: [], results: [],
    induction: { assignments: [], employees: [], branches: [], days: [], sections: [], completions: [], views: [], passes: [] },
    ...over,
  } as PendingTestsData;
}

describe('buildPendingRows', () => {
  it('every status, from the data', () => {
    const rows = buildPendingRows(data({
      assignments: [assign('a', 't1'), assign('b', 't1'), assign('c', 't1')],
      attempts: [attempt('b', 't1', 'in_progress'), attempt('c', 't1'), attempt('c', 't1'), attempt('c', 't1')],
      results: [result('c', 't1', 40, false)],
    }));
    const by = Object.fromEntries(rows.map((r) => [r.employeeId, r]));
    expect(by.a.status).toBe('not_started');
    expect(by.b.status).toBe('in_progress');
    expect(by.c.status).toBe('no_attempts_left'); // 3 of 3 used
    expect(by.c.bestPct).toBe(40);
    expect(by.c.passPct).toBe(70);
  });
  it('failed with attempts left; the assignment limit beats the test limit', () => {
    const rows = buildPendingRows(data({ assignments: [assign('a', 't1', { maximum_attempts: 2 })], attempts: [attempt('a', 't1')], results: [result('a', 't1', 50, false)] }));
    expect(rows[0].status).toBe('failed');
    expect(rows[0].maxAttempts).toBe(2);
  });
  it('a passed test is not pending, even after an earlier failure', () => {
    const rows = buildPendingRows(data({ assignments: [assign('a', 't1')], attempts: [attempt('a', 't1'), attempt('a', 't1')], results: [result('a', 't1', 30, false), result('a', 't1', 80, true)] }));
    expect(rows).toHaveLength(0);
  });
  it('overdue by date and by expired status; inactive employees are left out', () => {
    const rows = buildPendingRows(data({
      assignments: [assign('a', 't1', { end_date: '2026-10-01' }), assign('b', 't1', { end_date: '2026-12-31' }), assign('c', 't1', { assignment_status: 'expired' })],
      employees: [emp('a'), emp('b'), emp('c', false)],
    }), new Date('2026-11-12T00:00:00Z'));
    const by = Object.fromEntries(rows.map((r) => [r.employeeId, r]));
    expect(by.a.overdue).toBe(true);
    expect(by.b.overdue).toBe(false);
    expect(by.c).toBeUndefined();
    expect(rows[0].employeeId).toBe('a'); // overdue first
  });
  it('induction: only tests of days the employee has completed, once, and not for finished inductions', () => {
    const induction = {
      assignments: [{ employee_id: 'a', status: 'active', assigned_at: '', completed_at: null }, { employee_id: 'b', status: 'completed', assigned_at: '', completed_at: '' }],
      employees: [], branches: [],
      days: [{ id: 'd1', title: 'Basics' }, { id: 'd2', title: 'Later' }],
      sections: [
        { id: 's1', day_id: 'd1', section_type: 'test', title: 'T', assessment_id: 't1', display_order: 1, locations: null },
        { id: 's2', day_id: 'd2', section_type: 'test', title: 'T2', assessment_id: 't2', display_order: 1, locations: null },
      ],
      completions: [{ employee_id: 'a', day_id: 'd1', completed_at: '' }, { employee_id: 'b', day_id: 'd1', completed_at: '' }],
      views: [], passes: [],
    };
    const rows = buildPendingRows(data({ induction: induction as never, assessments: [test('t1'), test('t2')] }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: 'induction', employeeId: 'a', where: 'Induction · Basics', status: 'not_started' });
  });
  it('the same person and test is listed once (assessment wins)', () => {
    const induction = {
      assignments: [{ employee_id: 'a', status: 'active', assigned_at: '', completed_at: null }], employees: [], branches: [],
      days: [{ id: 'd1', title: 'Basics' }], sections: [{ id: 's1', day_id: 'd1', section_type: 'test', title: 'T', assessment_id: 't1', display_order: 1, locations: null }],
      completions: [{ employee_id: 'a', day_id: 'd1', completed_at: '' }], views: [], passes: [],
    };
    const rows = buildPendingRows(data({ induction: induction as never, assignments: [assign('a', 't1')] }));
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('assessment');
  });
});
