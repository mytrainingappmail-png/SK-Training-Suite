// The small form the platform owner uses to write / change / hide / delete one tip.

import { useState } from "react";
import { saveInfoTip, deleteInfoTip } from "../../repositories/infoTips/infoTipRepository";
import { loadInfoTips } from "../../services/infoTips/infoTipStore";
import {
  INFO_TIP_BODY_MAX, INFO_TIP_TITLE_MAX, INFO_TIP_LABEL_MAX, INFO_TIP_EVERYWHERE,
  type InfoTipInput,
} from "../../types/infoTip";

interface Props {
  initial: InfoTipInput;
  /** The screen the owner is looking at (for the "only on this screen" choice). Null when added by hand from the list. */
  currentRoute: string | null;
  onClose: () => void;
}

export default function InfoTipEditor({ initial, currentRoute, onClose }: Props) {
  const [label, setLabel] = useState(initial.label);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [active, setActive] = useState(initial.active);
  const [everywhere, setEverywhere] = useState(initial.route === INFO_TIP_EVERYWHERE);
  const [manualRoute, setManualRoute] = useState(initial.route === INFO_TIP_EVERYWHERE ? "" : initial.route);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isNew = !initial.id;
  const route = everywhere ? INFO_TIP_EVERYWHERE : (currentRoute ?? manualRoute).trim();

  async function handleSave() {
    if (!label.trim()) { setError("Type the name of the control exactly as it appears on the screen."); return; }
    if (!body.trim()) { setError("Write what this control does."); return; }
    if (!route) { setError("Type the screen address, for example /quiz-admin/host/:id."); return; }
    setBusy(true);
    setError("");
    try {
      await saveInfoTip({ id: initial.id, route, label, title, body, active });
      await loadInfoTips(true);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the tip.");
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!initial.id) return;
    if (!confirm(`Delete the tip for “${initial.label}”?`)) return;
    setBusy(true);
    setError("");
    try {
      await deleteInfoTip(initial.id);
      await loadInfoTips(true);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the tip.");
      setBusy(false);
    }
  }

  return (
    <div data-info-tip-ui className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white text-slate-800 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{isNew ? "Add a tip" : "Edit tip"}</h2>
            <p className="text-xs text-slate-500">Shown to everyone as a small “i” next to this control.</p>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Close" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Control name</label>
            <input
              value={label}
              maxLength={INFO_TIP_LABEL_MAX}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-400">The words on the button or heading. If the app’s wording changes later, update this too.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Where should it show?</label>
            <div className="space-y-1.5">
              <label className="flex items-start gap-2">
                <input type="radio" className="mt-1" checked={!everywhere} onChange={() => setEverywhere(false)} />
                <span>
                  Only on this screen
                  {currentRoute
                    ? <span className="block break-all font-mono text-xs text-slate-400">{currentRoute}</span>
                    : <input value={manualRoute} onChange={(e) => setManualRoute(e.target.value)} placeholder="/quiz-admin/host/:id" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs outline-none focus:border-indigo-500" />}
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" className="mt-1" checked={everywhere} onChange={() => setEverywhere(true)} />
                <span>Everywhere in the app <span className="block text-xs text-slate-400">Every control with this name gets this tip.</span></span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Heading (optional)</label>
            <input
              value={title}
              maxLength={INFO_TIP_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">What does it do?</label>
            <textarea
              value={body}
              maxLength={INFO_TIP_BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Say what happens when it is pressed, and when to use it."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
            <p className="mt-1 text-right text-xs text-slate-400">{body.length}/{INFO_TIP_BODY_MAX}</p>
          </div>

          <div className="rounded-xl bg-slate-900 p-3 text-slate-100">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">Preview</p>
            {title.trim() && <p className="text-sm font-bold">{title.trim()}</p>}
            <p className="whitespace-pre-line text-xs leading-relaxed text-slate-300">{body.trim() || "Your text appears here."}</p>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>Show this tip to everyone <span className="text-xs text-slate-400">(untick to hide it without deleting)</span></span>
          </label>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
          {isNew ? <span /> : <button onClick={handleDelete} disabled={busy} className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">Delete</button>}
          <div className="flex gap-2">
            <button onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button onClick={handleSave} disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{busy ? "Saving…" : "Save tip"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
