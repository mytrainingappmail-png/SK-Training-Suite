import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { getCurrentQuizAdmin } from "../../services/quiz/quizAdminSession";
import { listQuizzes } from "../../services/quiz/quizService";
import type { Quiz } from "../../types/quiz";

export default function QuizDashboardPage() {
  const admin = getCurrentQuizAdmin();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!admin) return;
    listQuizzes(admin.company_id)
      .then(setQuizzes)
      .finally(() => setLoading(false));
  }, [admin]);

  const published = quizzes.filter((q) => q.status === "published").length;
  const drafts = quizzes.filter((q) => q.status === "draft").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Welcome back 👋</h1>
        <p className="text-slate-400 text-sm mt-1">{admin?.display_name || admin?.username}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Quizzes" value={quizzes.length} />
        <StatCard label="Published" value={published} />
        <StatCard label="Drafts" value={drafts} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300">Recent Quizzes</h2>
          <Link
            to={ROUTES.QUIZ_ADMIN_BUILDER_NEW}
            className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2"
          >
            + New Quiz
          </Link>
        </div>

        {loading ? (
          <div className="text-slate-500 text-sm">Loading…</div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
            No quizzes yet. Create your first one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quizzes.slice(0, 6).map((q) => (
              <Link
                key={q.id}
                to={ROUTES.QUIZ_ADMIN_BUILDER_EDIT.replace(":quizId", q.id)}
                className="block bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-violet-500/50 transition-colors"
              >
                <div className="font-semibold text-white text-sm">{q.title}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {q.difficulty} · {q.status === "published" ? "Published" : "Draft"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4">
      <div className="text-2xl font-bold text-white font-mono">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}
