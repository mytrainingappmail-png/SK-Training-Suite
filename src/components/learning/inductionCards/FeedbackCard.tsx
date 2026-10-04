// Feedback form built by the admin: stars, a number scale, comments, yes/no or a choice — each question
// required or optional as the admin decided. One answer per employee; they can change it later.

import { useState } from 'react';
import type { CardProps } from './AcknowledgeCard';
import type { FeedbackQuestion } from '../../../types/induction';

type Answer = string | number | boolean | undefined;

function Stars({ max, value, onChange }: { max: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star${n === 1 ? '' : 's'}`} aria-pressed={n <= value}
          className={`h-10 w-10 text-3xl leading-none transition ${n <= value ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}
        >★</button>
      ))}
    </div>
  );
}

function Scale({ q, value, onChange }: { q: FeedbackQuestion; value: number; onChange: (v: number) => void }) {
  const max = Math.min(Math.max(q.max ?? 10, 2), 10);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n} type="button" onClick={() => onChange(n)}
            className={`h-10 w-10 rounded-lg text-sm font-bold transition ${n === value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >{n}</button>
        ))}
      </div>
      {(q.low_label || q.high_label) && (
        <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>{q.low_label}</span><span>{q.high_label}</span></div>
      )}
    </div>
  );
}

export default function FeedbackCard({ section, response, onSubmit, showToast }: CardProps) {
  const cfg = section.config ?? {};
  const questions = cfg.questions ?? [];
  const saved = ((response?.response as { answers?: Record<string, Answer> } | undefined)?.answers) ?? {};
  const [answers, setAnswers] = useState<Record<string, Answer>>(saved);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (id: string, v: Answer) => setAnswers((a) => ({ ...a, [id]: v }));

  async function submit() {
    const missing = questions.find((q) => q.required && (answers[q.id] === undefined || answers[q.id] === ''));
    if (missing) { showToast(`Please answer: ${missing.label}`); return; }
    setBusy(true);
    try {
      const clean = Object.fromEntries(Object.entries(answers).filter(([id, v]) => questions.some((q) => q.id === id) && v !== undefined && v !== ''));
      await onSubmit({ answers: clean });
      setEditing(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (response && !editing) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <p className="text-2xl">🙏</p>
          <p className="mt-1 text-sm font-semibold text-emerald-800">{cfg.thanks?.trim() || 'Thank you for your feedback!'}</p>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-indigo-600 hover:underline">Change my answers</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {cfg.intro?.trim() && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{cfg.intro}</p>}
      {cfg.anonymous && <p className="text-xs text-slate-400">Your name is not shown with your answers.</p>}
      {questions.length === 0 && <p className="text-sm text-slate-400">No questions have been added to this form yet.</p>}

      {questions.map((q, i) => (
        <div key={q.id}>
          <p className="mb-2 text-sm font-semibold text-slate-800">
            {i + 1}. {q.label}{q.required && <span className="ml-1 text-red-500">*</span>}
          </p>
          {q.type === 'stars' && <Stars max={Math.min(Math.max(q.max ?? 5, 3), 10)} value={Number(answers[q.id] ?? 0)} onChange={(v) => set(q.id, v)} />}
          {q.type === 'scale' && <Scale q={q} value={Number(answers[q.id] ?? 0)} onChange={(v) => set(q.id, v)} />}
          {q.type === 'text' && (
            <textarea
              value={String(answers[q.id] ?? '')} onChange={(e) => set(q.id, e.target.value)} rows={3} maxLength={2000}
              className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          )}
          {q.type === 'yesno' && (
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)} type="button" onClick={() => set(q.id, v)}
                  className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${answers[q.id] === v ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >{v ? 'Yes' : 'No'}</button>
              ))}
            </div>
          )}
          {q.type === 'choice' && (
            <div className="space-y-2">
              {(q.options ?? []).filter((o) => o.trim()).map((o) => (
                <label key={o} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${answers[q.id] === o ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name={`${section.id}-${q.id}`} checked={answers[q.id] === o} onChange={() => set(q.id, o)} /> {o}
                </label>
              ))}
            </div>
          )}
        </div>
      ))}

      {questions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button" onClick={submit} disabled={busy}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >{busy ? 'Sending…' : response ? 'Save my changes' : 'Send feedback'}</button>
          {response && <button type="button" onClick={() => { setAnswers(saved); setEditing(false); }} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>}
        </div>
      )}
    </div>
  );
}
