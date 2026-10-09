import { useEffect, useState } from "react";

import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { listRecycleBin, restoreFromBin, deleteForever } from "../../repositories/quiz/quizRecycleBinRepository";
import type { RecycleItem, RecycleType } from "../../repositories/quiz/quizRecycleBinRepository";

const KIND: Record<RecycleType, { icon: string; label: string; tone: string }> = {
  quiz: { icon: "📝", label: "Quiz / Exam", tone: "bg-violet-500/15 text-violet-300" },
  quiz_session: { icon: "📊", label: "Live quiz results", tone: "bg-amber-500/15 text-amber-300" },
  exam_session: { icon: "🎓", label: "Exam results", tone: "bg-emerald-500/15 text-emerald-300" },
  survey: { icon: "🗳️", label: "Survey", tone: "bg-sky-500/15 text-sky-300" },
};

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

/** Everything deleted in Live Quiz lands here for 30 days and can be put back with one click. */
export default function QuizRecycleBinPage() {
  const admin = getCurrentQuizAdmin();
  const canEdit = canEditQuizContent();
  const [items, setItems] = useState<RecycleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function refresh() {
    if (!admin) return;
    listRecycleBin(admin.company_id)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the bin."))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [admin]);

  async function handleRestore(item: RecycleItem) {
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const title = await restoreFromBin(item.id);
      setNotice(`Restored “${title || item.title}”.`);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore it.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleForever(item: RecycleItem) {
    if (!confirm(`Delete “${item.title}” forever? It cannot be brought back after this.`)) return;
    setBusyId(item.id);
    setError("");
    try {
      await deleteForever(item.id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete it.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="text-xl font-bold text-white">🗑 Recycle Bin</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Anything you delete in Live Quiz — a quiz, an exam, results, a survey — waits here for 30 days. Press Restore to get it back exactly as it was.
        </p>
      </div>

      {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
      {notice && <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">✅ {notice}</div>}

      {loading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-2xl">The bin is empty.</div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const kind = KIND[it.entity_type];
            const left = daysLeft(it.expires_at);
            return (
              <div key={it.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${kind.tone}`}>{kind.icon} {kind.label}</span>
                    <span className="font-semibold text-white text-sm break-words">{it.title || "Untitled"}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {it.subtitle && <>{it.subtitle} · </>}Deleted {new Date(it.deleted_at).toLocaleString()} ·{" "}
                    <span className={left <= 3 ? "text-red-300" : ""}>{left} day{left === 1 ? "" : "s"} left</span>
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRestore(it)}
                      disabled={busyId === it.id}
                      className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg px-3.5 py-2"
                    >
                      {busyId === it.id ? "Working…" : "↩ Restore"}
                    </button>
                    <button
                      onClick={() => handleForever(it)}
                      disabled={busyId === it.id}
                      className="text-xs font-semibold text-red-300 hover:text-red-200 border border-red-900/50 rounded-lg px-3 py-2 disabled:opacity-50"
                    >
                      Delete forever
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
