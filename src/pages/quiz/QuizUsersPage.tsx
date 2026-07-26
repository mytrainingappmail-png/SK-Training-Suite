import { useEffect, useState } from "react";

import { getCurrentQuizAdmin } from "../../services/quiz/quizAdminSession";
import {
  listAdmins,
  provisionAdmin,
  updateAdminStatus,
  updateAdminPermissions,
} from "../../repositories/quiz/quizAdminRepository";
import {
  listRoster,
  addRosterEntry,
  setRosterActive,
  removeRosterEntry,
} from "../../repositories/quiz/quizRosterRepository";
import { getSettings, saveSettings } from "../../repositories/quiz/quizSettingsRepository";
import type { QuizAdmin, QuizRosterEntry, QuizJoinMode, QuizAdminRole, QuizPermissionLevel } from "../../types/quiz";

export default function QuizUsersPage() {
  const me = getCurrentQuizAdmin();
  const [admins, setAdmins] = useState<QuizAdmin[]>([]);
  const [roster, setRoster] = useState<QuizRosterEntry[]>([]);
  const [joinMode, setJoinMode] = useState<QuizJoinMode>("open");
  const [loading, setLoading] = useState(true);

  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newRole, setNewRole] = useState<QuizAdminRole>("admin");
  const [newPermissionLevel, setNewPermissionLevel] = useState<QuizPermissionLevel>("edit");
  const [addUserError, setAddUserError] = useState("");
  const [addUserLoading, setAddUserLoading] = useState(false);

  const [rosterName, setRosterName] = useState("");
  const [rosterCode, setRosterCode] = useState("");
  const [rosterPhone, setRosterPhone] = useState("");

  function refresh() {
    if (!me) return;
    setLoading(true);
    Promise.all([listAdmins(me.company_id), listRoster(me.company_id), getSettings(me.company_id)])
      .then(([a, r, s]) => {
        setAdmins(a);
        setRoster(r);
        setJoinMode(s.default_join_mode);
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [me]);

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setAddUserError("");

    if (!newUsername.trim() || !newPassword || !newContactEmail.trim()) {
      setAddUserError("Username, password and contact email are required.");
      return;
    }
    if (newPassword.length < 8) {
      setAddUserError("Password must be at least 8 characters.");
      return;
    }

    setAddUserLoading(true);
    const result = await provisionAdmin({
      companyId: me.company_id,
      username: newUsername.trim(),
      displayName: newDisplayName.trim() || newUsername.trim(),
      password: newPassword,
      role: newRole,
      permissionLevel: newPermissionLevel,
      contactEmail: newContactEmail.trim(),
    });
    setAddUserLoading(false);

    if (!result.success) {
      setAddUserError(result.error ?? "Could not create the user.");
      return;
    }

    setShowAddUser(false);
    setNewUsername("");
    setNewDisplayName("");
    setNewPassword("");
    setNewContactEmail("");
    setNewRole("admin");
    setNewPermissionLevel("edit");
    refresh();
  }

  async function handleToggleStatus(admin: QuizAdmin) {
    await updateAdminStatus(admin.id, admin.status === "active" ? "disabled" : "active");
    refresh();
  }

  async function handleRoleChange(admin: QuizAdmin, role: QuizAdminRole) {
    await updateAdminPermissions(admin.id, { role });
    refresh();
  }

  async function handlePermissionChange(admin: QuizAdmin, permission_level: QuizPermissionLevel) {
    await updateAdminPermissions(admin.id, { permission_level });
    refresh();
  }

  async function handleJoinModeChange(mode: QuizJoinMode) {
    if (!me) return;
    setJoinMode(mode);
    await saveSettings(me.company_id, { default_join_mode: mode });
  }

  async function handleAddTrainee(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !rosterName.trim() || !rosterCode.trim()) return;
    await addRosterEntry(me.company_id, { name: rosterName.trim(), employee_code: rosterCode.trim(), phone: rosterPhone.trim() });
    setRosterName("");
    setRosterCode("");
    setRosterPhone("");
    refresh();
  }

  async function handleToggleTrainee(entry: QuizRosterEntry) {
    await setRosterActive(entry.id, !entry.active);
    refresh();
  }

  async function handleRemoveTrainee(entry: QuizRosterEntry) {
    if (!confirm(`Remove ${entry.name} from the trainee directory?`)) return;
    await removeRosterEntry(entry.id);
    refresh();
  }

  if (loading) return <div className="text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">User Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage admins &amp; the trainee directory</p>
        </div>
        {me?.role === "super_admin" && (
          <button
            onClick={() => setShowAddUser((v) => !v)}
            className="text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2"
          >
            + Add User
          </button>
        )}
      </div>

      {showAddUser && (
        <form onSubmit={handleAddUser} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          {addUserError && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{addUserError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              placeholder="Username (unique)"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
            />
            <input
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              placeholder="Display Name"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
            />
            <input
              type="password"
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              placeholder="Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              type="email"
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              placeholder="Contact Email"
              value={newContactEmail}
              onChange={(e) => setNewContactEmail(e.target.value)}
            />
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Role</label>
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as QuizAdminRole)}
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Access Level</label>
              <select
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-50"
                value={newRole === "super_admin" ? "edit" : newPermissionLevel}
                disabled={newRole === "super_admin"}
                onChange={(e) => setNewPermissionLevel(e.target.value as QuizPermissionLevel)}
              >
                <option value="view_only">View Only</option>
                <option value="edit">Can Edit</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={addUserLoading}
            className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2"
          >
            {addUserLoading ? "Creating…" : "Create User"}
          </button>
        </form>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Access</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => {
              const canManage = a.id !== me?.id && me?.role === "super_admin";
              return (
                <tr key={a.id} className="border-b border-slate-800 last:border-0">
                  <td className="px-4 py-3 text-white">{a.display_name}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{a.username}</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <select
                        value={a.role}
                        onChange={(e) => handleRoleChange(a, e.target.value as QuizAdminRole)}
                        className="text-[10px] font-bold uppercase bg-amber-500/15 text-amber-300 rounded px-2 py-1 border-none outline-none"
                      >
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                        {a.role === "super_admin" ? "Super Admin" : "Admin"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {a.role === "super_admin" ? (
                      <span className="text-xs text-slate-500">Full access</span>
                    ) : canManage ? (
                      <select
                        value={a.permission_level}
                        onChange={(e) => handlePermissionChange(a, e.target.value as QuizPermissionLevel)}
                        className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
                      >
                        <option value="view_only">View Only</option>
                        <option value="edit">Can Edit</option>
                      </select>
                    ) : (
                      <span className="text-xs text-slate-400">{a.permission_level === "edit" ? "Can Edit" : "View Only"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${a.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700/50 text-slate-400"}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <button
                        onClick={() => handleToggleStatus(a)}
                        className="text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-2.5 py-1"
                      >
                        {a.status === "active" ? "Disable" : "Enable"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-white">👥 Trainee Directory</h2>
            <p className="text-xs text-slate-500 mt-0.5">Registered employees who can join quizzes</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Join Mode:</span>
            <button
              onClick={() => handleJoinModeChange("strict")}
              className={`px-3 py-1.5 rounded-lg font-semibold ${joinMode === "strict" ? "bg-violet-600 text-white" : "text-slate-400 border border-slate-700"}`}
            >
              🔒 Strict
            </button>
            <button
              onClick={() => handleJoinModeChange("open")}
              className={`px-3 py-1.5 rounded-lg font-semibold ${joinMode === "open" ? "bg-amber-400 text-amber-950" : "text-slate-400 border border-slate-700"}`}
            >
              🔓 Open
            </button>
          </div>
        </div>

        <form onSubmit={handleAddTrainee} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            placeholder="Full Name *"
            value={rosterName}
            onChange={(e) => setRosterName(e.target.value)}
          />
          <input
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            placeholder="Employee ID *"
            value={rosterCode}
            onChange={(e) => setRosterCode(e.target.value)}
          />
          <input
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
            placeholder="Phone (optional)"
            value={rosterPhone}
            onChange={(e) => setRosterPhone(e.target.value)}
          />
          <button type="submit" className="rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm px-4 py-2">
            + Add Trainee
          </button>
        </form>

        {roster.length === 0 ? (
          <p className="text-sm text-slate-500">
            No trainees yet. Add your team above. {joinMode === "strict" && "(Strict mode will block joins until trainees are added.)"}
          </p>
        ) : (
          <div className="space-y-1.5">
            {roster.map((r) => (
              <div key={r.id} className="flex items-center gap-3 bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
                <span className="flex-1">
                  {r.name} <span className="text-slate-500 font-mono text-xs">({r.employee_code})</span>
                </span>
                {r.phone && <span className="text-xs text-slate-500">{r.phone}</span>}
                <button onClick={() => handleToggleTrainee(r)} className="text-xs text-slate-400 hover:text-white">
                  {r.active ? "Active" : "Inactive"}
                </button>
                <button onClick={() => handleRemoveTrainee(r)} className="text-xs text-red-300 hover:text-red-200">
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
