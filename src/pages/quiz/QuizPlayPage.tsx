import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { supabaseQuizPlayer } from "../../lib/supabaseQuizPlayer";
import { useQuizSessionRealtime } from "../../hooks/quiz/useQuizSessionRealtime";
import { getCurrentQuestion, submitAnswer, heartbeat } from "../../services/quiz/quizPlayService";
import { listParticipants } from "../../repositories/quiz/quizParticipantRepository";
import { getPlayerSettings } from "../../repositories/quiz/quizSettingsRepository";
import { applyQuizFavicon } from "../../services/quiz/quizBrandingRuntimeService";
import { playTone } from "../../services/quiz/quizSoundService";
import { issueMyCertificate } from "../../repositories/quiz/quizCertificateRepository";
import { getMyAnswerReview, getMyResult, flagTabSwitch } from "../../repositories/quiz/quizAnswerRepository";
import { rankByMarks, MEDALS } from "../../services/quiz/quizRankingService";
import QuizCertificateButton from "../../components/quiz/QuizCertificateButton";
import QuizConfetti from "../../components/quiz/QuizConfetti";
import type { PublicQuizQuestion, SubmitAnswerResult, QuizPlayerSettings, QuizCertificate, AnswerReviewQuestion, MyQuizResult } from "../../types/quiz";

const DEFAULT_REVIEW_VISIBLE_SECONDS = 5 * 60;

interface LocationState {
  participantId?: string;
  quizTitle?: string;
}

