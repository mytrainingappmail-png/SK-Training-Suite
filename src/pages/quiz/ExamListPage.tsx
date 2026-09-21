import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { listQuizzes, deleteQuiz, publishQuiz, unpublishQuiz, duplicateQuiz } from "../../services/quiz/quizService";
import { createExamSession, listExamSessions } from "../../repositories/exam/examAdminRepository";
import type { Quiz } from "../../types/quiz";
import type { ExamSession } from "../../types/exam";

type StartMode = "now" | "in" | "at";

function sessionLabel(s: ExamSession): string {
  const now = Date.now();
  if (s.finished_at) return "Finished";
  if (now < new Date(s.opens_at).getTime()) return "Waiting to start";
  if (now >= new Date(s.deadline_at).getTime()) return "Closing";
  return "Running";
}

/** Exams tab - the paper-style tests. Content is edited in the same builder as Live Quiz questions; this page starts, and reopens, the sessions. */
export default function ExamListPage() {
  const admin = getCurrentQuizAdmin();
  const canEdit = canEditQuizContent();
  const navigate = useNavigate();
  const [exams, setExams] = useState<Quiz[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [openSessionsFor, setOpenSessionsFor] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ExamSession[]>([]);

  const [startTarget, setStartTarget] = useState<Quiz | null>(null);
  const [durationText, setDurationText] = useState("60");
  const [startMode, setStartMode] = useState<StartMode>("now");
  const [startInMinutes, setStartInMinutes] = useState("5");
  const [startAtLocal, setStartAtLocal] = useState("");
  const [starting, setStarting] = useState(false);

  function refresh() {
    if (!admin) return;
    setLoading(true);
    listQuizzes(admin.company_id).then((all) => setExams(all.filter((q) => q.mode === "exam"))).finally(() => setLoading(false));
  }

  useEffect(refresh, [admin]);

  const filtered = exams.filter((q) => q.title.toLowerCase().includes(search.toLowerCase()));

  async function run(id: string, fn: () => Promise<unknown>, fallback: string) {
    setBusyId(id);
    setError("");
    try {
      await fn();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleSessions(quizId: string) {
    if (openSessionsFor === quizId) {
      setOpenSessionsFor(null);
      return;
    }
    setOpenSessionsFor(quizId);
    setSessions([]);
    try {
      setSessions(await listExamSessions(quizId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sessions.");
    }
  }

  function openStartDialog(q: Quiz) {
    setStartTarget(q);
    setDurationText(String(q.exam_duration_minutes ?? 60));
    setStartMode("now");
    setError("");
  }

  async function handleStart() {
    if (!startTarget) return;
    setStarting(true);
    setError("");
    try {
      const minutes = Number(durationText);
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) throw new Error("Enter the paper time in minutes (1 to 1440).");
      let startInSeconds: number | null = null;
      let startAt: Date | null = null;
      if (startMode === "in") {
        const m = Number(startInMinutes);
        if (!Number.isFinite(m) || m <= 0) throw new Error("Enter how many minutes from now the exam should start.");
        startInSeconds = Math.round(m * 60);
      } else if (startMode === "at") {
        if (!startAtLocal) throw new Error("Pick the date and time the exam should start.");
        startAt = new Date(startAtLocal);
        if (Number.isNaN(startAt.getTime())) throw new Error("That start date/time isn't valid.");
      }
      const session = await createExamSession(startTarget.id, { durationSeconds: Math.round(minutes * 60), startInSeconds, startAt });
      setStartTarget(null);
      navigate(ROUTES.QUIZ_ADMIN_EXAM_HOST.replace(":sessionId", session.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the exam.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Exams</h1>
          <p className="text-sm text-slate-400 mt-0.5">The whole paper on one screen, one timer, results shared by you when everyone is done.</p>
        </div>
        {canEdit && (
          <Link to={ROUTES.QUIZ_ADMIN_EXAM_NEW} className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2">
            + New Exam
          </Link>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search exams…"
        className="w-full sm:max-w-xs rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
      />

      {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

      {loading ? (
        <div className="text-slate-500 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-sm text-slate-500 border border-dashed border-slate-800 rounded-2xl py-12">
          No exams yet. Click <span className="text-slate-300 font-semibold">+ New Exam</span> to build one.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-white break-words">{q.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {q.exam_duration_minutes ?? 60} min · pass {q.passing_score_pct}% ·{" "}
                    <span className={q.status === "published" ? "text-emerald-400" : "text-amber-400"}>{q.status === "published" ? "Published" : "Draft"}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {q.status === "published" && canEdit && (
                    <button onClick={() => openStartDialog(q)} className="text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg px-3 py-1.5">
                      ▶ Start Exam
                    </button>
                  )}
                  <button onClick={() => toggleSessions(q.id)} className="text-xs font-semibold text-slate-300 border border-slate-700 hover:text-white rounded-lg px-3 py-1.5">
                    Sessions {openSessionsFor === q.id ? "▴" : "▾"}
                  </button>
                  {canEdit && (
                    <>
                      <Link to={ROUTES.QUIZ_ADMIN_EXAM_EDIT.replace(":quizId", q.id)} className="text-xs font-semibold text-slate-300 border border-slate-700 hover:text-white rounded-lg px-3 py-1.5">
                        ✏️ Edit
                      </Link>
                      <button
                        disabled={busyId === q.id}
                        onClick={() => run(q.id, () => (q.status === "published" ? unpublishQuiz(q.id) : publishQuiz(q.id)), "Failed to update status.")}
                        className="text-xs font-semibold text-slate-300 border border-slate-700 hover:text-white disabled:opacity-50 rounded-lg px-3 py-1.5"
                      >
                        {q.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        disabled={busyId === q.id}
                        onClick={() => run(q.id, () => duplicateQuiz(q.id, admin!.company_id, admin!.id), "Failed to duplicate.")}
                        className="text-xs font-semibold text-slate-300 border border-slate-700 hover:text-white disabled:opacity-50 rounded-lg px-3 py-1.5"
                      >
                        ⧉ Copy
                      </button>
                      <button
                        disabled={busyId === q.id}
                        onClick={() => { if (confirm("Delete this exam and all its sessions and results? This cannot be undone.")) void run(q.id, () => deleteQuiz(q.id), "Failed to delete."); }}
                        className="text-xs font-semibold text-red-300 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-50 rounded-lg px-3 py-1.5"
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              </div>

              {openSessionsFor === q.id && (
                <div className="border-t border-slate-800 pt-3">
                  {sessions.length === 0 ? (
                    <p className="text-xs text-slate-500">No sessions run yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {sessions.map((s) => (
                        <Link
                          key={s.id}
                          to={ROUTES.QUIZ_ADMIN_EXAM_HOST.replace(":sessionId", s.id)}
                          className="flex items-center justify-between gap-3 text-xs bg-slate-800/60 hover:bg-slate-800 rounded-lg px-3 py-2"
                        >
                          <span className="text-slate-200">{new Date(s.created_at).toLocaleString()}</span>
                          <span className="text-slate-500">PIN {s.pin}</span>
                          <span className={s.finished_at ? "text-slate-400" : "text-emerald-400"}>{sessionLabel(s)}{s.results_released ? " · results shared" : ""}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {startTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white mb-1">Start: {startTarget.title}</h3>
            <p className="text-xs text-slate-400 mb-4">Employees join with a PIN, see the whole paper, and share one timer.</p>

            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Paper time (minutes)</label>
            <input
              type="number"
              min={1}
              max={1440}
              value={durationText}
              onChange={(e) => setDurationText(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white mb-4"
            />

            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Start</label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {([["now", "Now"], ["in", "In X min"], ["at", "At a time"]] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setStartMode(mode)}
                  className={`text-xs font-semibold rounded-lg px-2 py-2 border-2 ${startMode === mode ? "border-red-500 bg-red-500/10 text-red-300" : "border-slate-700 text-slate-300 hover:border-slate-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {startMode === "in" && (
              <input type="number" min={0.5} step="any" value={startInMinutes} onChange={(e) => setStartInMinutes(e.target.value)} placeholder="minutes from now" className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white mb-2" />
            )}
            {startMode === "at" && (
              <input type="datetime-local" value={startAtLocal} onChange={(e) => setStartAtLocal(e.target.value)} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white mb-2" />
            )}
            <p className="text-[11px] text-slate-500 mb-4">Until it starts, employees who join wait in a lobby. The paper time only starts counting when the exam opens.</p>

            {error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">{error}</div>}

            <div className="flex gap-2">
              <button onClick={() => setStartTarget(null)} className="flex-1 text-sm font-semibold text-slate-300 border border-slate-700 rounded-lg px-4 py-2.5">Cancel</button>
              <button onClick={handleStart} disabled={starting} className="flex-1 text-sm font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg px-4 py-2.5">
                {starting ? "Starting…" : "▶ Start Exam"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
