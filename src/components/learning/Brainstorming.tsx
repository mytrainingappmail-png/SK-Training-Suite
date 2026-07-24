// "Brainstorming" — a lightweight, no-scoring puzzles/riddles section for
// employee engagement. Deliberately kept separate from the assessment
// engine: nothing here is graded or recorded, it's just a fun brain-teaser
// break, revealed on click.

import { useEffect, useMemo, useState } from 'react';
import { loadItems } from '../../services/brainstorming/brainstormingService';
import SectionHeroBanner from './SectionHeroBanner';
import type { BrainstormingItem } from '../../types/brainstorming';

function difficultyCls(d: string): string {
  if (d === 'Easy') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (d === 'Hard') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
  return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}
    </div>
  );
}

function Brainstorming() {
  const [items, setItems] = useState<BrainstormingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    loadItems()
      .then((rows) => setItems(rows.filter((r) => r.active)))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }, []);

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category))).sort(), [items]);
  const filtered = categoryFilter ? items.filter((i) => i.category === categoryFilter) : items;

  return (
    <div className="space-y-6">
      <SectionHeroBanner
        eyebrow="Take a break"
        title="Brainstorming"
        subtitle="Puzzles and riddles to stretch your thinking — no scores, just fun."
        statLabel="Puzzles"
        statValue={items.length}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {categories.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryFilter('')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                categoryFilter === '' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  categoryFilter === c ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">{error}</div>}

        {loading && <Skeleton />}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
            No puzzles yet — check back soon.
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filtered.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-5 transition hover:border-slate-300 hover:shadow-md">
                <div className="mb-3 flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${difficultyCls(item.difficulty)}`}>
                    {item.difficulty}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">{item.category}</span>
                </div>
                <p className="text-sm font-medium leading-relaxed text-slate-800">{item.question}</p>
                <button
                  onClick={() => toggleReveal(item.id)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                >
                  {revealed.has(item.id) ? 'Hide Answer ▲' : 'Reveal Answer ▼'}
                </button>
                {revealed.has(item.id) && (
                  <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">{item.answer}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Brainstorming;
