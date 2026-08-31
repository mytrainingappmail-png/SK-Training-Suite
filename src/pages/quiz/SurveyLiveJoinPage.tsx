import { useEffect, useRef, useState } from "react";

import SurveyQuestionsForm from "../../components/survey/SurveyQuestionsForm";
import { joinSurveySession, submitSurveySessionResponse } from "../../repositories/survey/surveyPublicRepository";
import type { JoinedSurveySession, SurveyAnswerInput } from "../../types/survey";

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "Short time" live mode — PIN + name, right there, no link to hunt
 * for. Unlike the anonymous flow, the display name IS recorded (tied
 * only to this one session's participant row) so the host can see who
 * joined — deliberately a different trade-off for a quick pulse-check
 * during a meeting, not a sensitive feedback survey. */
export default function SurveyLiveJoinPage() {
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<JoinedSurveySession | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [autoSubmitSignal, setAutoSubmitSignal] = useState(0);
  const autoSubmitted = useRef(false);

  useEffect(() => {
    if (!session?.expires_at) return;
    const expiresAtMs = new Date(session.expires_at).getTime();

    function tick() {
      const secondsLeft = Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000));
      setRemainingSeconds(secondsLeft);
      if (secondsLeft === 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        setAutoSubmitSignal((n) => n + 1);
      }
    }

    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [session?.expires_at]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim() || !name.trim()) return;
    setJoining(true);
    setError("");
    try {
      const result = await joinSurveySession(pin.trim(), name.trim());
      if (!result) {
        setError("This survey has no questions yet — check with the host.");
        return;
      }
      setSession(result);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not join.");
    } finally {
      setJoining(false);
    }
  }

  async function handleSubmit(answers: SurveyAnswerInput[]) {
    if (!session) return;
    await submitSurveySessionResponse(session.participant_id, answers);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-sm text-center bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="text-lg font-bold text-white mb-1">Thanks, {name}!</h1>
          <p className="text-sm text-slate-400">Your response is in.</p>
        </div>
      </div>
    );
  }

  if (session) {
    const urgent = remainingSeconds !== null && remainingSeconds <= 30;
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10">
        <div className="max-w-lg mx-auto space-y-6">
          {remainingSeconds !== null && (
            <div className={`sticky top-2 z-10 mx-auto w-fit rounded-full px-4 py-1.5 text-sm font-mono font-bold ${urgent ? "bg-red-500/20 text-red-300 animate-pulse" : "bg-slate-800 text-slate-200"}`}>
              ⏱ {formatCountdown(remainingSeconds)}
            </div>
          )}
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">{session.title}</h1>
            {session.description && <p className="text-sm text-slate-400 mt-1">{session.description}</p>}
            <p className="text-[11px] text-slate-500 mt-2">Joined as <span className="font-semibold text-slate-300">{name}</span></p>
          </div>
          <SurveyQuestionsForm
            questions={session.questions}
            settings={{ option_font_size: 16, option_colors: [{ box: "#7C3AED", font: "#FFFFFF" }, { box: "#0891B2", font: "#FFFFFF" }, { box: "#059669", font: "#FFFFFF" }] }}
            onSubmit={handleSubmit}
            autoSubmitSignal={autoSubmitSignal}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="h-2.5 w-2.5 rounded-full bg-amber-400 mx-auto mb-3 animate-pulse" />
        <h1 className="text-lg font-bold text-white mb-1">Join Survey</h1>
        <p className="text-xs text-slate-400 mb-6">Enter the PIN shown by the host</p>

        {error && <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

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
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
            />
          </div>
          <button
            type="submit"
            disabled={joining || pin.length !== 6 || !name.trim()}
            className="w-full text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg px-4 py-3"
          >
            {joining ? "Joining…" : "Join →"}
          </button>
        </form>
      </div>
    </div>
  );
}
