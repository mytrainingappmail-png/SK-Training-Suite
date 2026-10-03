// All the questions of one test on one screen, like the live quiz builder: every question with its
// options open for editing, one "Save all changes" button at the bottom. Used by Induction tests,
// Project tests and Course tests (Assessment). Settings that are not shown here (difficulty, negative
// marks, hint, picture…) are kept exactly as they are when a question is saved.

import { useEffect, useMemo, useState } from 'react';
import { createQuestion, saveQuestion, removeQuestion } from '../../services/question/questionService';
import { defaultQuestionForm } from '../../types/question';
import type { Question, QuestionWithOptionsForm } from '../../types/question';

type Opt = { option_text: string; is_correct: boolean };

interface Row {
  key: string;
  id: string | null;            // null = new, not saved yet
  q: Question | null;           // the stored question (to keep its other settings)
  code: string;
  order: number;
  type: string;
  text: string;
  marks: number;
  options: Opt[];
  removed: boolean;
  saved: string;                // snapshot of what is stored, to tell what changed
}

const OPTION_TYPES = ['mcq', 'multiple_select', 'true_false'];
const TYPE_LABEL: Record<string, string> = { mcq: 'Single choice', multiple_select: 'Multiple choice', true_false: 'True / False' };
const MIN_OPTIONS = 4;
const MAX_OPTIONS = 6;
const INPUT = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 disabled:opacity-60';

const snap = (text: string, marks: number, options: Opt[]) =>
  JSON.stringify([text.trim(), marks, options.filter((o) => o.option_text.trim()).map((o) => [o.option_text.trim(), o.is_correct])]);

function pad(options: Opt[], type: string): Opt[] {
  const out = options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct }));
  if (type === 'true_false') return out;
  while (out.length < MIN_OPTIONS) out.push({ option_text: '', is_correct: false });
  return out;
}

let newKey = 0;
function blankRow(order: number): Row {
  return {
    key: `new-${++newKey}`, id: null, q: null, code: `q-${Date.now().toString(36)}-${newKey}`, order, type: 'mcq', text: '', marks: 1, removed: false,
    options: pad([{ option_text: '', is_correct: true }], 'mcq'), saved: '',
  };
}

function rowsFrom(questions: Question[], optionsByQuestion: Record<string, Opt[]>): Row[] {
  return questions.map((q) => {
    const options = optionsByQuestion[q.id] ?? [];
    return {
      key: q.id, id: q.id, q, code: q.question_code, order: q.display_order, type: q.question_type, text: q.question_text, marks: q.marks,
      options: pad(options, q.question_type), removed: false, saved: snap(q.question_text, q.marks, options),
    };
  });
}

const isLocked = (r: Row) => r.id !== null && !OPTION_TYPES.includes(r.type);

