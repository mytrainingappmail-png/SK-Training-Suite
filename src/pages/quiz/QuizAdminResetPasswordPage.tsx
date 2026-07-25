import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { supabaseQuiz } from "../../lib/supabaseQuiz";
import { updatePasswordFromRecovery } from "../../services/quiz/quizAuthService";

/**
 * Landing page for the emailed recovery link. supabase-js auto-detects the
 * access_token/type=recovery fragment in the URL on load (detectSessionInUrl
 * is on by default) and establishes a temporary session on supabaseQuiz —
 * this page just waits for that, then lets the admin set a new password.
 */
export default function QuizAdminResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabaseQuiz.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setHasSession(!!data.session);
      setReady(true);
    });

    const { data: listener } = supabaseQuiz.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const result = await updatePasswordFromRecovery(password);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Could not update password.");
      return;
    }

    setSuccess(true);
    setTimeout(() => navigate(ROUTES.QUIZ_ADMIN_LOGIN, { replace: true }), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8">
        <div className="text-center mb-6">
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400 mx-auto mb-2 animate-pulse" />
          <h1 className="text-lg font-semibold text-white">Set a New Password</h1>
        </div>

        {!ready ? (
          <div className="text-sm text-slate-400 text-center">Checking your reset link…</div>
        ) : !hasSession ? (
          <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            This reset link is invalid or has expired. Request a new one from the login page.
          </div>
        ) : success ? (
          <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 text-center">
            Password updated! Redirecting to login…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                New Password
              </label>
              <input
                type="password"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5"
            >
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
