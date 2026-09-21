import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { ensureParticipantSession, getSavedPlayerName } from "../../services/quiz/quizPlayService";
import { joinExam } from "../../repositories/exam/examPlayRepository";

/** Employee entry to an exam: PIN + name. Mobile-first, one card. */
export default function ExamJoinPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [name, setName] = useState(getSavedPlayerName());
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length !== 6 || !name.trim()) return;
    setJoining(true);
    setError("");
    try {
      await ensureParticipantSession();
      const { sessionId } = await joinExam(pin, name.trim());
      try { localStorage.setItem("QUIZ_PLAYER_NAME", name.trim()); } catch { /* non-fatal */ }
      navigate(ROUTES.EXAM_PAPER.replace(":sessionId", sessionId), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the exam.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center">
        <div className="text-3xl mb-2">📝</div>
        <h1 className="text-lg font-bold text-white mb-1">Join Exam</h1>
        <p className="text-xs text-slate-400 mb-6">Enter the PIN your trainer shows</p>

        {error && <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-left">{error}</div>}

        <form onSubmit={handleJoin} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">6-Digit PIN</label>
            <input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              className="w-full text-center text-2xl tracking-[0.3em] font-bold rounded-lg bg-slate-800 border border-slate-700 px-3 py-3 text-white outline-none focus:border-violet-500"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Your Name</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-3 text-base text-white outline-none focus:border-violet-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
            />
          </div>
          <button
            type="submit"
            disabled={joining || pin.length !== 6 || !name.trim()}
            className="w-full text-base font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg px-4 py-3.5"
          >
            {joining ? "Joining…" : "Join →"}
          </button>
        </form>

        <Link to={ROUTES.QUIZ_JOIN} className="block mt-5 text-xs text-slate-500 hover:text-slate-300">
          Joining a live quiz instead? →
        </Link>
      </div>
    </div>
  );
}
