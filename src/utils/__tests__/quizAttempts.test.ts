import { describe, expect, it } from 'vitest';
import { attemptLabel, buildAttemptInfo, buildPersonAttempts, normalizePersonName, ordinal, percentTrail } from '../../services/quiz/quizAttempts';

const row = (key: string, name: string, at: string, percent: number, passed: boolean, quizId = 'q1') => ({ key, quizId, name, at, percent, passed });
const on = new Set(['q1']);

describe('quizAttempts', () => {
  it('numbers the same person\'s tries in the order they happened', () => {
    const info = buildAttemptInfo([
      row('c', 'Rohit Verma', '2026-11-03', 78, true),
      row('a', 'rohit  verma', '2026-11-01', 42, false),
      row('b', 'Rohit Verma.', '2026-11-02', 61, false),
    ], on);
    expect(info.get('a')?.attemptNo).toBe(1);
    expect(info.get('b')?.attemptNo).toBe(2);
    expect(info.get('c')?.attemptNo).toBe(3);
    expect(info.get('c')?.passedOnAttempt).toBe(3);
    expect(percentTrail(info.get('a')!.history)).toBe('42% → 61% → 78%');
  });
  it('different people and different tests are counted apart', () => {
    const info = buildAttemptInfo([
      row('a', 'Asha', '2026-11-01', 40, false),
      row('b', 'Ravi', '2026-11-01', 90, true),
      row('c', 'Asha', '2026-11-02', 80, true, 'q2'),
    ], new Set(['q1', 'q2']));
    expect(info.get('a')?.totalAttempts).toBe(1);
    expect(info.get('b')?.attemptNo).toBe(1);
    expect(info.get('c')?.attemptNo).toBe(1); // another test = its own first attempt
  });
  it('a test that is not tracked (floor test) is left out completely', () => {
    const info = buildAttemptInfo([row('a', 'Asha', '2026-11-01', 40, false, 'floor'), row('b', 'Asha', '2026-11-02', 90, true, 'floor')], on);
    expect(info.size).toBe(0);
    expect(buildPersonAttempts([row('a', 'Asha', '2026-11-01', 40, false, 'floor')], on)).toHaveLength(0);
  });
  it('passed on the first pass; a later pass does not move it; never passed = null', () => {
    const people = buildPersonAttempts([
      row('a', 'Asha', '2026-11-01', 50, false), row('b', 'Asha', '2026-11-02', 75, true), row('c', 'Asha', '2026-11-03', 90, true),
      row('d', 'Ravi', '2026-11-01', 30, false),
    ], on);
    expect(people.find((p) => p.name === 'Asha')?.passedOnAttempt).toBe(2);
    expect(people.find((p) => p.name === 'Ravi')?.passedOnAttempt).toBeNull();
  });
  it('labels read naturally', () => {
    const info = buildAttemptInfo([row('a', 'Asha', '1', 50, false), row('b', 'Asha', '2', 75, true), row('c', 'Asha', '3', 80, true)], on);
    expect(attemptLabel(info.get('a')!)).toBe('1st attempt · passed on the 2nd');
    expect(attemptLabel(info.get('b')!)).toBe('2nd attempt · passed');
    const none = buildAttemptInfo([row('x', 'Ravi', '1', 10, false)], on);
    expect(attemptLabel(none.get('x')!)).toBe('1st attempt · not passed yet');
  });
  it('ordinals and name cleanup', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 112].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '112th']);
    expect(normalizePersonName('  Mohd.  RAFI ')).toBe('mohd rafi');
    expect(normalizePersonName('राहुल  शर्मा')).toBe('राहुल शर्मा');
  });
});
