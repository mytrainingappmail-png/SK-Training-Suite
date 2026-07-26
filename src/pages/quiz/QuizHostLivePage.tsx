import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { useQuizSessionRealtime } from "../../hooks/quiz/useQuizSessionRealtime";
import { getQuiz } from "../../services/quiz/quizService";
import { startQuiz, advanceQuestion, endSession } from "../../services/quiz/quizSessionService";
import { canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { getSessionResults } from "../../repositories/quiz/quizSessionRepository";
import { getAnswerDistribution } from "../../repositories/quiz/quizAnalyticsRepository";
import { buildDetailedReportCsv } from "../../services/quiz/quizReportService";
import { downloadCsvFile } from "../../services/quiz/quizCsvService";
import { playTone } from "../../services/quiz/quizSoundService";
import QuizSessionResultCardButton from "../../components/quiz/QuizSessionResultCardButton";
import QuizAdminCertificateButton from "../../components/quiz/QuizAdminCertificateButton";
import QuizConfetti from "../../components/quiz/QuizConfetti";
import { HorizontalBars, type ChartPoint } from "../../components/quiz/QuizDashboardCharts";
import type { QuizWithQuestions, QuizGrade } from "../../types/quiz";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function QuizHostLivePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, participants } = useQuizSessionRealtime(sessionId ?? null);
  const canEdit = canEditQuizContent();

  const [quiz, setQuiz] = useState<QuizWithQuestions | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [csvDownloading, setCsvDownloading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [optionBars, setOptionBars] = useState<ChartPoint[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvancedRef = useRef(false);
  const endedHandledRef = useRef(false);

  useEffect(() => {
    if (!canEdit) navigate(ROUTES.QUIZ_ADMIN_QUIZZES, { replace: true });
  }, [canEdit, navigate]);

  useEffect(() => {
    if (!session) return;
    getQuiz(session.quiz_id).then(setQuiz);
  }, [session?.quiz_id]);

  // quiz.questions is always in natural display_order — when the quiz has
  // shuffle_questions on, session.question_order (set once at launch) holds
  // the actual per-session sequence, and the host must follow it too so the
  // host's screen and every participant's screen show the same question.
  const orderedQuestions =
    quiz && session?.question_order
      ? (session.question_order.map((id) => quiz.questions.find((q) => q.id === id)).filter(Boolean) as typeof quiz.questions)
      : quiz?.questions ?? [];
  const currentQuestion = session ? orderedQuestions[session.current_question_index] ?? null : null;

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!session || session.phase !== "question" || !currentQuestion) return;

    const total = currentQuestion.timer_seconds ?? quiz?.default_timer_seconds ?? 30;
    setSecondsLeft(total);
    autoAdvancedRef.current = false;

    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (!autoAdvancedRef.current) {
            autoAdvancedRef.current = true;
            handleNext();
          }
          return 0;
        }
        if (s <= 6) playTone("tick");
        return s - 1;
      });
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.phase, session?.current_question_index]);

  useEffect(() => {
    if (!sessionId || !quiz || session?.phase !== "ended" || endedHandledRef.current) return;
    endedHandledRef.current = true;

    setShowConfetti(true);
    const confettiTimer = setTimeout(() => setShowConfetti(false), 4000);

    getAnswerDistribution(sessionId, quiz.id).then((questions) => {
      const totals: number[] = [];
      for (const q of questions) {
        q.options.forEach((o, i) => {
          totals[i] = (totals[i] ?? 0) + o.count;
        });
      }
      const grand = totals.reduce((s, n) => s + n, 0);
      setOptionBars(
        totals.slice(0, 4).map((count, i) => ({
          label: `Option ${OPTION_LETTERS[i]}`,
          value: grand === 0 ? 0 : Math.round((count / grand) * 100),
        }))
      );
    });

    return () => clearTimeout(confettiTimer);
  }, [sessionId, quiz, session?.phase]);

  async function handleStart() {
    if (!sessionId) return;
    await startQuiz(sessionId);
  }

  async function handleNext() {
    if (!sessionId || !quiz) return;
    const result = await advanceQuestion(sessionId, quiz.questions.length);
    if (result === "ended") {
      // realtime pushes phase='ended' to this same page — stay here to show the podium
    }
  }

  async function handleEnd() {
    if (!sessionId) return;
    if (!confirm("End this quiz now?")) return;
    await endSession(sessionId);
  }

  async function handleDownloadCsv() {
    if (!sessionId) return;
    setCsvDownloading(true);
    try {
      const rows = await getSessionResults(sessionId);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsvFile(`quiz-result-${stamp}.csv`, buildDetailedReportCsv(rows));
    } finally {
      setCsvDownloading(false);
    }
  }

  if (!session || !quiz) {
    return <div className="text-slate-500 text-sm p-8">Loading session…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800">
        <div className="font-semibold text-sm">{quiz.title}</div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">PIN:</span>
          <span className="font-mono font-bold text-amber-400 tracking-widest">{session.pin}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(ROUTES.QUIZ_ADMIN_QUIZZES)}
            className="text-xs font-semibold text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5"
          >
            ← Back
          </button>
          <button
            onClick={handleEnd}
            className="text-xs font-semibold text-red-300 border border-red-900/50 rounded-lg px-3 py-1.5"
          >
            ⏹ End
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px]">
        <div className="p-8">
          {session.phase === "lobby" && (
            <div className="text-center space-y-6">
              <div className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Share this PIN</div>
              <div className="font-mono text-5xl font-bold text-amber-400 tracking-[0.2em] bg-slate-900 border-2 border-amber-500/30 rounded-2xl py-6">
                {session.pin}
              </div>
              <div className="text-sm text-slate-400">
                {participants.length} player{participants.length === 1 ? "" : "s"} in lobby
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {participants.map((p) => (
                  <span key={p.id} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm">
                    {p.display_name}
                  </span>
                ))}
              </div>
              <button
                onClick={handleStart}
                disabled={participants.length === 0}
                className="bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-amber-950 font-bold rounded-xl px-8 py-3"
              >
                ▶ Start Quiz
              </button>
            </div>
          )}

          {session.phase === "question" && currentQuestion && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                    Q{session.current_question_index + 1} of {quiz.questions.length}
                  </div>
                  <div className="text-lg font-semibold mt-1">{currentQuestion.question_text}</div>
                </div>
                <div className="h-16 w-16 rounded-full border-4 border-amber-400 flex items-center justify-center font-mono font-bold text-xl shrink-0">
                  {secondsLeft}
                </div>
              </div>

              <div className="space-y-2">
                {currentQuestion.options.map((opt) => (
                  <div key={opt.id} className="bg-slate-800 rounded-lg px-4 py-3 text-sm font-medium">
                    {opt.option_text}
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleNext}
                  className="bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg px-5 py-2.5"
                >
                  {session.current_question_index + 1 >= quiz.questions.length ? "Finish Quiz ✓" : "Next Question →"}
                </button>
              </div>
            </div>
          )}

          {session.phase === "ended" && (
            <div className="space-y-6">
              {showConfetti && <QuizConfetti />}

              <div className="text-center py-4">
                <div className="text-3xl mb-2">🏆</div>
                <div className="text-xl font-bold">Quiz Complete!</div>
                <div className="text-xs text-slate-500 mt-1">All participants results below</div>
              </div>
              <Podium participants={participants} />

              {participants.length > 0 && (
                <div className="flex flex-wrap justify-center gap-3">
                  <QuizSessionResultCardButton
                    data={{
                      quizTitle: quiz.title,
                      pin: session.pin,
                      participants: participants
                        .slice()
                        .sort((a, b) => b.score - a.score)
                        .map((p) => ({ display_name: p.display_name, score: p.score })),
                      ...gradeCounts(participants, quiz),
                    }}
                  />
                  <button
                    onClick={handleDownloadCsv}
                    disabled={csvDownloading}
                    className="text-sm font-semibold bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-amber-950 rounded-lg px-4 py-2"
                  >
                    ⬇ {csvDownloading ? "Preparing…" : "Export CSV"}
                  </button>
                  <button
                    onClick={() => navigate(ROUTES.QUIZ_ADMIN_RESULTS)}
                    className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2"
                  >
                    📋 View Results
                  </button>
                  <button
                    onClick={() => navigate(ROUTES.QUIZ_ADMIN_DASHBOARD)}
                    className="text-sm font-semibold text-slate-300 border border-slate-700 rounded-lg px-4 py-2"
                  >
                    ← Dashboard
                  </button>
                </div>
              )}

              {participants.length > 0 && (
                <>
                  {/* Result Summary */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="text-sm font-bold text-white mb-3">
                      📊 Result Summary — {participants.length} Participant{participants.length === 1 ? "" : "s"}
                    </div>
                    <HorizontalBars
                      data={(() => {
                        const counts = gradeCounts(participants, quiz);
                        const total = Math.max(1, participants.length);
                        return [
                          { label: `Pass (${quiz.passing_score_pct}%+)`, value: Math.round((counts.passCount / total) * 100) },
                          {
                            label: `Improve (${quiz.improve_threshold_pct}-${quiz.passing_score_pct - 1}%)`,
                            value: Math.round((counts.improveCount / total) * 100),
                          },
                          { label: `Fail (below ${quiz.improve_threshold_pct}%)`, value: Math.round((counts.failCount / total) * 100) },
                        ];
                      })()}
                      color="violet"
                    />
                  </div>

                  {/* All Participants with grade + integrity */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="text-sm font-bold text-white mb-3">👥 All Participants</div>
                    <div className="space-y-1.5">
                      {participants
                        .slice()
                        .sort((a, b) => b.score - a.score)
                        .map((p) => {
                          const grade = participantGrade(p.correct_count, quiz);
                          return (
                            <div key={p.id} className="flex items-center gap-3 bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
                              <span className="flex-1 truncate">{p.display_name}</span>
                              <span className="text-xs text-slate-400">
                                {p.correct_count}/{quiz.questions.length} · {p.score}
                              </span>
                              {p.tab_switch_count > 0 && (
                                <span
                                  title={`Switched away from the quiz tab ${p.tab_switch_count} time${p.tab_switch_count === 1 ? "" : "s"}`}
                                  className="text-[10px] font-bold text-red-300 bg-red-500/15 border border-red-500/30 rounded px-1.5 py-0.5"
                                >
                                  ⚠ {p.tab_switch_count}
                                </span>
                              )}
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${GRADE_STYLE[grade]}`}>
                                {grade.replace("_", " ")}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Integrity Check */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="text-sm font-bold text-white mb-2">🛡️ Integrity Check</div>
                    {participants.every((p) => p.tab_switch_count === 0) ? (
                      <div className="text-sm text-emerald-300">No tab-switching detected — clean session ✅</div>
                    ) : (
                      <div className="space-y-1.5">
                        {participants
                          .filter((p) => p.tab_switch_count > 0)
                          .map((p) => (
                            <div key={p.id} className="text-sm text-red-300">
                              ⚠ {p.display_name} switched away {p.tab_switch_count} time{p.tab_switch_count === 1 ? "" : "s"} during the quiz
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Option A/B/C/D distribution */}
                  {optionBars.some((b) => b.value > 0) && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                      <div className="text-sm font-bold text-white mb-1">📶 Answer Distribution</div>
                      <p className="text-xs text-slate-500 mb-3">Share of all answers given, by option position, across the whole quiz</p>
                      <HorizontalBars data={optionBars} color="amber" />
                    </div>
                  )}

                  {/* Certificates */}
                  {(() => {
                    const passers = participants.filter((p) => participantGrade(p.correct_count, quiz) === "PASS");
                    if (passers.length === 0) return null;
                    return (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                        <div className="text-sm font-bold text-white mb-3">🎖️ Certificates ({passers.length} passed)</div>
                        <div className="space-y-2">
                          {passers.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-3 bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
                              <span className="flex-1 truncate">
                                {p.display_name} <span className="text-slate-500">({Math.round((p.correct_count / quiz.questions.length) * 100)}%)</span>
                              </span>
                              <QuizAdminCertificateButton participantId={p.id} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}
        </div>

        <div className="border-l border-slate-800 p-5">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">🏆 Leaderboard</div>
          <div className="space-y-1.5">
            {participants
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-slate-500 w-5">{i + 1}</span>
                  <span className="flex-1 truncate">{p.display_name}</span>
                  {p.tab_switch_count > 0 && (
                    <span
                      title={`Switched away from the quiz tab ${p.tab_switch_count} time${p.tab_switch_count === 1 ? "" : "s"}`}
                      className="text-[10px] font-bold text-red-300 bg-red-500/15 border border-red-500/30 rounded px-1.5 py-0.5"
                    >
                      ⚠ {p.tab_switch_count}
                    </span>
                  )}
                  <span className="font-mono text-xs text-amber-400 font-bold">{p.score}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const GRADE_STYLE: Record<QuizGrade, string> = {
  PASS: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  NEED_IMPROVEMENT: "text-amber-300 bg-amber-500/15 border-amber-500/30",
  FAIL: "text-red-300 bg-red-500/15 border-red-500/30",
};

function participantGrade(correctCount: number, quiz: QuizWithQuestions): QuizGrade {
  const total = quiz.questions.length;
  const pct = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  if (pct >= quiz.passing_score_pct) return "PASS";
  if (pct >= quiz.improve_threshold_pct) return "NEED_IMPROVEMENT";
  return "FAIL";
}

function gradeCounts(
  participants: { correct_count: number }[],
  quiz: QuizWithQuestions
): { passCount: number; improveCount: number; failCount: number } {
  const total = quiz.questions.length;
  let passCount = 0;
  let improveCount = 0;
  let failCount = 0;

  for (const p of participants) {
    const pct = total === 0 ? 0 : Math.round((p.correct_count / total) * 100);
    if (pct >= quiz.passing_score_pct) passCount += 1;
    else if (pct >= quiz.improve_threshold_pct) improveCount += 1;
    else failCount += 1;
  }

  return { passCount, improveCount, failCount };
}

function Podium({ participants }: { participants: { id: string; display_name: string; score: number }[] }) {
  const sorted = participants.slice().sort((a, b) => b.score - a.score).slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="flex items-end justify-center gap-4">
      {sorted.map((p, i) => (
        <div key={p.id} className="text-center">
          <div className="text-2xl">{medals[i]}</div>
          <div className="text-sm font-semibold mt-1">{p.display_name}</div>
          <div className="text-xs font-mono text-amber-400">{p.score}</div>
        </div>
      ))}
      {sorted.length === 0 && <div className="text-slate-500 text-sm">No participants.</div>}
    </div>
  );
}
