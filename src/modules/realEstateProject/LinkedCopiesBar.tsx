// In the project editor: "this project is also kept as a copy in <place>" - with a button to bring that copy up to date
// and a switch to do it automatically when the project is closed. Shown only when the project has a linked copy
// (a copy made between the main Projects and an Induction card). Only additions and changes travel; nothing is removed
// from the other copy. Where the copy lives (card, order, active) is never touched.

import { useCallback, useEffect, useState } from 'react';
import { loadProjectCopyLinks, setProjectCopyAuto, syncProjectCopy } from '../../services/realEstateProject/realEstateProjectService';
import type { ProjectCopyLink } from '../../services/realEstateProject/realEstateProjectService';

export default function LinkedCopiesBar({ projectId, refreshKey, onToast, onSynced }: {
  projectId: string;
  /** Changes whenever something was saved, so the "behind" note stays right. */
  refreshKey: string;
  onToast: (message: string) => void;
  onSynced?: () => void;
}) {
  const [links, setLinks] = useState<ProjectCopyLink[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLinks(await loadProjectCopyLinks(projectId));
  }, [projectId]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  if (links.length === 0) return null;

  async function update(link: ProjectCopyLink) {
    setBusy(link.link_id);
    try {
      await syncProjectCopy(projectId, link.other_id);
      onToast(`The copy in ${link.other_place} is up to date.`);
      await load();
      onSynced?.();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not update the copy.');
    } finally {
      setBusy(null);
    }
  }

  async function toggleAuto(link: ProjectCopyLink, on: boolean) {
    setLinks((ls) => ls.map((l) => (l.link_id === link.link_id ? { ...l, auto_sync: on } : l)));
    try { await setProjectCopyAuto(link.link_id, projectId, on); }
    catch (err) { onToast(err instanceof Error ? err.message : 'Could not save that choice.'); await load(); }
  }

  return (
    <div className="space-y-2">
      {links.map((l) => (
        <div key={l.link_id} className={`rounded-2xl border p-4 ${l.behind ? 'border-amber-300 bg-amber-50' : 'border-sky-200 bg-sky-50'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">🔗 This project is also kept as a copy in <span className="text-indigo-700">{l.other_place}</span></p>
              <p className={`mt-0.5 text-xs ${l.behind ? 'font-semibold text-amber-800' : 'text-slate-600'}`}>
                {l.behind
                  ? '⚠ The copy is behind - it does not have your latest saved changes yet.'
                  : '✓ The copy is up to date with what is saved here.'}
                {l.other_changed && ' The copy also has changes of its own; where you changed the same thing, the update replaces them.'}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Updating copies what is <b>saved</b> (save your changes first): name, descriptions, picture, pages, FAQs, brochures and the test. New things are added; nothing is removed from the copy, and its test results stay.
              </p>
            </div>
            <button
              type="button" onClick={() => void update(l)} disabled={busy !== null}
              className="flex-shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >{busy === l.link_id ? 'Updating…' : 'Update the copy now'}</button>
          </div>
          <label className="mt-2 flex items-start gap-2 text-xs text-slate-700">
            <input type="checkbox" className="mt-0.5" checked={l.auto_sync} onChange={(e) => void toggleAuto(l, e.target.checked)} />
            <span>Update the copy automatically when I close or save this project</span>
          </label>
        </div>
      ))}
    </div>
  );
}
