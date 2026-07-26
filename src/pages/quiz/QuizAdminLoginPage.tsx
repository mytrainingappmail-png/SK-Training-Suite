import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { login, requestPasswordReset, resetPasswordWithOtp } from "../../services/quiz/quizAuthService";
import { getPublicQuizBranding } from "../../repositories/quiz/quizSettingsRepository";
import type { QuizPublicBranding } from "../../types/quiz";

type Mode = "login" | "forgot-request" | "forgot-verify";

export default function QuizAdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [branding, setBranding] = useState<QuizPublicBranding | null>(null);

  useEffect(() => {
    getPublicQuizBranding().then(setBranding);
  }, []);

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

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage("");
    setForgotError("");

    const result = await requestPasswordReset(identifier);
    setForgotLoading(false);
    setForgotMessage(result.message);
    setMode("forgot-verify");
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setForgotError("");

    if (newPassword !== confirmPassword) {
      setForgotError("Passwords don't match.");
      return;
    }

    setForgotLoading(true);
    const result = await resetPasswordWithOtp(identifier, otp, newPassword);
    setForgotLoading(false);

    if (!result.success) {
      setForgotError(result.error ?? "Could not reset password.");
      return;
    }

    setMode("login");
    setForgotMessage("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setPassword("");
  }

  function backToLogin() {
    setMode("login");
    setForgotMessage("");
    setForgotError("");
    setIdentifier("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-950 px-4 bg-cover bg-center"
      style={branding?.login_background_url ? { backgroundImage: `url(${branding.login_background_url})` } : undefined}
    >
      <div className="w-full max-w-sm bg-slate-900/95 backdrop-blur border border-slate-800 rounded-2xl p-8">
        {branding?.login_banner_url && (
          <img src={branding.login_banner_url} alt="" className="w-full h-28 object-cover rounded-xl mb-5" />
        )}
        <div className="text-center mb-6">
          {branding?.brand_logo_url ? (
            <img src={branding.brand_logo_url} alt="" className="h-12 w-12 object-contain rounded-lg mx-auto mb-2" />
          ) : (
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400 mx-auto mb-2 animate-pulse" />
          )}
          <h1 className="text-lg font-semibold text-white">{branding?.brand_name || branding?.company_name || "Live Quiz — Admin"}</h1>
          <p className="text-xs text-slate-400 mt-1">{branding?.brand_tagline || "Separate login from the main LMS"}</p>
        </div>

        {mode === "login" && (
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
                    onClick={() => setMode("forgot-request")}
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
        )}

        {mode === "forgot-request" && (
          <>
            <p className="text-sm text-slate-400 mb-4 text-center">
              Enter the email or mobile number registered to your admin account and we'll email you a 6-digit code.
            </p>

            {forgotMessage && (
              <div className="mb-4 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                {forgotMessage}
              </div>
            )}

            <form onSubmit={handleRequestOtp} className="space-y-3">
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
                {forgotLoading ? "Sending…" : "Send Code"}
              </button>
              <button
                type="button"
                onClick={backToLogin}
                className="w-full text-slate-400 hover:text-slate-200 text-xs font-semibold py-2"
              >
                ← Back to Login
              </button>
            </form>
          </>
        )}

        {mode === "forgot-verify" && (
          <>
            <p className="text-sm text-slate-400 mb-4 text-center">
              Enter the 6-digit code we emailed you, along with your new password.
            </p>

            {forgotMessage && (
              <div className="mb-4 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                {forgotMessage}
              </div>
            )}
            {forgotError && (
              <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {forgotError}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  6-Digit Code
                </label>
                <input
                  className="w-full text-center font-mono text-xl tracking-[0.3em] rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white outline-none focus:border-violet-500"
                  maxLength={6}
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
                disabled={forgotLoading}
                className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 transition-colors"
              >
                {forgotLoading ? "Updating…" : "Reset Password"}
              </button>
              <button
                type="button"
                onClick={() => setMode("forgot-request")}
                className="w-full text-slate-400 hover:text-slate-200 text-xs font-semibold py-2"
              >
                ← Didn't get a code? Try again
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
