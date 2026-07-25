import { useState } from "react";

import { getCurrentQuizAdmin, setCurrentQuizAdmin } from "../../services/quiz/quizAdminSession";
import { changeOwnPassword } from "../../services/quiz/quizAuthService";
import { updateProfile } from "../../repositories/quiz/quizAdminRepository";

export default function QuizAccountModal({ onClose }: { onClose: () => void }) {
  const admin = getCurrentQuizAdmin();

  const [displayName, setDisplayName] = useState(admin?.display_name ?? "");
  const [contactEmail, setContactEmail] = useState(admin?.contact_email ?? "");
  const [contactMobile, setContactMobile] = useState(admin?.contact_mobile ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!admin) return;
    setProfileError("");
    setProfileMessage("");
    setProfileSaving(true);

    try {
      const updated = await updateProfile(admin.id, {
        display_name: displayName.trim() || admin.username,
        contact_email: contactEmail.trim(),
        contact_mobile: contactMobile.trim(),
      });
      setCurrentQuizAdmin(updated);
      setProfileMessage("Profile updated.");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }

    setPasswordSaving(true);
    const result = await changeOwnPassword(newPassword);
    setPasswordSaving(false);

    if (!result.success) {
      setPasswordError(result.error ?? "Could not update password.");
      return;
    }

    setPasswordMessage("Password updated.");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">My Account</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Profile</h3>
          {profileError && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{profileError}</div>
          )}
          {profileMessage && (
            <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              {profileMessage}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Name</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Mobile</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={contactMobile}
              onChange={(e) => setContactMobile(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={profileSaving}
            className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm py-2"
          >
            {profileSaving ? "Saving…" : "Save Profile"}
          </button>
        </form>

        <hr className="border-slate-800" />

        <form onSubmit={handleChangePassword} className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">🔑 Change Password</h3>
          {passwordError && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{passwordError}</div>
          )}
          {passwordMessage && (
            <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              {passwordMessage}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">New Password</label>
            <input
              type="password"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Confirm Password</label>
            <input
              type="password"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={passwordSaving}
            className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 text-white font-semibold text-sm py-2"
          >
            {passwordSaving ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
