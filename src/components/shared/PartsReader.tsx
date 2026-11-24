// Reads a long section the way a good course page does: the OVERVIEW (headline + intro) first, then the PARTS as cards below it.
// Tapping a part card opens that part on its own (with "Previous / Next part" and a way back to the overview); a part that was
// read gets a tick on its card. The section's questions & answers and its test (passed in as `endSlot`) appear under the cards
// once every part has been opened, so the employee reads first. Nothing is saved here - opening the section is what the screens
// already record.

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import ContentWatermark, { noCopyProps } from './ContentWatermark';
import type { WatermarkConfig } from './ContentWatermark';
import TranslatableHtml from './TranslatableHtml';
import type { ReadablePart } from '../../types/sectionParts';

const ACCENTS = [
  'from-indigo-500 to-violet-500',
  'from-emerald-500 to-teal-400',
  'from-amber-500 to-orange-400',
  'from-rose-500 to-pink-500',
  'from-sky-500 to-cyan-400',
  'from-fuchsia-500 to-purple-500',
];

const readMinutes = (html: string) => Math.max(1, Math.round(html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length / 200));

export default function PartsReader({ parts, watermark, noCopy = false, endSlot, endUnlocked = false, proseClassName }: {
  /** parts[0] is the overview (the section's own text); the others are Part 1, Part 2 ... */
  parts: ReadablePart[];
  watermark?: WatermarkConfig;
  noCopy?: boolean;
  /** Shown under the part cards once every part has been opened (the section's FAQ and test). */
  endSlot?: ReactNode;
  /** Show the end slot right away (e.g. the test was already passed). */
  endUnlocked?: boolean;
  proseClassName?: string;
}) {
  const overview = parts[0];
  const items = parts.slice(1);
  const total = items.length;
  // null = the overview with the part cards; a number = that part (1-based) is open
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<number>>(() => new Set());
  const top = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (open !== null) setSeen((prev) => (prev.has(open) ? prev : new Set(prev).add(open)));
    if (first.current) { first.current = false; return; }
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [open]);

  const finished = total > 0 && seen.size >= total;
  const prose = proseClassName ?? 'prose prose-sm relative max-w-none p-4 text-sm leading-relaxed text-slate-700 sm:p-6 [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:p-2';

  // ── one part on its own page ────────────────────────────────────────────────
  if (open !== null && items[open - 1]) {
    const part = items[open - 1];
    return (
      <div ref={top} className="scroll-mt-4">
        <button type="button" onClick={() => setOpen(null)} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
          ← Back to overview &amp; parts
        </button>

        <div className="rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 p-3 ring-1 ring-indigo-100 sm:p-4">
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-indigo-900">
            <span>Part {open} of {total}</span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-indigo-700">{seen.size} of {total} read</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={open}>
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300" style={{ width: `${Math.round((open / total) * 100)}%` }} />
          </div>
        </div>

        <article className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
            <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">Part {open}</p>
            <h3 className="text-lg font-bold leading-snug text-slate-900">{part.title}</h3>
          </header>
          <div className="relative">
            {watermark && <ContentWatermark config={watermark} />}
            <TranslatableHtml key={part.id} className={prose} html={part.html} {...noCopyProps(noCopy)} />
          </div>
        </article>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(open > 1 ? open - 1 : null)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            {open > 1 ? '← Previous part' : '← Overview'}
          </button>
          {open < total ? (
            <button type="button" onClick={() => setOpen(open + 1)} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95">
              Next: {items[open].title} →
            </button>
          ) : (
            <button type="button" onClick={() => setOpen(null)} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95">
              ✓ Done — back to all parts
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── the overview, then the part cards ───────────────────────────────────────
  return (
    <div ref={top} className="scroll-mt-4">
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">Overview</p>
          {overview.title && overview.title !== 'Overview' && <h3 className="text-lg font-bold leading-snug text-slate-900">{overview.title}</h3>}
        </header>
        <div className="relative">
          {watermark && <ContentWatermark config={watermark} />}
          <TranslatableHtml key={overview.id} className={prose} html={overview.html} {...noCopyProps(noCopy)} />
        </div>
      </article>

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Parts · {total}</h3>
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">{finished ? '✓ All parts read' : `${seen.size} of ${total} read`}</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p, i) => {
            const n = i + 1;
            const read = seen.has(n);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpen(n)}
                className="group flex flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
              >
                <div className={`relative flex h-24 items-end bg-gradient-to-br ${ACCENTS[i % ACCENTS.length]} px-4 pb-3 text-white`}>
                  <span className="text-4xl font-black leading-none opacity-90">{n}</span>
                  <span className="ml-2 pb-1 text-xs font-bold uppercase tracking-wide opacity-90">Part</span>
                  {read && <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-emerald-700">✓ Read</span>}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <p className="text-sm font-bold leading-snug text-slate-900">{p.title}</p>
                  <p className="text-xs text-slate-500">{readMinutes(p.html)} min read</p>
                  <span className="mt-2 text-xs font-bold text-indigo-600 group-hover:underline">{read ? 'Read again →' : 'Start reading →'}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {endSlot && (finished || endUnlocked) && <div className="mt-8">{endSlot}</div>}
      {endSlot && !finished && !endUnlocked && (
        <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-medium text-slate-500">
          Read all {total} parts to see the questions and the test for this section.
        </p>
      )}
    </div>
  );
}
