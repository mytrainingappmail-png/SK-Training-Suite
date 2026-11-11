import { describe, expect, it } from 'vitest';
import { convertQuizQuestion } from '../../components/shared/ImportFromQuizModal';
import type { QuizQuestion } from '../../types/quiz';

const opt = (text: string, ok: boolean, order: number) => ({ id: `o${order}`, question_id: 'q', option_text: text, is_correct: ok, display_order: order });
const q = (over: Partial<QuizQuestion>): QuizQuestion => ({
  id: 'q', quiz_id: 'z', question_text: ' What is 2+2? ', type: 'mcq', timer_seconds: 20, marks: 2, explanation: ' Simple ', display_order: 1,
  is_hidden: false, source_label: null, source_question_id: null, image_url: null, target_x: null, target_y: null, target_radius: null, hotspot_zones: null,
  options: [opt('3', false, 2), opt('4', true, 1), opt('5', false, 3), opt('', false, 4)], ...over,
} as QuizQuestion);

describe('convertQuizQuestion', () => {
  it('keeps order, drops empty options, single right answer -> mcq', () => {
    const r = convertQuizQuestion(q({}));
    expect(r.converted?.type).toBe('mcq');
    expect(r.converted?.options.map((o) => o.option_text)).toEqual(['4', '3', '5']);
    expect(r.converted?.options[0].is_correct).toBe(true);
    expect(r.converted?.text).toBe('What is 2+2?');
    expect(r.converted?.marks).toBe(2);
    expect(r.converted?.explanation).toBe('Simple');
  });
  it('several right answers -> multiple_select with a note', () => {
    const r = convertQuizQuestion(q({ options: [opt('A', true, 1), opt('B', true, 2), opt('C', false, 3)] }));
    expect(r.converted?.type).toBe('multiple_select');
    expect(r.note).toMatch(/more than one/i);
  });
  it('true/false -> true_false', () => {
    const r = convertQuizQuestion(q({ type: 'truefalse', options: [opt('True', true, 1), opt('False', false, 2)] }));
    expect(r.converted?.type).toBe('true_false');
  });
  it('hotspot and written are left out with a reason', () => {
    expect(convertQuizQuestion(q({ type: 'hotspot' })).converted).toBeNull();
    expect(convertQuizQuestion(q({ type: 'written', options: [] })).note).toMatch(/written/i);
  });
  it('no correct answer / fewer than 2 options are left out', () => {
    expect(convertQuizQuestion(q({ options: [opt('A', false, 1), opt('B', false, 2)] })).converted).toBeNull();
    expect(convertQuizQuestion(q({ options: [opt('A', true, 1)] })).converted).toBeNull();
  });
  it('marks never below 1; picture carried over', () => {
    const r = convertQuizQuestion(q({ marks: 0, image_url: ' http://x/i.png ' }));
    expect(r.converted?.marks).toBe(1);
    expect(r.converted?.image_url).toBe('http://x/i.png');
  });
});
