import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { useQuizSessionRealtime } from "../../hooks/quiz/useQuizSessionRealtime";
import { getQuiz } from "../../services/quiz/quizService";
import { startQuiz, advanceQuestion, endSession } from "../../services/quiz/quizSessionService";
import type { QuizWithQuestions } from "../../types/quiz";

export default function QuizHostLivePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, participants } = useQuizSessionRealtime(sessionId ?? null);

  const [quiz, setQuiz] = useState<QuizWithQuestions | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!session) return;
    getQuiz(session.quiz_id).then(setQuiz);
  }, [session?.quiz_id]);

  const currentQuestion = quiz && session ? quiz.questions[session.current_question_index] : null;

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!session || session.phase !== "question" || !currentQuestion) return;

    const total = currentQuestion.timer_seconds ?? quiz?.default_timer_seconds ?? 30;
    setSecondsLeft(total);
    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [session?.phase, session?.current_question_index]);

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
              <div className="text-center py-4">
                <div className="text-3xl mb-2">🏆</div>
                <div className="text-xl font-bold">Quiz Complete!</div>
              </div>
              <Podium participants={participants} />
              <div className="flex justify-center gap-3">
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
                  <span className="font-mono text-xs text-amber-400 font-bold">{p.score}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
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
