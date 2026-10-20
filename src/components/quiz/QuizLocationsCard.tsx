// Settings → Locations: the trainer's own list (Mohali, Gurgaon, ...). Nothing is built in — add as many as needed.

import { useState } from "react";
import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { createLocation, renameLocation, setLocationActive, deleteLocation } from "../../repositories/quiz/quizLocationRepository";
import { loadQuizLocations, useQuizLocation } from "../../services/quiz/quizLocationStore";

export default function QuizLocationsCard() {
  const admin = getCurrentQuizAdmin();
  const canEdit = canEditQuizContent();
  const { locations, loaded } = useQuizLocation();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function run(fn: () => Promise<unknown>) {
    if (!admin) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      await loadQuizLocations(admin.company_id, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the change.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    if (!admin) return;
    const clean = name.trim();
    if (!clean) { setError("Type the location name first."); return; }
    await run(async () => { await createLocation(admin.company_id, clean); setName(""); });
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete the location “${label}”? Quizzes, exams and past results are NOT deleted — they just show under “No location”.`)) return;
    await run(() => deleteLocation(id));
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-white">📍 Locations</h2>
        <p className="text-sm text-slate-400 mt-1">
          Run tests city by city. Add your locations here, then give each quiz or exam a location in its builder. A <b>📍 switch</b> appears at the top
          so you can show only one location's quizzes, exams, results and dashboard — or all of them.
        </p>
      </div>

      {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

      {!loaded ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : locations.length === 0 ? (
        <p className="text-sm text-slate-500">No locations yet. Add your first one below.</p>
      ) : (
        <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
          {locations.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              {editingId === l.id ? (
                <>
                  <input
                    autoFocus
                    value={editName}
                    maxLength={60}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void run(async () => { await renameLocation(l.id, editName); setEditingId(null); }); if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 min-w-[10rem] rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500"
                  />
                  <button disabled={busy} onClick={() => void run(async () => { await renameLocation(l.id, editName); setEditingId(null); })} className="text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg px-3 py-1.5 disabled:opacity-50">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-slate-400 hover:text-white px-2 py-1.5">Cancel</button>
                </>
              ) : (
                <>
                  <span className={`flex-1 text-sm font-medium ${l.active ? "text-white" : "text-slate-500 line-through"}`}>📍 {l.name}{!l.active && <span className="ml-2 text-[11px] no-underline text-slate-500">(hidden)</span>}</span>
                  {canEdit && (
                    <>
                      <button disabled={busy} onClick={() => { setEditingId(l.id); setEditName(l.name); }} className="text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-2.5 py-1.5">Rename</button>
                      <button disabled={busy} onClick={() => void run(() => setLocationActive(l.id, !l.active))} className="text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-2.5 py-1.5" title={l.active ? "Hide it from the switch and the builders (nothing is deleted)" : "Show it again"}>
                        {l.active ? "Hide" : "Show"}
                      </button>
                      <button disabled={busy} onClick={() => void handleDelete(l.id, l.name)} className="text-xs font-semibold text-red-300 hover:text-red-200 border border-red-900/50 rounded-lg px-2.5 py-1.5">🗑</button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
            placeholder="Location name, e.g. Mohali"
            className="flex-1 min-w-[12rem] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
          />
          <button disabled={busy} onClick={() => void handleAdd()} className="text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg px-4 py-2">+ Add</button>
        </div>
      )}
    </section>
  );
}
