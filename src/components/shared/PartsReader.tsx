// Reads a long section ONE PART AT A TIME (Induction card, Project section, Course lesson): a progress bar and a row of numbered
// part chips on top, the current part's text in a clean reading card, "Previous / Next part" buttons below. Questions & answers and
// the section's test (passed in as `endSlot`) appear after the last part has been reached, so the employee reads first.
// Nothing is saved here - opening the section is what the screens already record.

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import ContentWatermark, { noCopyProps } from './ContentWatermark';
import type { WatermarkConfig } from './ContentWatermark';
import TranslatableHtml from './TranslatableHtml';
import type { ReadablePart } from '../../types/sectionParts';

export default function PartsReader({ parts, watermark, noCopy = false, endSlot, endUnlocked = false, proseClassName }: {
  parts: ReadablePart[];
  watermark?: WatermarkConfig;
  noCopy?: boolean;
  /** Shown after the last part has been reached (the section's FAQ and test). */
  endSlot?: ReactNode;
  /** Show the end slot right away (e.g. the test was already passed). */
  endUnlocked?: boolean;
  proseClassName?: string;
}) {
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const top = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const total = parts.length;
  const part = parts[Math.min(index, total - 1)];

  useEffect(() => {
    setSeen((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
    if (first.current) { first.current = false; return; }
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [index]);

  const finished = seen.size >= total;
  const pct = Math.round(((index + 1) / total) * 100);

  return (
    <div ref={top} className="scroll-mt-4">
      {/* where am I */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 p-3 ring-1 ring-indigo-100 sm:p-4">
        <div className="flex items-center justify-between gap-3 text-xs font-bold text-indigo-900">
          <span>Part {index + 1} of {total}</span>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-indigo-700">{finished ? '✓ All parts opened' : `${seen.size} of ${total} opened`}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Parts">
          {parts.map((p, i) => {
            const active = i === index;
            const done = seen.has(i) && !active;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setIndex(i)}
                className={`flex max-w-[12rem] flex-shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                  active ? 'bg-indigo-600 text-white shadow-sm' : done ? 'bg-white text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${active ? 'bg-white/25' : done ? 'bg-emerald-100' : 'bg-slate-100'}`}>{done ? '✓' : i + 1}</span>
                <span className="truncate">{p.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* the part */}
      <article className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">Part {index + 1}</p>
          <h3 className="text-lg font-bold leading-snug text-slate-900">{part.title}</h3>
        </header>
        <div className="relative">
          {watermark && <ContentWatermark config={watermark} />}
          <TranslatableHtml
            key={part.id}
            className={proseClassName ?? 'prose prose-sm relative max-w-none p-4 text-sm leading-relaxed text-slate-700 sm:p-6 [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:p-2'}
            html={part.html}
            {...noCopyProps(noCopy)}
          />
        </div>
      </article>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Previous part
        </button>
        {index < total - 1 ? (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
          >
            Next: {parts[index + 1].title} →
          </button>
        ) : (
          <span className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700">✓ You reached the last part</span>
        )}
      </div>

      {endSlot && (finished || endUnlocked) && <div className="mt-6">{endSlot}</div>}
      {endSlot && !finished && !endUnlocked && (
        <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-medium text-slate-500">
          Open all {total} parts to see the questions and the test for this section.
        </p>
      )}
    </div>
  );
}
