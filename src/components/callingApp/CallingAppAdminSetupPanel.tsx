import { useEffect, useState } from "react";

import { supabase } from "../../lib/supabase";
import { loadCompany } from "../../services/company/companyService";
import { employeeService } from "../../services/employee/employeeService";
import { listCallingAppAdmins, grantEmployeeAccess, updateCallingAppAdmin, removeCallingAppAdmin } from "../../repositories/callingApp/callingAppAdminRepository";
import type { Employee } from "../../types/employee";
import type { CallingAppAdmin } from "../../types/callingApp";

const INPUT_CLS = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500";

export default function CallingAppAdminSetupPanel() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [admins, setAdmins] = useState<CallingAppAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  const [accessType, setAccessType] = useState<"lms" | "dedicated">("lms");
  const [employeeId, setEmployeeId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [canUpload, setCanUpload] = useState(true);
  const [canDownload, setCanDownload] = useState(true);
  const [dailyTarget, setDailyTarget] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadCompany(), employeeService.getAll()]).then(([company, emps]) => {
      setCompanyId(company?.id ?? null);
      setEmployees(emps);
      if (company?.id) {
        listCallingAppAdmins(company.id).then(setAdmins).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
  }, []);

  function refresh() {
    if (companyId) listCallingAppAdmins(companyId).then(setAdmins);
  }

  function handlePickEmployee(id: string) {
    setEmployeeId(id);
    const emp = employees.find((e) => e.id === id);
    if (emp) {
      setDisplayName(`${emp.first_name} ${emp.last_name}`.trim());
      setEmail(emp.email || "");
      if (!username) setUsername(emp.employee_code.toLowerCase());
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreated(null);
    if (!companyId) return;

    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }

    setSaving(true);
    try {
      if (accessType === "lms") {
        if (!employeeId) {
          setError("Pick an existing employee for this access type.");
          setSaving(false);
          return;
        }
        await grantEmployeeAccess(companyId, employeeId, displayName.trim(), email.trim() || null, { isAdmin, canUpload, canDownload, dailyTarget });
        setCreated(`Access granted to ${displayName.trim()} — they'll see "Calling App" in their own dashboard.`);
      } else {
        if (!username.trim() || !password) {
          setError("Username and password are required for a separate login.");
          setSaving(false);
          return;
        }
        if (password.length < 8) {
          setError("Password must be at least 8 characters.");
          setSaving(false);
          return;
        }
        const { data, error: fnError } = await supabase.functions.invoke("provision-calling-app-admin-auth", {
          body: {
            companyId,
            username: username.trim(),
            displayName: displayName.trim(),
            password,
            email: email.trim() || undefined,
            employeeId: employeeId || undefined,
            isAdmin,
            canUpload,
            canDownload,
            dailyTarget,
          },
        });
        if (fnError) throw new Error(fnError.message);
        if (!data?.success) throw new Error(data?.error || "Could not create the Calling App account.");
        setCreated(`Login created — username "${username.trim()}", share the password you chose separately.`);
      }

      setEmployeeId("");
      setDisplayName("");
      setEmail("");
      setUsername("");
      setPassword("");
      setIsAdmin(false);
      setCanUpload(true);
      setCanDownload(true);
      setDailyTarget(0);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAdminField(admin: CallingAppAdmin, field: "is_admin" | "can_upload" | "can_download", value: boolean) {
    await updateCallingAppAdmin(admin.id, { [field]: value });
    refresh();
  }

  async function toggleStatus(admin: CallingAppAdmin) {
    await updateCallingAppAdmin(admin.id, { status: admin.status === "active" ? "disabled" : "active" });
    refresh();
  }

  async function handleRemove(id: string) {
    await removeCallingAppAdmin(id);
    refresh();
  }

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">📞 Calling App — Access Setup</h2>
        <p className="mt-1 text-sm text-slate-500">
          Control exactly who can open the Calling App — either through their existing LMS login, or with a completely separate username/password.
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {created && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✅ {created}</div>}

      <form onSubmit={handleCreate} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Access Type</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAccessType("lms")} className={`flex-1 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold ${accessType === "lms" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"}`}>
              Use their existing LMS login
            </button>
            <button type="button" onClick={() => setAccessType("dedicated")} className={`flex-1 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold ${accessType === "dedicated" ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"}`}>
              Create a separate login
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            {accessType === "lms" ? "Employee (required)" : "Link to an employee (optional — prefills name/email)"}
          </label>
          <select value={employeeId} onChange={(e) => handlePickEmployee(e.target.value)} className={INPUT_CLS}>
            <option value="">— Select employee —</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_code})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Display Name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email (optional)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLS} />
          </div>
        </div>

        {accessType === "dedicated" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={INPUT_CLS} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} /> Admin</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={canUpload} onChange={(e) => setCanUpload(e.target.checked)} /> Can Upload</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={canDownload} onChange={(e) => setCanDownload(e.target.checked)} /> Can Download</label>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Daily Target</label>
            <input type="number" min={0} value={dailyTarget} onChange={(e) => setDailyTarget(Math.max(0, parseInt(e.target.value, 10) || 0))} className={INPUT_CLS} />
          </div>
        </div>

        <button type="submit" disabled={saving} className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {saving ? "Saving…" : accessType === "lms" ? "Grant Access" : "Create Login"}
        </button>
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Current Access ({admins.length})</h3>
        {admins.length === 0 && <p className="text-xs text-slate-400">No one has Calling App access yet.</p>}
        {admins.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-slate-800">{a.display_name} {a.username && <span className="text-xs text-slate-400">({a.username})</span>}</p>
              <p className="text-xs text-slate-400">
                {a.employee_id ? "LMS login" : "Dedicated login"} · {a.status}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" checked={a.is_admin} onChange={(e) => toggleAdminField(a, "is_admin", e.target.checked)} /> Admin</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={a.can_upload} onChange={(e) => toggleAdminField(a, "can_upload", e.target.checked)} /> Upload</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={a.can_download} onChange={(e) => toggleAdminField(a, "can_download", e.target.checked)} /> Download</label>
              <button onClick={() => toggleStatus(a)} className="font-semibold text-amber-600 hover:underline">{a.status === "active" ? "Disable" : "Enable"}</button>
              <button onClick={() => handleRemove(a.id)} className="font-semibold text-red-500 hover:underline">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