export default function QuizPlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = (location.state as LocationState | null) ?? {};

  const { session, participants } = useQuizSessionRealtime(sessionId ?? null, supabaseQuizPlayer);

  const [participantId, setParticipantId] = useState<string | null>(locationState.participantId ?? null);
  const [question, setQuestion] = useState<PublicQuizQuestion | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState<SubmitAnswerResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [playerSettings, setPlayerSettings] = useState<QuizPlayerSettings | null>(null);
  const [certificate, setCertificate] = useState<QuizCertificate | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [reviewQuestions, setReviewQuestions] = useState<AnswerReviewQuestion[] | null>(null);
  const [reviewSecondsLeft, setReviewSecondsLeft] = useState(DEFAULT_REVIEW_VISIBLE_SECONDS);
  const [myResult, setMyResult] = useState<MyQuizResult | null>(null);
  const [endStep, setEndStep] = useState<"splash" | "details">("splash");
  const [justReconnected, setJustReconnected] = useState(false);

  const questionStartedAt = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedHandled = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    getPlayerSettings(sessionId)
      .then((s) => {
        setPlayerSettings(s);
        applyQuizFavicon(s.favicon_url);
      })
      .catch(() => {});
  }, [sessionId]);

  // Integrity check: flag it if the trainee's tab is backgrounded (app-switch, screen-off,
  // alt-tab) while a session they've joined is actually running — visible to the host
  // afterwards as a per-participant warning, never blocking or auto-failing anyone.
  useEffect(() => {
    if (!sessionId || !session || session.phase === "lobby" || session.phase === "ended") return;

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden" && sessionId) {
        flagTabSwitch(sessionId);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [sessionId, session]);

  // Recover participantId after a page refresh (router state is lost on reload).
  useEffect(() => {
    if (participantId || !sessionId) return;
    (async () => {
      const { data } = await supabaseQuizPlayer.auth.getUser();
      const uid = data.user?.id;
      if (!uid) {
        navigate(ROUTES.QUIZ_JOIN, { replace: true });
        return;
      }
      const rows = await listParticipants(sessionId, supabaseQuizPlayer);
      const mine = rows.find((p) => p.auth_user_id === uid);
      if (mine) {
        setParticipantId(mine.id);
        // Router state (participantId) only survives a normal navigation —
        // getting here at all means the page was reloaded mid-quiz, so a
        // quick "you're back, here's where things are" beats silently
        // dropping them onto whatever question happens to be live now.
        setJustReconnected(true);
        setTimeout(() => setJustReconnected(false), 4000);
      } else {
        navigate(ROUTES.QUIZ_JOIN, { replace: true });
      }
    })();
  }, [participantId, sessionId, navigate]);

  // Safety-net heartbeat — while a question is live, periodically tells the
  // server "I'm still here" (host's participant list shows this as presence)
  // and asks it to auto-advance if the current question's timer has already
  // expired. The host's own tab normally drives advancing, but that's a
  // single browser tab's setInterval; if it stalls (backgrounded, screen
  // locked, asleep), any participant's device still pings this and the
  // session keeps moving instead of getting stuck.
  useEffect(() => {
    if (!sessionId || session?.phase !== "question") return;
    const id = setInterval(() => heartbeat(sessionId), 4000);
    return () => clearInterval(id);
  }, [sessionId, session?.phase]);

  useEffect(() => {
    if (!sessionId || !session || session.phase !== "question") {
      setQuestion(null);
      return;
    }

    let cancelled = false;
    setAnswered(false);
    setFeedback(null);
    setSelectedOptionId(null);

    getCurrentQuestion(sessionId).then((q) => {
      if (cancelled || !q) return;
      setQuestion(q);
      questionStartedAt.current = Date.now();
      // Anchored off the server's question_started_at (when available)
      // instead of always handing out a fresh full timer — a device that
      // reconnects mid-question sees the actual time left, not an unfair
      // extra full countdown.
      const elapsedSec = session?.question_started_at
        ? Math.floor((Date.now() - new Date(session.question_started_at).getTime()) / 1000)
        : 0;
      setSecondsLeft(Math.max(0, q.timer_seconds - Math.max(0, elapsedSec)));
      if (playerSettings?.sound_enabled !== false) playTone("pop");
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.phase, session?.current_question_index]);

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!question || answered) return;

    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          handleSubmit(null);
          return 0;
        }
        if (s <= 6 && playerSettings?.sound_enabled !== false) playTone("tick");
        return s - 1;
      });
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, answered]);

  useEffect(() => {
    if (!sessionId || session?.phase !== "ended" || endedHandled.current) return;
    endedHandled.current = true;
    setEndStep("splash");

    setShowConfetti(true);
    const confettiTimer = setTimeout(() => setShowConfetti(false), 4000);

    getMyAnswerReview(sessionId)
      .then(setReviewQuestions)
      .catch(() => {});

    getMyResult(sessionId).then(setMyResult);

    issueMyCertificate(sessionId)
      .then(setCertificate)
      .catch(() => {
        // not a passing score — no certificate to offer, that's fine
      });

    return () => clearTimeout(confettiTimer);
  }, [sessionId, session?.phase]);

  // Once the trainee moves past the splash into their certificate/answer review,
  // this screen auto-closes back to the Join Quiz page after a few minutes —
  // admin-configurable in Quiz Settings, defaulting to 5 if never set.
  useEffect(() => {
    if (endStep !== "details") return;
    const closeSeconds = (playerSettings?.result_close_minutes ?? 5) * 60;
    setReviewSecondsLeft(closeSeconds);
    const t = setInterval(() => {
      setReviewSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          navigate(ROUTES.QUIZ_JOIN, { replace: true });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [endStep, navigate, playerSettings?.result_close_minutes]);

  async function handleSubmit(optionId: string | null) {
    if (!sessionId || !question || answered) return;
    setAnswered(true);
    setSelectedOptionId(optionId);
    if (tickRef.current) clearInterval(tickRef.current);

    const responseTimeMs = Date.now() - questionStartedAt.current;
    try {
      const result = await submitAnswer(sessionId, question.question_id, optionId, responseTimeMs);
      setFeedback(result);
      if (playerSettings?.sound_enabled !== false) playTone(result.is_correct ? "correct" : "wrong");
    } catch {
      // network hiccup — leave the answer locked, host will still advance the quiz for everyone
    }
  }

  if (!session) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Loading…</div>;
  }

  if (session.phase === "lobby") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
        {playerSettings?.brand_logo_url && (
          <img src={playerSettings.brand_logo_url} alt="" className="h-16 w-16 object-contain rounded-xl" />
        )}
        <div className="h-8 w-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        <div className="text-lg font-semibold text-white">Waiting for trainer to start…</div>
        <div className="text-sm text-slate-400">{locationState.quizTitle}</div>
      </div>
    );
  }

  if (session.phase === "paused") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-center px-6">
        <div>
          <div className="text-3xl mb-2">⏸</div>
          <div className="text-lg font-semibold text-white">Quiz paused by trainer</div>
        </div>
      </div>
    );
  }

  if (session.phase === "ended") {
    // Marks-based rank (correct answers, tie broken by speed) — deliberately
    // NOT the gamified "score" the in-quiz leaderboard sidebar uses, which
    // stays purely for fun and has no bearing on the trainee's actual result.
    const ranked = rankByMarks(participants);
    const myIndex = ranked.findIndex((p) => p.id === participantId);
    const rank = myIndex + 1;
    const reviewMins = Math.floor(reviewSecondsLeft / 60);
    const reviewSecs = reviewSecondsLeft % 60;

    const resultTitle =
      myResult?.grade === "PASS"
        ? playerSettings?.result_pass_title || "🏆 Champion!"
        : myResult?.grade === "NEED_IMPROVEMENT"
          ? playerSettings?.result_improve_title || "📈 Need Improvement"
          : myResult?.grade === "FAIL"
            ? playerSettings?.result_fail_title || "💪 Keep Practicing"
            : rank === 1
              ? "You Won! 🎉"
              : "Well Done!";
    const resultMessage =
      myResult?.grade === "PASS"
        ? playerSettings?.result_pass_message
        : myResult?.grade === "NEED_IMPROVEMENT"
          ? playerSettings?.result_improve_message
          : myResult?.grade === "FAIL"
            ? playerSettings?.result_fail_message
            : null;

    const commonStyles = (
      <style>{`
        @keyframes quiz-pop-in {
          0% { transform: scale(0.6); opacity: 0; }
          70% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes quiz-glow {
          0%, 100% { text-shadow: 0 0 20px rgba(251,191,36,0.55); }
          50% { text-shadow: 0 0 44px rgba(251,191,36,0.9); }
        }
      `}</style>
    );

    if (endStep === "splash") {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-5 px-6 text-center">
          {showConfetti && <QuizConfetti />}
          {commonStyles}
          <div className="flex flex-col items-center gap-1 animate-[quiz-pop-in_0.5s_ease-out]">
            <div className="text-6xl">{MEDALS[rank - 1] ?? "🎖️"}</div>
            <div className="text-2xl mt-1">🏆</div>
            <div className="text-2xl font-extrabold text-white mt-2">{resultTitle}</div>
            <div className="text-6xl font-black text-amber-400 mt-2 animate-[quiz-glow_2s_ease-in-out_infinite]">
              {myResult ? `${myResult.percent_correct}%` : "…"}
            </div>
            {resultMessage && <div className="text-sm text-slate-300 max-w-xs mt-2">{resultMessage}</div>}
          </div>
          <button
            onClick={() => setEndStep("details")}
            className="mt-2 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold rounded-full px-10 py-3.5 text-lg shadow-lg shadow-amber-500/20"
          >
            Let's Go! 🚀
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center gap-3 px-6 py-10 text-center overflow-y-auto">
        {commonStyles}
        <div className="text-xs font-mono text-amber-400">
          Closing in {reviewMins}:{String(reviewSecs).padStart(2, "0")}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-8 py-5">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Your Result</div>
          <div className="text-4xl font-mono font-bold text-amber-400">{myResult?.percent_correct ?? 0}%</div>
          <div className="text-xs text-slate-500 mt-1">
            {myResult?.correct_count ?? 0}/{myResult?.total_questions ?? 0} correct
            {rank > 0 && ` · Rank #${rank} of ${ranked.length}`}
          </div>
        </div>

        {certificate && <QuizCertificateButton cert={certificate} />}

        {reviewQuestions && reviewQuestions.length > 0 && (
          <div className="w-full max-w-lg mt-4 text-left">
            <div className="text-sm font-semibold text-white mb-2">📋 Your Answer Sheet</div>
            <div className="flex flex-col gap-3 pb-6">
              {reviewQuestions.map((q) => (
                <div key={q.question_index} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-sm font-semibold text-white mb-2">
                    Q{q.question_index + 1}. {q.question_text}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {q.options.map((opt) => (
                      <div
                        key={opt.option_id}
                        className={`text-xs rounded-lg px-3 py-2 border ${
                          opt.is_correct
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                            : opt.was_chosen
                              ? "border-red-500 bg-red-500/10 text-red-300"
                              : "border-slate-700 text-slate-400"
                        }`}
                      >
                        {opt.option_text}
                        {opt.is_correct ? " ✓" : opt.was_chosen ? " ✗ (your answer)" : ""}
                      </div>
                    ))}
                  </div>
                  {q.explanation && <div className="text-xs text-slate-500 mt-2 italic">{q.explanation}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!question) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Loading question…</div>;
  }

  const fallbackColors = [
    { box: "#e11d48", font: "#fff" },
    { box: "#2563eb", font: "#fff" },
    { box: "#f59e0b", font: "#fff" },
    { box: "#16a34a", font: "#fff" },
  ];
  const colors = playerSettings?.option_colors?.length ? playerSettings.option_colors : fallbackColors;
  const fontSize = playerSettings?.option_font_size ?? 16;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {justReconnected && (
        <div className="bg-amber-400 text-amber-950 text-center text-xs font-bold py-1.5">
          🔄 Reconnected — you're on Question {question.question_index + 1} of {question.total_questions}
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Q{question.question_index + 1} of {question.total_questions}
        </span>
        <span
          className={`h-12 w-12 rounded-full border-2 flex items-center justify-center font-mono font-bold ${
            secondsLeft <= 5 ? "border-red-500 text-red-400 animate-pulse" : "border-amber-400 text-white"
          }`}
        >
          {secondsLeft}
        </span>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="px-6 py-8 text-center text-lg font-semibold text-white">{question.question_text}</div>

        <div className="px-4 grid grid-cols-1 gap-3">
          {question.options.map((opt, i) => {
            const c = colors[i % colors.length];
            const isSelected = selectedOptionId === opt.option_id;
            const isCorrectReveal = answered && feedback && opt.option_id === feedback.correct_option_id;
            return (
              <button
                key={opt.option_id}
                disabled={answered}
                onClick={() => handleSubmit(opt.option_id)}
                style={{ backgroundColor: c.box, color: c.font, fontSize }}
                className={`rounded-2xl py-5 px-4 font-bold transition-opacity disabled:cursor-default ${
                  answered && !isSelected && !isCorrectReveal ? "opacity-30" : "opacity-100"
                } ${isCorrectReveal ? "ring-4 ring-white/70" : ""}`}
              >
                {opt.option_text}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="text-center mt-6 px-6">
            {feedback ? (
              <>
                <div className="text-3xl mb-1">{feedback.is_correct ? "✅" : selectedOptionId ? "❌" : "⏰"}</div>
                <div className="font-bold text-white">
                  {feedback.is_correct ? `Correct! +${feedback.points_awarded}` : selectedOptionId ? "Wrong answer" : "Time's up!"}
                </div>
                {feedback.explanation && (
                  <div className="text-sm text-slate-300 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mt-3 max-w-md mx-auto text-left">
                    💡 {feedback.explanation}
                  </div>
                )}
              </>
            ) : (
              <div className="text-slate-400 text-sm">Recording your answer…</div>
            )}
            <div className="text-xs text-slate-500 mt-2">Waiting for the next question…</div>
          </div>
        )}
      </div>
    </div>
  );
}
