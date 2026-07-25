import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { login, requestPasswordReset } from "../../services/quiz/quizAuthService";

export default function QuizAdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login({ username, password });
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    navigate(ROUTES.QUIZ_ADMIN_DASHBOARD, { replace: true });
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage("");

    const result = await requestPasswordReset(identifier);
    setForgotLoading(false);
    setForgotMessage(result.message);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8">
        <div className="text-center mb-6">
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400 mx-auto mb-2 animate-pulse" />
          <h1 className="text-lg font-semibold text-white">Live Quiz — Admin</h1>
          <p className="text-xs text-slate-400 mt-1">Separate login from the main LMS</p>
        </div>

        {!showForgot ? (
          <>
            {error && (
              <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Username
                </label>
                <input
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  autoComplete="username"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgot(true);
                      setForgotMessage("");
                    }}
                    className="text-xs text-violet-400 hover:text-violet-300"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 transition-colors"
              >
                {loading ? "Signing in…" : "Login to Admin Panel"}
              </button>
            </form>

            <hr className="my-5 border-slate-800" />

            <div className="text-center">
              <p className="text-sm text-slate-400 mb-3">Are you a trainee?</p>
              <button
                onClick={() => navigate(ROUTES.QUIZ_JOIN)}
                className="w-full rounded-lg bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold text-sm py-2.5 transition-colors"
              >
                👤 Join a Quiz
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-400 mb-4 text-center">
              Enter the email or mobile number registered to your admin account and we'll send a reset link to your
              email.
            </p>

            {forgotMessage && (
              <div className="mb-4 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                {forgotMessage}
              </div>
            )}

            <form onSubmit={handleForgotSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Email or Mobile Number
                </label>
                <input
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com or 98765xxxxx"
                />
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 transition-colors"
              >
                {forgotLoading ? "Sending…" : "Send Reset Link"}
              </button>
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                className="w-full text-slate-400 hover:text-slate-200 text-xs font-semibold py-2"
              >
                ← Back to Login
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
