import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { useQuizSessionRealtime } from "../../hooks/quiz/useQuizSessionRealtime";
import { supabaseQuiz } from "../../lib/supabaseQuiz";
import { getQuiz } from "../../services/quiz/quizService";
import { startQuiz, advanceQuestion, endSession } from "../../services/quiz/quizSessionService";
import { canEditQuizContent, getCurrentQuizAdmin } from "../../services/quiz/quizAdminSession";
import { getSessionResults } from "../../repositories/quiz/quizSessionRepository";
import { getAnswerDistribution } from "../../repositories/quiz/quizAnalyticsRepository";
import { getSettings } from "../../repositories/quiz/quizSettingsRepository";
import { buildDetailedReportCsv } from "../../services/quiz/quizReportService";
import { downloadCsvFile } from "../../services/quiz/quizCsvService";
import { playTone } from "../../services/quiz/quizSoundService";
import { rankByMarks, isCertEligible, MEDALS } from "../../services/quiz/quizRankingService";
import QuizSessionResultCardButton from "../../components/quiz/QuizSessionResultCardButton";
import QuizAdminCertificateButton from "../../components/quiz/QuizAdminCertificateButton";
import QuizConfetti from "../../components/quiz/QuizConfetti";
import { HorizontalBars, type ChartPoint } from "../../components/quiz/QuizDashboardCharts";
import type { QuizWithQuestions, QuizGrade, QuizSettings } from "../../types/quiz";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];
const ANSWER_COLORS = ["#e11d48", "#2563eb", "#f59e0b", "#16a34a", "#8b5cf6", "#0891b2"];
const UI_SCALES = [100, 115, 130, 150];
const PRESENCE_STALE_MS = 12000;

