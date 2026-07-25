import { useEffect, useState } from "react";

import { getCurrentQuizAdmin } from "../../services/quiz/quizAdminSession";
import { listSessionsForCompany, getSessionResults } from "../../services/quiz/quizSessionService";
import type { QuizSession, QuizSessionResultRow } from "../../types/quiz";

const GRADE_STYLE: Record<string, string> = {
  PASS: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  NEED_IMPROVEMENT: "text-amber-300 bg-amber-500/15 border-amber-500/30",
  FAIL: "text-red-300 bg-red-500/15 border-red-500/30",
};

export default function QuizResultsPage() {
  const admin = getCurrentQuizAdmin();
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, QuizSessionResultRow[]>>({});

  useEffect(() => {
    if (!admin) return;
    listSessionsForCompany(admin.company_id)
      .then((rows) => setSessions(rows.filter((s) => s.phase === "ended")))
      .finally(() => setLoading(false));
  }, [admin]);

  async function toggle(sessionId: string) {
    if (expanded === sessionId) {
      setExpanded(null);
      return;
    }
    setExpanded(sessionId);
    if (!results[sessionId]) {
      const rows = await getSessionResults(sessionId);
      setResults((prev) => ({ ...prev, [sessionId]: rows }));
    }
  }

  if (loading) return <div className="text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Results &amp; Analytics</h1>
        <p className="text-sm text-slate-400 mt-0.5">Past quiz session results</p>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          No sessions yet. Launch a quiz to see results.
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const rows = results[s.id];
            const nPass = rows?.filter((r) => r.grade === "PASS").length ?? 0;
            const nImp = rows?.filter((r) => r.grade === "NEED_IMPROVEMENT").length ?? 0;
            const nFail = rows?.filter((r) => r.grade === "FAIL").length ?? 0;

            return (
              <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <button className="w-full text-left flex items-center justify-between" onClick={() => toggle(s.id)}>
                  <div>
                    <div className="font-semibold text-sm text-white">
                      {rows?.[0]?.quiz_title ?? "Quiz session"}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {s.ended_at ? new Date(s.ended_at).toLocaleString("en-IN") : ""} · PIN {s.pin}
                    </div>
                  </div>
                  <span className="text-slate-500">{expanded === s.id ? "▲" : "▼"}</span>
                </button>

                {expanded === s.id && (
                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                    {!rows ? (
                      <div className="text-xs text-slate-500">Loading…</div>
                    ) : rows.length === 0 ? (
                      <div className="text-xs text-slate-500">No participants.</div>
                    ) : (
                      <>
                        <div className="flex gap-2 mb-3">
                          <SummaryPill label="PASS" value={nPass} className="text-emerald-300 bg-emerald-500/10" />
                          <SummaryPill label="IMPROVE" value={nImp} className="text-amber-300 bg-amber-500/10" />
                          <SummaryPill label="FAIL" value={nFail} className="text-red-300 bg-red-500/10" />
                        </div>
                        {rows
                          .slice()
                          .sort((a, b) => b.score - a.score)
                          .map((r) => (
                            <div
                              key={r.participant_id}
                              className="flex items-center gap-3 bg-slate-800/60 rounded-lg px-3 py-2 text-sm"
                            >
                              <span className="flex-1 truncate">{r.display_name}</span>
                              <span className="text-xs text-slate-400">
                                {r.correct_count}/{r.total_questions} · {r.percent_correct}%
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${GRADE_STYLE[r.grade]}`}
                              >
                                {r.grade.replace("_", " ")}
                              </span>
                            </div>
                          ))}
                      </>
                    )}
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

function SummaryPill({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`flex-1 rounded-lg text-center py-2 ${className}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide">{label}</div>
    </div>
  );
}
