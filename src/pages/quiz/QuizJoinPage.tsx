import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { joinByPin, getSavedPlayerName } from "../../services/quiz/quizPlayService";
import { getPublicQuizBranding } from "../../repositories/quiz/quizSettingsRepository";
import { applyQuizFavicon } from "../../services/quiz/quizBrandingRuntimeService";
import type { QuizPublicBranding } from "../../types/quiz";

export default function QuizJoinPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [name, setName] = useState(getSavedPlayerName());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<QuizPublicBranding | null>(null);

  useEffect(() => {
    getPublicQuizBranding().then((b) => {
      setBranding(b);
      applyQuizFavicon(b?.favicon_url);
    });
  }, []);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await joinByPin(pin, name);
      navigate(ROUTES.QUIZ_PLAY.replace(":sessionId", result.sessionId), {
        state: { participantId: result.participantId, quizTitle: result.quizTitle },
      });
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not join.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="h-2.5 w-2.5 rounded-full bg-amber-400 mx-auto mb-3 animate-pulse" />
        <h1 className="text-lg font-bold text-white mb-1">Join Quiz</h1>
        <p className="text-xs text-slate-400 mb-6">Enter the PIN shown on screen</p>

        {error && (
          <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
              6-Digit PIN
            </label>
            <input
              className="w-full text-center font-mono text-2xl tracking-[0.3em] rounded-xl bg-slate-800 border-2 border-slate-700 px-3 py-3 text-white outline-none focus:border-violet-500"
              maxLength={6}
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Your Name
            </label>
            <input
              className="w-full text-center rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-white outline-none focus:border-violet-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-amber-950 font-bold rounded-xl py-3"
          >
            {loading ? "Joining…" : "Join Now →"}
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.QUIZ_ADMIN_LOGIN)}
            className="w-full text-slate-400 hover:text-slate-200 text-xs font-semibold py-2"
          >
            ← Admin Login
          </button>
        </form>

        <p className="mt-5 text-xs text-slate-500">Get the PIN from your trainer</p>

        {branding?.footer_text && (
          <p className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-slate-500 whitespace-pre-line">
            {branding.footer_text}
          </p>
        )}
      </div>
    </div>
  );
}
