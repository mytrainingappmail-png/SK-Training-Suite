// Admin: the extra PARTS of one reading section (Induction card, Project section, Course lesson). The section's own text is
// Part 1 (edited in the usual editor above); this lists Part 2, 3 ... each with its own title and text, in reading order.
// Parts live in the section's own data; saving the section saves them.

import RichTextEditor from './RichTextEditor';
import { addPart } from '../../types/sectionParts';
import type { SectionPart } from '../../types/sectionParts';

const INPUT = 'w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

export default function SectionPartsEditor({ parts, onChange, onImageUpload, resetKey }: {
  parts: SectionPart[];
  onChange: (next: SectionPart[]) => void;
  onImageUpload: (file: File) => Promise<string>;
  /** Changes when another section is opened, so the editors reload their text. */
  resetKey: string;
}) {
  if (parts.length < 2) return null;
  const main = parts[0];
  const extra = parts.slice(1);

  const setAt = (i: number, patch: Partial<SectionPart>) => onChange(parts.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 1 || j >= parts.length) return; // Part 1 stays first
    const next = [...parts];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function remove(i: number) {
    const p = parts[i];
    if (p.html.replace(/<[^>]*>/g, '').trim() && !window.confirm(`Delete “${p.title || `Part ${i + 1}`}”? Its text is deleted when you save.`)) return;
    const next = parts.filter((_, idx) => idx !== i);
    onChange(next.length < 2 ? [] : next);
  }

  return (
    <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
      <p className="text-xs font-bold text-indigo-900">Parts of this section ({parts.length})</p>
      <p className="mb-3 mt-0.5 text-xs text-indigo-800">The employee reads one part at a time, with “Next part” buttons and a progress bar. The text above is Part 1.</p>

      <label className="mb-3 block text-xs font-semibold text-slate-600">Part 1 title (the text above)
        <input value={main.title} onChange={(e) => setAt(0, { title: e.target.value })} placeholder="e.g. What is Sales?" className={`${INPUT} mt-1`} />
      </label>

      <div className="space-y-4">
        {extra.map((p, k) => {
          const i = k + 1;
          return (
            <div key={p.id} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">Part {i + 1}</span>
                <input value={p.title} onChange={(e) => setAt(i, { title: e.target.value })} placeholder="Part title, e.g. How do customers buy?" className={`${INPUT} min-w-[12rem] flex-1`} />
                <div className="flex items-center gap-1 text-slate-500">
                  <button type="button" disabled={i === 1} onClick={() => move(i, -1)} className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30" title="Move up" aria-label="Move part up">↑</button>
                  <button type="button" disabled={i === parts.length - 1} onClick={() => move(i, 1)} className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30" title="Move down" aria-label="Move part down">↓</button>
                  <button type="button" onClick={() => remove(i)} className="rounded px-2 py-1 text-red-500 hover:bg-red-50" title="Delete this part" aria-label="Delete part">🗑</button>
                </div>
              </div>
              <RichTextEditor value={p.html} onChange={(html) => setAt(i, { html })} onImageUpload={onImageUpload} minHeight={160} resetKey={`${resetKey}:${p.id}`} />
            </div>
          );
        })}
      </div>

      <button type="button" onClick={() => onChange(addPart(parts))} className="mt-3 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">+ Add another part</button>
    </div>
  );
}

