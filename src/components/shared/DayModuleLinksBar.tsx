// Shown in the Induction Day editor and in the Course Builder (selected module): "this is also kept as a Module / Day in ..." with a button
// to bring that copy up to date and a switch to do it automatically when this one is closed. Shown only when a linked copy exists.
// Only additions and changes travel; nothing is removed from the other copy, and deleting one never deletes the other.

import { useCallback, useEffect, useState } from 'react';
import { loadDayModuleLinks, setDayModuleAuto, syncDayModuleCopy } from '../../services/induction/inductionCourseCopyService';
import type { DayModuleKind, DayModuleLink } from '../../services/induction/inductionCourseCopyService';

export default function DayModuleLinksBar({ kind, id, refreshKey, onToast, onSynced, dark = false }: {
  kind: DayModuleKind;
  id: string;
  /** Changes whenever something was saved, so the "behind" note stays right. */
  refreshKey: string;
  onToast: (message: string) => void;
  onSynced?: () => void;
  /** The Course Builder is dark; the Induction screen is light. */
  dark?: boolean;
}) {
  const [links, setLinks] = useState<DayModuleLink[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => { setLinks(await loadDayModuleLinks(kind, id)); }, [kind, id]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  if (links.length === 0) return null;
  const thisName = kind === 'day' ? 'Day' : 'Module';
  const otherName = kind === 'day' ? 'Module' : 'Day';

  async function update(link: DayModuleLink) {
    setBusy(link.link_id);
    try {
      await syncDayModuleCopy(kind, id, link.other_id);
      onToast(`The ${otherName} “${link.other_name}” is up to date.`);
      await load();
      onSynced?.();
    } catch (err) {
      onToast(err instanceof Error ? err.message : `Could not update the ${otherName}.`);
    } finally {
      setBusy(null);
    }
  }

  async function toggleAuto(link: DayModuleLink, on: boolean) {
    setLinks((ls) => ls.map((l) => (l.link_id === link.link_id ? { ...l, auto_sync: on } : l)));
    try { await setDayModuleAuto(link.link_id, kind, on); }
    catch (err) { onToast(err instanceof Error ? err.message : 'Could not save that choice.'); await load(); }
  }

  const box = (behind: boolean) => dark
    ? (behind ? 'border-amber-500/40 bg-amber-500/10' : 'border-sky-500/30 bg-sky-500/10')
    : (behind ? 'border-amber-300 bg-amber-50' : 'border-sky-200 bg-sky-50');
  const strong = dark ? 'text-slate-100' : 'text-slate-800';
  const place = dark ? 'text-indigo-300' : 'text-indigo-700';
  const note = (behind: boolean) => dark ? (behind ? 'font-semibold text-amber-300' : 'text-slate-400') : (behind ? 'font-semibold text-amber-800' : 'text-slate-600');
  const small = dark ? 'text-slate-500' : 'text-slate-500';
  const label = dark ? 'text-slate-300' : 'text-slate-700';

  return (
    <div className="space-y-2">
      {links.map((l) => (
        <div key={l.link_id} className={`rounded-2xl border p-4 text-left ${box(l.behind)}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-sm font-bold ${strong}`}>🔗 This {thisName} is also kept as a {otherName} — <span className={place}>{l.other_name}</span> <span className="font-normal opacity-70">({l.other_place})</span></p>
              <p className={`mt-0.5 text-xs ${note(l.behind)}`}>
                {l.behind
                  ? `⚠ The ${otherName} is behind — it does not have your latest saved changes yet.`
                  : `✓ The ${otherName} is up to date with what is saved here.`}
                {l.other_changed && ` The ${otherName} also has changes of its own; where you changed the same thing, the update replaces them.`}
              </p>
              <p className={`mt-0.5 text-[11px] ${small}`}>
                Updating copies what is <b>saved</b>: name, description, picture, page texts and tests with their questions. New things are added; nothing is removed from the {otherName}, and deleting one never deletes the other.
              </p>
            </div>
            <button
              type="button" onClick={() => void update(l)} disabled={busy !== null}
              className="flex-shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >{busy === l.link_id ? 'Updating…' : `Update the ${otherName} now`}</button>
          </div>
          <label className={`mt-2 flex items-start gap-2 text-xs ${label}`}>
            <input type="checkbox" className="mt-0.5" checked={l.auto_sync} onChange={(e) => void toggleAuto(l, e.target.checked)} />
            <span>Update the {otherName} automatically when I {kind === 'day' ? 'close this Day' : 'leave the Course Builder'}</span>
          </label>
        </div>
      ))}
    </div>
  );
}