export default function TestQuestionsEditor({ assessmentId, questions, optionsByQuestion, onSaved, showToast }: {
  assessmentId: string;
  questions: Question[];
  optionsByQuestion: Record<string, Opt[]>;
  onSaved: () => Promise<void> | void;
  showToast: (message: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  // Start again from what is stored whenever it is (re)loaded. A text signature, not the array identity,
  // decides that — the parent may hand over a fresh array on every render without anything having changed.
  const signature = questions.map((q) => `${q.id}|${q.question_text}|${q.marks}|${q.display_order}|${(optionsByQuestion[q.id] ?? []).map((o) => `${o.option_text}:${o.is_correct}`).join(',')}`).join(';');
  useEffect(() => { setRows(rowsFrom(questions, optionsByQuestion)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [signature]);

  const change = (key: string, fn: (r: Row) => Row) => setRows((rs) => rs.map((r) => (r.key === key ? fn(r) : r)));
  const isChanged = (r: Row) => {
    if (isLocked(r)) return false;
    if (r.id === null) return !r.removed && (r.text.trim() !== '' || r.options.some((o) => o.option_text.trim()));
    return r.removed || snap(r.text, r.marks, r.options) !== r.saved;
  };

  const changedCount = useMemo(() => rows.filter(isChanged).length, [rows]);
  const visible = rows.filter((r) => !(r.removed && r.id === null));
  let n = 0;

  function validate(r: Row, label: string): string | null {
    if (!r.text.trim()) return `${label}: the question is empty.`;
    const filled = r.options.filter((o) => o.option_text.trim());
    if (filled.length < 2) return `${label}: add at least 2 options.`;
    const correct = filled.filter((o) => o.is_correct).length;
    if (correct === 0) return `${label}: tick which option is correct (the letter on the left) — and it must have text.`;
    if (r.type !== 'multiple_select' && correct > 1) return `${label}: only one option can be correct.`;
    return null;
  }

  async function saveAll() {
    const todo = rows.filter(isChanged);
    if (todo.length === 0) return;
    // Check everything first so nothing is half-saved because of a typo.
    let label = 0;
    for (const r of rows) {
      if (r.removed) continue;
      label++;
      if (isChanged(r)) {
        const problem = validate(r, `Question ${label}`);
        if (problem) { showToast(problem); return; }
      }
    }
    setSaving(true);
    try {
      let nextOrder = Math.max(0, ...rows.filter((r) => r.id).map((r) => r.order)) + 1;
      for (const r of todo.filter((x) => x.removed && x.id)) await removeQuestion(r.id!);
      for (const r of todo.filter((x) => !x.removed)) {
        const options = r.options.filter((o) => o.option_text.trim()).map((o, i) => ({ option_text: o.option_text.trim(), is_correct: o.is_correct, display_order: i + 1 }));
        const base: QuestionWithOptionsForm = r.q
          ? {
            ...defaultQuestionForm,
            assessment_id: r.q.assessment_id, question_code: r.q.question_code, question_type: r.q.question_type, difficulty_level: r.q.difficulty_level,
            negative_marks: r.q.negative_marks, time_limit_seconds: r.q.time_limit_seconds, explanation: r.q.explanation, hint: r.q.hint,
            mandatory: r.q.mandatory, randomize_options: r.q.randomize_options, attachment_url: r.q.attachment_url, image_url: r.q.image_url, active: r.q.active,
            display_order: r.q.display_order, question_text: '', marks: 1, options: [],
          }
          : { ...defaultQuestionForm, assessment_id: assessmentId, question_code: r.code, display_order: nextOrder++ };
        const form = { ...base, question_text: r.text.trim(), marks: Math.max(1, Number(r.marks) || 1), options };
        if (r.id) await saveQuestion(r.id, form); else await createQuestion(form);
      }
      await onSaved();
      showToast(`Saved ${todo.length} change${todo.length === 1 ? '' : 's'}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save the questions.');
      // Show what is stored now, so a half-finished save is never hidden.
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="space-y-4">
        {visible.length === 0 && <p className="text-xs text-slate-400">No questions yet — add one below, or bulk upload a CSV.</p>}
        {visible.map((r) => {
          const num = r.removed ? null : ++n;
          const dirty = isChanged(r);
          if (r.removed) {
            return (
              <div key={r.key} className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/60 px-4 py-3 text-sm text-red-700">
                <span className="truncate line-through">{r.text || 'Question'}</span>
                <button type="button" onClick={() => change(r.key, (x) => ({ ...x, removed: false }))} className="flex-shrink-0 text-xs font-semibold underline">Undo delete</button>
              </div>
            );
          }
          if (isLocked(r)) {
            return (
              <div key={r.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-700">Q{num} <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{r.type.replace('_', ' ')}</span></p>
                <p className="mt-1 text-sm text-slate-700">{r.text}</p>
                <p className="mt-1 text-[11px] text-slate-400">This kind of question is edited with its own Edit button in the list above.</p>
              </div>
            );
          }
          const multi = r.type === 'multiple_select';
          const fixedText = r.type === 'true_false';
          return (
            <div key={r.key} className={`rounded-xl border p-4 ${dirty ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200 bg-white'}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-700">
                  Q{num}
                  {r.type !== 'mcq' && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{TYPE_LABEL[r.type]}</span>}
                  {dirty && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{r.id ? 'edited' : 'new'}</span>}
                </p>
                <button
                  type="button"
                  onClick={() => (r.id ? change(r.key, (x) => ({ ...x, removed: true })) : setRows((rs) => rs.filter((x) => x.key !== r.key)))}
                  className="text-xs font-semibold text-red-500 hover:underline"
                >Delete</button>
              </div>
              <textarea
                value={r.text} rows={2} placeholder="Type the question"
                onChange={(e) => change(r.key, (x) => ({ ...x, text: e.target.value }))}
                className={`${INPUT} mb-3`}
              />
              <div className="space-y-2">
                {r.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button" title={multi ? 'Tick every correct answer' : 'Mark as the correct answer'}
                      onClick={() => change(r.key, (x) => ({ ...x, options: x.options.map((p, pi) => (multi ? (pi === i ? { ...p, is_correct: !p.is_correct } : p) : { ...p, is_correct: pi === i })) }))}
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${o.is_correct ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >{String.fromCharCode(65 + i)}</button>
                    <input
                      value={o.option_text} placeholder={`Option ${String.fromCharCode(65 + i)}`} disabled={fixedText}
                      onChange={(e) => change(r.key, (x) => ({ ...x, options: x.options.map((p, pi) => (pi === i ? { ...p, option_text: e.target.value } : p)) }))}
                      className={INPUT}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  Marks
                  <input
                    type="number" min={1} value={r.marks}
                    onChange={(e) => change(r.key, (x) => ({ ...x, marks: Number(e.target.value) }))}
                    className="w-16 rounded-lg bg-slate-50 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                  />
                </label>
                {!fixedText && r.options.length < MAX_OPTIONS && (
                  <button type="button" onClick={() => change(r.key, (x) => ({ ...x, options: [...x.options, { option_text: '', is_correct: false }] }))} className="text-xs font-semibold text-indigo-600 hover:underline">+ Add option</button>
                )}
                <span className="text-[11px] text-slate-400">Green letter = correct answer{multi ? 's' : ''}. Empty options are ignored.</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <button type="button" onClick={() => setRows((rs) => [...rs, blankRow(0)])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          + Add Question
        </button>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold ${changedCount ? 'text-amber-600' : 'text-slate-400'}`}>
            {changedCount ? `${changedCount} unsaved change${changedCount === 1 ? '' : 's'}` : 'Everything saved'}
          </span>
          {changedCount > 0 && (
            <button
              type="button" disabled={saving}
              onClick={() => setRows(rowsFrom(questions, optionsByQuestion))}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >Discard changes</button>
          )}
          <button
            type="button" onClick={saveAll} disabled={saving || changedCount === 0}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >{saving ? 'Saving…' : 'Save all changes'}</button>
        </div>
      </div>
    </div>
  );
}
