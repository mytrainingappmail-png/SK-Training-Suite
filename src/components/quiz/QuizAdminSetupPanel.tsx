import { useState } from "react";

import { supabase } from "../../lib/supabase";
import { loadCompany } from "../../services/company/companyService";

// Uses the LMS's own authenticated Supabase client (a real ES256 session
// from the currently logged-in SuperAdmin) to call the SAME edge function
// the standalone Live Quiz app itself cannot call yet — bootstrapping a
// company's very first quiz_admins row is a chicken-and-egg problem
// otherwise, since the quiz app's login page has no session to invoke a
// service-role edge function with until an admin already exists.
export default function QuizAdminSetupPanel() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ companyCode: string; internalEmail: string; username: string } | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreated(null);

    if (!username.trim() || !password) {
      setError("Username and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const company = await loadCompany();
      if (!company) throw new Error("Could not resolve your company.");

      const { data, error: fnError } = await supabase.functions.invoke("provision-quiz-admin-auth", {
        body: {
          companyId: company.id,
          companyCode: company.company_code,
          username: username.trim(),
          displayName: displayName.trim() || username.trim(),
          password,
          role: "super_admin",
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || "Could not create the quiz admin account.");

      setCreated({ companyCode: company.company_code, internalEmail: data.internalEmail, username: username.trim() });
      setUsername("");
      setDisplayName("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Live Quiz — Admin Setup</h2>
        <p className="text-sm text-slate-500 mt-1">
          Create a login for the standalone Live Quiz app. It has its own username/password, completely separate
          from LMS employee accounts — use it to sign in at the "Live Quiz" link in the sidebar.
        </p>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      {created && (
        <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 space-y-1">
          <div className="font-semibold">Quiz admin created ✅</div>
          <div>Company Code: <span className="font-mono font-semibold">{created.companyCode}</span></div>
          <div>Username: <span className="font-mono font-semibold">{created.username}</span></div>
          <div className="text-xs text-emerald-700 mt-1">
            Use these plus the password you chose to log in at the Live Quiz link.
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Username</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. quizadmin"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Display Name</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Quiz Admin"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Password</label>
          <input
            type="password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5"
        >
          {loading ? "Creating…" : "Create Quiz Admin"}
        </button>
      </form>
    </div>
  );
}
