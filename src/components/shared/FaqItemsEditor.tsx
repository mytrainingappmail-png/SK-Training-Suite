// All the questions & answers of an FAQ section on one screen — same look as TestQuestionsEditor:
// numbered cards, a bar that stays at the bottom with "+ Add Question" and the save buttons
// (passed in as `footer`, because an FAQ is saved together with its section).

import type { ReactNode } from 'react';

interface FaqItem { question: string; answer: string }

const INPUT = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

export default function FaqItemsEditor({ items, onChange, footer }: { items: FaqItem[]; onChange: (next: FaqItem[]) => void; footer: ReactNode }) {
  const set = (i: number, patch: Partial<FaqItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  return (
    <div>
      <div className="space-y-4">
        {items.length === 0 && <p className="text-xs text-slate-400">No questions yet — add one below, or bulk upload a CSV.</p>}
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-700">Q{i + 1}</p>
              <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
            </div>
            <textarea
              value={item.question} rows={2} placeholder="Type the question"
              onChange={(e) => set(i, { question: e.target.value })}
              className={`${INPUT} mb-2`}
            />
            <textarea
              value={item.answer} rows={3} placeholder="Type the answer"
              onChange={(e) => set(i, { answer: e.target.value })}
              className={INPUT}
            />
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <button type="button" onClick={() => onChange([...items, { question: '', answer: '' }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          + Add Question
        </button>
        <div className="flex items-center gap-2">{footer}</div>
      </div>
    </div>
  );
}
