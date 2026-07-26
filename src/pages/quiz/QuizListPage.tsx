import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { listQuizzes, deleteQuiz, publishQuiz, unpublishQuiz, duplicateQuiz, mergeQuizzes } from "../../services/quiz/quizService";
import { launchSession } from "../../services/quiz/quizSessionService";
import { getSettings } from "../../repositories/quiz/quizSettingsRepository";
import type { Quiz } from "../../types/quiz";

export default function QuizListPage() {
  const admin = getCurrentQuizAdmin();
  const canEdit = canEditQuizContent();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);
  const [mergeTitle, setMergeTitle] = useState("");
  const [showMergeForm, setShowMergeForm] = useState(false);

  function refresh() {
    if (!admin) return;
    setLoading(true);
    listQuizzes(admin.company_id).then(setQuizzes).finally(() => setLoading(false));
  }

  useEffect(refresh, [admin]);

  const filtered = quizzes.filter((q) => q.title.toLowerCase().includes(search.toLowerCase()));

  async function handleDelete(id: string) {
    if (!confirm("Delete this quiz? This cannot be undone.")) return;
    setBusyId(id);
    try {
      await deleteQuiz(id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleTogglePublish(q: Quiz) {
    setBusyId(q.id);
    setError("");
    try {
      if (q.status === "published") await unpublishQuiz(q.id);
      else await publishQuiz(q.id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleLaunch(q: Quiz) {
    if (!admin) return;
    setBusyId(q.id);
    setError("");
    try {
      const settings = await getSettings(admin.company_id);
      const session = await launchSession(q.id, admin.company_id, admin.id, settings.default_join_mode);
      navigate(ROUTES.QUIZ_ADMIN_HOST.replace(":sessionId", session.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to launch.");
      setBusyId(null);
    }
  }

  async function handleDuplicate(q: Quiz) {
    if (!admin) return;
    setBusyId(q.id);
    setError("");
    try {
      await duplicateQuiz(q.id, admin.company_id, admin.id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to duplicate.");
    } finally {
      setBusyId(null);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleMerge() {
    if (!admin || selected.size < 2) return;
    setMerging(true);
    setError("");
    try {
      const titles = quizzes.filter((q) => selected.has(q.id)).map((q) => q.title);
      await mergeQuizzes([...selected], admin.company_id, admin.id, mergeTitle || titles.join(" + "));
      setSelected(new Set());
      setMergeTitle("");
      setShowMergeForm(false);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to merge quizzes.");
    } finally {
      setMerging(false);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">My Quizzes</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage and launch</p>
        </div>
        {canEdit && (
          <Link
            to={ROUTES.QUIZ_ADMIN_BUILDER_NEW}
            className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2"
          >
            + New Quiz
          </Link>
        )}
      </div>

      <input
        className="w-full rounded-lg bg-slate-900 border border-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500"
        placeholder="🔍  Search quizzes…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
      )}

      {loading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          No quizzes found.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((q) => (
            <div
              key={q.id}
              className={`bg-slate-900 border rounded-2xl p-5 flex flex-col ${
                selected.has(q.id) ? "border-violet-500" : "border-slate-800"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                    q.status === "published" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700/50 text-slate-300"
                  }`}
                >
                  {q.status}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                  {q.difficulty}
                </span>
              </div>
              <div className="font-semibold text-white text-sm mb-1">{q.title}</div>
              <div className="text-xs text-slate-500 mb-4 line-clamp-2">{q.description || "No description"}</div>

              <div className="mt-auto flex flex-wrap gap-2 pt-3 border-t border-slate-800">
                {canEdit ? (
                  <Link
                    to={ROUTES.QUIZ_ADMIN_BUILDER_EDIT.replace(":quizId", q.id)}
                    className="text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-2.5 py-1.5"
                  >
                    ✏️ Edit
                  </Link>
                ) : (
                  <span className="text-xs text-slate-500 italic px-1 py-1.5">View only</span>
                )}
                {canEdit && (
                  <button
                    disabled={busyId === q.id}
                    onClick={() => handleTogglePublish(q)}
                    className="text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                  >
                    {q.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                )}
                {q.status === "published" && canEdit && (
                  <button
                    disabled={busyId === q.id}
                    onClick={() => handleLaunch(q)}
                    className="text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                  >
                    ▶ Launch
                  </button>
                )}
                {canEdit && (
                  <button
                    disabled={busyId === q.id}
                    onClick={() => handleDelete(q.id)}
                    className="text-xs font-semibold text-red-300 hover:text-red-200 border border-red-900/50 rounded-lg px-2.5 py-1.5 disabled:opacity-50 ml-auto"
                  >
                    🗑
                  </button>
                )}
                {canEdit && (
                  <button
                    disabled={busyId === q.id}
                    onClick={() => handleDuplicate(q)}
                    className="text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                  >
                    📄 Duplicate
                  </button>
                )}
                {canEdit && (
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 border border-dashed border-slate-700 rounded-lg px-2.5 py-1.5 cursor-pointer">
                    <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleSelected(q.id)} />
                    Merge
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canEdit && selected.size >= 2 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900 border border-violet-500 rounded-2xl shadow-2xl p-4 w-[92%] max-w-lg">
          {!showMergeForm ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-white font-semibold flex-1">{selected.size} quizzes selected</span>
              <button
                onClick={() => setShowMergeForm(true)}
                className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2"
              >
                🔗 Merge Selected
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-slate-400 hover:text-white px-2"
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
                New quiz title
              </label>
              <input
                autoFocus
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                placeholder={quizzes.filter((q) => selected.has(q.id)).map((q) => q.title).join(" + ")}
                value={mergeTitle}
                onChange={(e) => setMergeTitle(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowMergeForm(false)}
                  className="text-xs text-slate-400 hover:text-white px-3 py-2"
                >
                  Cancel
                </button>
                <button
                  disabled={merging}
                  onClick={handleMerge}
                  className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg px-4 py-2"
                >
                  {merging ? "Merging…" : "🔗 Create Merged Quiz"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