export default function QuizHostLivePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, participants } = useQuizSessionRealtime(sessionId ?? null);
  const canEdit = canEditQuizContent();
  const admin = getCurrentQuizAdmin();

  const [quiz, setQuiz] = useState<QuizWithQuestions | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [csvDownloading, setCsvDownloading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [optionBars, setOptionBars] = useState<ChartPoint[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [settings, setSettings] = useState<QuizSettings | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [uiScale, setUiScale] = useState(100);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvancedRef = useRef(false);
  const endedHandledRef = useRef(false);
  // Synchronous re-entry guard — a manual Next click can otherwise race the
  // auto-advance timer's own in-flight call (or a second real click), each
  // independently calling advanceQuestion() and incrementing
  // current_question_index twice instead of once. `advancing` (state) only
  // drives the button's disabled look; this ref is what actually blocks it,
  // since state updates aren't synchronous.
  const advancingRef = useRef(false);

  useEffect(() => {
    if (!canEdit) navigate(ROUTES.QUIZ_ADMIN_QUIZZES, { replace: true });
  }, [canEdit, navigate]);

  useEffect(() => {
    if (!session) return;
    getQuiz(session.quiz_id).then(setQuiz);
  }, [session?.quiz_id]);

  useEffect(() => {
    const admin = getCurrentQuizAdmin();
    if (!admin) return;
    getSettings(admin.company_id).then(setSettings);
  }, []);

  // A "last seen" presence dot needs to visibly go stale over time even
  // without new data arriving — this just forces a re-render every few
  // seconds so "12s ago" style checks stay current.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // quiz.questions is always in natural display_order — when the quiz has
  // shuffle_questions on, session.question_order (set once at launch) holds
  // the actual per-session sequence, and the host must follow it too so the
  // host's screen and every participant's screen show the same question.
  // question_order is ALSO already pre-filtered to visible-only questions
  // (hidden ones are never included) — so orderedQuestions.length, not
  // quiz.questions.length, is the true "how many questions in this live
  // session" count used everywhere below. Using the raw quiz.questions.length
  // (which includes hidden questions) made the session think there were
  // more questions left than question_order actually has, so it would try
  // to advance past the end of the array instead of ending — the exact
  // "stuck on a blank screen, had to click End" bug.
  const orderedQuestions =
    quiz && session?.question_order
      ? (session.question_order.map((id) => quiz.questions.find((q) => q.id === id)).filter(Boolean) as typeof quiz.questions)
      : quiz?.questions ?? [];
  const totalQuestions = orderedQuestions.length;
  const currentQuestion = session ? orderedQuestions[session.current_question_index] ?? null : null;

  const REVEAL_PAUSE_MS = 2500;

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setRevealed(false);
    setAnsweredCount(0);
    if (!session || session.phase !== "question" || !currentQuestion) return;

    const total = currentQuestion.timer_seconds ?? quiz?.default_timer_seconds ?? 30;
    // Anchored off the server's question_started_at so the host's own
    // countdown display can't drift from what every participant sees.
    const elapsedSec = session.question_started_at
      ? Math.floor((Date.now() - new Date(session.question_started_at).getTime()) / 1000)
      : 0;
    setSecondsLeft(Math.max(0, total - Math.max(0, elapsedSec)));
    autoAdvancedRef.current = false;

    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (!autoAdvancedRef.current) {
            autoAdvancedRef.current = true;
            // Pop the correct option in color for the host before auto-advancing,
            // instead of jumping straight to the next question.
            setRevealed(true);
            revealTimerRef.current = setTimeout(() => handleNext(), REVEAL_PAUSE_MS);
          }
          return 0;
        }
        if (s <= 6) playTone("tick");
        return s - 1;
      });
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.phase, session?.current_question_index]);

  // Live "X of Y answered" — subscribes to new quiz_answers rows for this
  // session and counts the ones matching whichever question is current,
  // resetting to 0 every time the question changes.
  useEffect(() => {
    if (!sessionId || session?.phase !== "question" || !currentQuestion) return;
    const questionId = currentQuestion.id;
    const channel = supabaseQuiz
      .channel(`quiz-answers-${sessionId}-${questionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quiz_answers", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as { question_id: string };
          if (row.question_id === questionId) setAnsweredCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      supabaseQuiz.removeChannel(channel);
    };
  }, [sessionId, session?.phase, currentQuestion?.id]);

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
    if (advancingRef.current) return; // already advancing — ignore a racing second trigger
    advancingRef.current = true;
    setAdvancing(true);
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    autoAdvancedRef.current = true;
    try {
      const result = await advanceQuestion(sessionId, totalQuestions);
      if (result === "ended") {
        // realtime pushes phase='ended' to this same page — stay here to show the podium
      }
    } finally {
      advancingRef.current = false;
      setAdvancing(false);
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

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  function isActive(lastSeenAt: string | null): boolean {
    if (!lastSeenAt) return false;
    return now - new Date(lastSeenAt).getTime() < PRESENCE_STALE_MS;
  }

  if (!session || !quiz) {
    return <div className="text-slate-500 text-sm p-8">Loading session…</div>;
  }

  const scale = uiScale / 100;
  const brandName = settings?.brand_name?.trim();
  const certEligibility = settings?.cert_eligibility ?? "all_pass";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden flex flex-col">
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 10%, #6366F1 0%, transparent 35%), radial-gradient(circle at 85% 30%, #F59E0B 0%, transparent 30%), radial-gradient(circle at 50% 90%, #A855F7 0%, transparent 35%)",
        }}
      />

      <div className="relative flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          {settings?.brand_logo_url && (
            <img src={settings.brand_logo_url} alt="" className="h-9 w-9 rounded-lg object-contain bg-white/5 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{quiz.title}</div>
            {brandName && <div className="text-[11px] text-slate-500 truncate">{brandName}</div>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">PIN:</span>
          <span className="font-mono font-bold text-amber-400 tracking-widest text-lg">{session.pin}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 border border-slate-700 rounded-lg px-1.5 py-1">
            <span className="text-[10px] text-slate-500 px-1">Aa</span>
            {UI_SCALES.map((s) => (
              <button
                key={s}
                onClick={() => setUiScale(s)}
                title={`${s}% text size`}
                className={`text-[11px] font-semibold rounded px-1.5 py-0.5 transition-colors ${
                  uiScale === s ? "bg-amber-400 text-amber-950" : "text-slate-400 hover:text-white"
                }`}
              >
                {s}%
              </button>
            ))}
          </div>
          <button
            onClick={toggleFullscreen}
            title="Fullscreen — best for projecting"
            className="text-xs font-semibold text-slate-300 border border-slate-700 rounded-lg px-3 py-1.5"
          >
            ⛶
          </button>
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

      <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_300px] flex-1">
        <div className="p-8">
          {session.phase === "lobby" && (
            <div className="text-center space-y-6">
              <div className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Share this PIN</div>
              <div className="font-mono text-5xl font-bold text-amber-400 tracking-[0.2em] bg-slate-900 border-2 border-amber-500/40 shadow-[0_0_40px_-8px_rgba(251,191,36,0.4)] rounded-2xl py-6">
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
                className="bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 disabled:opacity-40 text-amber-950 font-bold rounded-xl px-8 py-3 shadow-lg shadow-amber-500/20"
              >
                ▶ Start Quiz
              </button>
            </div>
          )}

          {session.phase === "question" && currentQuestion && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                    Q{session.current_question_index + 1} of {totalQuestions}
                    <span className="ml-3 text-emerald-400">{answeredCount}/{participants.length} answered</span>
                  </div>
                  <div className="font-semibold mt-1" style={{ fontSize: `${1.125 * scale}rem` }}>
                    {currentQuestion.question_text}
                  </div>
                </div>
                <div
                  className={`h-16 w-16 rounded-full border-4 flex items-center justify-center font-mono font-bold text-xl shrink-0 ${
                    secondsLeft <= 5 ? "border-red-500 text-red-400 animate-pulse" : "border-amber-400"
                  }`}
                >
                  {secondsLeft}
                </div>
              </div>

              <div className="space-y-2">
                {currentQuestion.options.map((opt, i) => (
                  <div
                    key={opt.id}
                    style={{ fontSize: `${0.875 * scale}rem`, borderLeft: `4px solid ${ANSWER_COLORS[i % ANSWER_COLORS.length]}` }}
                    className={`rounded-lg pl-3 pr-4 py-3 font-medium flex items-center justify-between transition-colors ${
                      revealed && opt.is_correct
                        ? "bg-emerald-500/20 border-2 border-emerald-400 text-emerald-200"
                        : "bg-slate-800"
                    }`}
                  >
                    <span>{opt.option_text}</span>
                    {revealed && opt.is_correct && <span className="text-emerald-300 font-bold">✓ Correct</span>}
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleNext}
                  disabled={advancing}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-5 py-2.5"
                >
                  {advancing ? "…" : session.current_question_index + 1 >= totalQuestions ? "Finish Quiz ✓" : "Next Question →"}
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
                      participants: rankByMarks(participants).map((p) => ({
                        display_name: p.display_name,
                        percent: totalQuestions === 0 ? 0 : Math.round((p.correct_count / totalQuestions) * 100),
                      })),
                      ...gradeCounts(participants, totalQuestions, quiz),
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
                        const counts = gradeCounts(participants, totalQuestions, quiz);
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
                    <div className="text-sm font-bold text-white mb-3">👥 All Participants — ranked by marks</div>
                    <div className="space-y-1.5">
                      {rankByMarks(participants).map((p, i) => {
                          const grade = participantGrade(p.correct_count, totalQuestions, quiz);
                          const pct = totalQuestions === 0 ? 0 : Math.round((p.correct_count / totalQuestions) * 100);
                          return (
                            <div key={p.id} className="flex items-center gap-3 bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
                              <span className="font-mono text-xs text-slate-500 w-6 shrink-0">{MEDALS[i] ?? `#${i + 1}`}</span>
                              <span className="flex-1 truncate">{p.display_name}</span>
                              <span className="text-xs text-slate-400">
                                {p.correct_count}/{totalQuestions} · {pct}%
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

                  {/* Certificates — competition-gated by cert_eligibility, not just a passing score */}
                  {(() => {
                    const ranked = rankByMarks(participants);
                    const eligible = ranked.filter((p, i) => isCertEligible(i + 1, participantGrade(p.correct_count, totalQuestions, quiz), certEligibility));
                    if (eligible.length === 0) return null;
                    const eligibilityLabel =
                      certEligibility === "top1" ? "Rank #1 only" : certEligibility === "top3" ? "Top 3 ranks" : "Everyone who passed";
                    return (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                        <div className="text-sm font-bold text-white mb-1">🎖️ Certificates ({eligible.length} eligible)</div>
                        <p className="text-xs text-slate-500 mb-3">Eligibility: {eligibilityLabel} — set in Quiz Settings</p>
                        <div className="space-y-2">
                          {eligible.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-3 bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
                              <span className="flex-1 truncate">
                                {p.display_name} <span className="text-slate-500">({totalQuestions === 0 ? 0 : Math.round((p.correct_count / totalQuestions) * 100)}%)</span>
                              </span>
                              {admin && <QuizAdminCertificateButton participantId={p.id} companyId={admin.company_id} />}
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

        <div className="border-l border-slate-800 p-5 bg-slate-950/40">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">🏆 Leaderboard</div>
          <div className="space-y-1.5">
            {participants
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((p, i) => (
                <div
                  key={p.id}
                  style={{ borderLeft: i < 3 ? `3px solid ${["#FBBF24", "#CBD5E1", "#D97706"][i]}` : undefined }}
                  className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2"
                  title={p.last_seen_at ? `Last seen ${Math.max(0, Math.round((now - new Date(p.last_seen_at).getTime()) / 1000))}s ago` : undefined}
                >
                  <span className="font-mono text-xs text-slate-500 w-5">{i + 1}</span>
                  {p.last_seen_at && (
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isActive(p.last_seen_at) ? "bg-emerald-400" : "bg-slate-600"}`} />
                  )}
                  <span className="flex-1 truncate" style={{ fontSize: `${0.875 * scale}rem` }}>{p.display_name}</span>
                  {p.tab_switch_count > 0 && (
                    <span
                      title={`Switched away from the quiz tab ${p.tab_switch_count} time${p.tab_switch_count === 1 ? "" : "s"}`}
                      className="text-[10px] font-bold text-red-300 bg-red-500/15 border border-red-500/30 rounded px-1.5 py-0.5"
                    >
                      ⚠ {p.tab_switch_count}
                    </span>
                  )}
                  <span className="font-mono text-xs text-amber-400 font-bold" style={{ fontSize: `${0.75 * scale}rem` }}>{p.score}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="relative border-t border-slate-800 px-6 py-3 text-center text-[11px] text-slate-500">
        {settings?.footer_text || (brandName ? `Presented by ${brandName}` : null)}
      </div>
    </div>
  );
}

const GRADE_STYLE: Record<QuizGrade, string> = {
  PASS: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  NEED_IMPROVEMENT: "text-amber-300 bg-amber-500/15 border-amber-500/30",
  FAIL: "text-red-300 bg-red-500/15 border-red-500/30",
};

function participantGrade(correctCount: number, totalQuestions: number, quiz: QuizWithQuestions): QuizGrade {
  const pct = totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100);
  if (pct >= quiz.passing_score_pct) return "PASS";
  if (pct >= quiz.improve_threshold_pct) return "NEED_IMPROVEMENT";
  return "FAIL";
}

function gradeCounts(
  participants: { correct_count: number }[],
  totalQuestions: number,
  quiz: QuizWithQuestions
): { passCount: number; improveCount: number; failCount: number } {
  let passCount = 0;
  let improveCount = 0;
  let failCount = 0;

  for (const p of participants) {
    const pct = totalQuestions === 0 ? 0 : Math.round((p.correct_count / totalQuestions) * 100);
    if (pct >= quiz.passing_score_pct) passCount += 1;
    else if (pct >= quiz.improve_threshold_pct) improveCount += 1;
    else failCount += 1;
  }

  return { passCount, improveCount, failCount };
}

function Podium({
  participants,
}: {
  participants: { id: string; display_name: string; correct_count: number; total_response_time_ms: number }[];
}) {
  const sorted = rankByMarks(participants).slice(0, 3);
  return (
    <div className="flex items-end justify-center gap-4">
      {sorted.map((p, i) => (
        <div key={p.id} className="text-center">
          <div className="text-2xl">{MEDALS[i]}</div>
          <div className="text-sm font-semibold mt-1">{p.display_name}</div>
          <div className="text-xs font-mono text-amber-400">{p.correct_count} correct</div>
        </div>
      ))}
      {sorted.length === 0 && <div className="text-slate-500 text-sm">No participants.</div>}
    </div>
  );
}
