import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { supabaseQuizPlayer } from "../../lib/supabaseQuizPlayer";
import { useQuizSessionRealtime } from "../../hooks/quiz/useQuizSessionRealtime";
import { getCurrentQuestion, submitAnswer } from "../../services/quiz/quizPlayService";
import { listParticipants } from "../../repositories/quiz/quizParticipantRepository";
import { getPlayerSettings } from "../../repositories/quiz/quizSettingsRepository";
import { playTone } from "../../services/quiz/quizSoundService";
import { issueMyCertificate } from "../../repositories/quiz/quizCertificateRepository";
import { getMyAnswerReview } from "../../repositories/quiz/quizAnswerRepository";
import QuizCertificateButton from "../../components/quiz/QuizCertificateButton";
import QuizConfetti from "../../components/quiz/QuizConfetti";
import type { PublicQuizQuestion, SubmitAnswerResult, QuizPlayerSettings, QuizCertificate, AnswerReviewQuestion } from "../../types/quiz";

const REVIEW_VISIBLE_SECONDS = 5 * 60;

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
  const [reviewSecondsLeft, setReviewSecondsLeft] = useState(REVIEW_VISIBLE_SECONDS);

  const questionStartedAt = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedHandled = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    getPlayerSettings(sessionId).then(setPlayerSettings).catch(() => {});
  }, [sessionId]);

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
      if (mine) setParticipantId(mine.id);
      else navigate(ROUTES.QUIZ_JOIN, { replace: true });
    })();
  }, [participantId, sessionId, navigate]);

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
      setSecondsLeft(q.timer_seconds);
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

    setShowConfetti(true);
    const confettiTimer = setTimeout(() => setShowConfetti(false), 4000);

    getMyAnswerReview(sessionId)
      .then(setReviewQuestions)
      .catch(() => {});

    issueMyCertificate(sessionId)
      .then(setCertificate)
      .catch(() => {
        // not a passing score — no certificate to offer, that's fine
      });

    return () => clearTimeout(confettiTimer);
  }, [sessionId, session?.phase]);

  useEffect(() => {
    if (!reviewQuestions) return;
    const t = setInterval(() => {
      setReviewSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          setReviewQuestions(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [reviewQuestions]);

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
    const sorted = participants.slice().sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex((p) => p.id === participantId) + 1;
    const me = sorted.find((p) => p.id === participantId);
    const medals = ["🥇", "🥈", "🥉"];
    const reviewMins = Math.floor(reviewSecondsLeft / 60);
    const reviewSecs = reviewSecondsLeft % 60;

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center gap-3 px-6 py-10 text-center overflow-y-auto">
        {showConfetti && <QuizConfetti />}

        <div className="flex flex-col items-center gap-3 animate-[quiz-pop-in_0.5s_ease-out]">
          <style>{`
            @keyframes quiz-pop-in {
              0% { transform: scale(0.6); opacity: 0; }
              70% { transform: scale(1.08); opacity: 1; }
              100% { transform: scale(1); }
            }
          `}</style>
          <div className="text-4xl">{medals[rank - 1] ?? "🎖️"}</div>
          <div className="text-xl font-bold text-white">
            {rank === 1 ? "You Won! 🎉" : rank > 0 && rank <= 3 ? "Top 3! 🌟" : "Well Done!"}
          </div>
          {rank > 0 && <div className="text-sm text-slate-400">Rank #{rank} of {sorted.length}</div>}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl px-8 py-5 mt-2">
            <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Your Score</div>
            <div className="text-4xl font-mono font-bold text-amber-400">{me?.score ?? 0}</div>
            <div className="text-xs text-slate-500 mt-1">{me?.correct_count ?? 0} correct</div>
          </div>
        </div>

        {certificate && <QuizCertificateButton cert={certificate} />}

        {reviewQuestions && reviewQuestions.length > 0 && (
          <div className="w-full max-w-lg mt-4 text-left">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-white">📋 Your Answer Sheet</div>
              <div className="text-xs font-mono text-amber-400">
                disappears in {reviewMins}:{String(reviewSecs).padStart(2, "0")}
              </div>
            </div>
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
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Q{question.question_index + 1} of {question.total_questions}
        </span>
        <span className="h-12 w-12 rounded-full border-2 border-amber-400 flex items-center justify-center font-mono font-bold">
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
