import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { supabaseQuizPlayer } from "../../lib/supabaseQuizPlayer";
import { useQuizSessionRealtime } from "../../hooks/quiz/useQuizSessionRealtime";
import { getCurrentQuestion, submitAnswer } from "../../services/quiz/quizPlayService";
import { listParticipants } from "../../repositories/quiz/quizParticipantRepository";
import { getPlayerSettings } from "../../repositories/quiz/quizSettingsRepository";
import { playTone } from "../../services/quiz/quizSoundService";
import type { PublicQuizQuestion, SubmitAnswerResult, QuizPlayerSettings } from "../../types/quiz";

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

  const questionStartedAt = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 px-6 text-center">
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
