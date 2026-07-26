import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { listQuizzes, deleteQuiz, publishQuiz, unpublishQuiz } from "../../services/quiz/quizService";
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

  return (
    <div className="space-y-6">
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
            <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
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
                    Edit
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
