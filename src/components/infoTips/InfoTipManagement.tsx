// Settings → Info Tips: every tip in one list (platform owner only). Tips are normally added right on the
// screen with the "Edit tips" switch; this list is for finding, changing, hiding or deleting them.

import { useEffect, useMemo, useState } from "react";
import { useInfoTipStore, loadInfoTips, setInfoTipEditMode } from "../../services/infoTips/infoTipStore";
import { setInfoTipActive } from "../../repositories/infoTips/infoTipRepository";
import { INFO_TIP_EVERYWHERE, type InfoTip, type InfoTipInput } from "../../types/infoTip";
import InfoTipEditor from "./InfoTipEditor";

export default function InfoTipManagement() {
  const snap = useInfoTipStore();
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<InfoTipInput | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { void loadInfoTips(true); }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snap.tips.filter((t) => !q || `${t.label} ${t.route} ${t.title ?? ""} ${t.body}`.toLowerCase().includes(q));
  }, [snap.tips, query]);

  async function toggle(t: InfoTip) {
    setError("");
    try {
      await setInfoTipActive(t.id, !t.active);
      await loadInfoTips(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change the tip.");
    }
  }

  function edit(t: InfoTip) {
    setEditor({ id: t.id, route: t.route, label: t.label, title: t.title ?? "", body: t.body, active: t.active });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
        <h2 className="text-lg font-bold text-slate-900">Info Tips</h2>
        <p className="mt-1 text-sm text-slate-600">
          A small <span className="font-serif font-bold italic text-indigo-600">i</span> next to a button or heading that explains what it does.
          The same tips are shown to every company. Only you can write them.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Open any screen of the app.</li>
          <li>Press the round <b>✎</b> button at the bottom-left to start <b>Edit tips</b>.</li>
          <li>Press the orange <b>+</b> next to a control, write what it does, and save.</li>
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setInfoTipEditMode(!(snap.isOwner && snap.editMode))}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            {snap.editMode ? "Turn Edit tips off" : "Turn Edit tips on"}
          </button>
          <span className="text-xs text-slate-500">
            {snap.editMode
              ? "Edit tips is ON — go to any screen and use the + badges."
              : "Then open the screen you want and use the + badges."}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-800">All tips ({snap.tips.length})</h3>
          <div className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tips…"
              className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => setEditor({ route: "", label: "", title: "", body: "", active: true })}
              className="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              + Add a tip
            </button>
          </div>
        </div>

        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {!snap.loaded ? (
          <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">{snap.tips.length === 0 ? "No tips yet." : "No tip matches your search."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Control</th>
                  <th className="py-2 pr-3 font-semibold">Screen</th>
                  <th className="py-2 pr-3 font-semibold">Tip</th>
                  <th className="py-2 pr-3 font-semibold">Shown</th>
                  <th className="py-2 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((t) => (
                  <tr key={t.id} className={t.active ? "" : "bg-slate-50 text-slate-400"}>
                    <td className="py-2 pr-3 font-semibold text-slate-800">{t.label}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-500">{t.route === INFO_TIP_EVERYWHERE ? "Everywhere" : t.route}</td>
                    <td className="max-w-md py-2 pr-3 text-slate-600">
                      {t.title && <span className="font-semibold text-slate-800">{t.title}. </span>}
                      {t.body}
                    </td>
                    <td className="py-2 pr-3">
                      <label className="inline-flex items-center gap-1.5 text-xs">
                        <input type="checkbox" checked={t.active} onChange={() => void toggle(t)} />
                        {t.active ? "Yes" : "Hidden"}
                      </label>
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => edit(t)} className="rounded-lg px-3 py-1 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editor && <InfoTipEditor initial={editor} currentRoute={null} onClose={() => setEditor(null)} />}
    </div>
  );
}
