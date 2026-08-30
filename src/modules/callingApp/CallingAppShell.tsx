// Shared tab container for the Calling App — used by BOTH entry points
// (the standalone /calling-app/* dedicated-login route, and the
// embedded route reached via the LMS Sidebar for someone using their
// existing employee login). Which `client` is passed in is the only
// thing that differs between the two; everything else here is identical.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import * as dataRepo from "../../repositories/callingApp/callingAppDataRepository";
import type {
  CallingAppAdmin,
  CallingAppDisposition,
  CallingAppCustomFieldDef,
  CallingAppContact,
  CallingAppCallLog,
  CallingAppHandoff,
  CallingAppBreak,
} from "../../types/callingApp";

import { CallingAppDashboardTab } from "./CallingAppDashboardTab";
import { CallingAppSheetTab } from "./CallingAppSheetTab";
import { CallingAppMasterSheetTab } from "./CallingAppMasterSheetTab";
import { CallingAppProspectsTab } from "./CallingAppProspectsTab";
import { CallingAppBreaksTab } from "./CallingAppBreaksTab";
import { CallingAppReportsTab } from "./CallingAppReportsTab";
import { CallingAppSettingsTab } from "./CallingAppSettingsTab";

export interface CallingAppIdentity {
  admin: CallingAppAdmin;
  client: SupabaseClient;
}

type TabKey = "dashboard" | "sheet" | "master-sheet" | "prospects" | "breaks" | "reports" | "settings";

const TABS: { key: TabKey; label: string; icon: string; adminOnly?: boolean }[] = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "sheet", label: "Calling Sheet", icon: "📞" },
  { key: "master-sheet", label: "Master Sheet", icon: "🗂️", adminOnly: true },
  { key: "prospects", label: "Prospects", icon: "🎯" },
  { key: "breaks", label: "Breaks", icon: "☕" },
  { key: "reports", label: "Reports", icon: "📈" },
  { key: "settings", label: "Settings", icon: "⚙️", adminOnly: true },
];

export function CallingAppShell({ identity }: { identity: CallingAppIdentity }) {
  const { admin, client } = identity;
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [dispositions, setDispositions] = useState<CallingAppDisposition[]>([]);
  const [fieldDefs, setFieldDefs] = useState<CallingAppCustomFieldDef[]>([]);
  const [contacts, setContacts] = useState<CallingAppContact[]>([]);
  const [callLogs, setCallLogs] = useState<CallingAppCallLog[]>([]);
  const [teamAdmins, setTeamAdmins] = useState<CallingAppAdmin[]>([]);
  const [handoffs, setHandoffs] = useState<CallingAppHandoff[]>([]);
  const [breaks, setBreaks] = useState<CallingAppBreak[]>([]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [disps, defs, cts, logs, hos, brks] = await Promise.all([
        dataRepo.listDispositions(client, admin.company_id),
        dataRepo.listCustomFieldDefs(client, admin.company_id),
        dataRepo.listContacts(client, admin.company_id),
        dataRepo.listCallLogs(client, admin.company_id),
        dataRepo.listHandoffs(client, admin.company_id),
        dataRepo.listBreaks(client, admin.company_id),
      ]);
      setDispositions(disps);
      setFieldDefs(defs);
      setContacts(cts);
      setCallLogs(logs);
      setHandoffs(hos);
      setBreaks(brks);

      // Agent names for the leaderboard/assignment — client-side visible
      // list is already scoped by calling_app_admins_select RLS (any
      // active admin can see the company's own list).
      const { data: admins } = await client.from("calling_app_admins").select("*").eq("company_id", admin.company_id);
      setTeamAdmins(admins ?? []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load Calling App data.", false);
    } finally {
      setLoading(false);
    }
  }, [client, admin.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  // Team Leaders/Sales Heads see their reports' numbers, not just their
  // own — RLS already enforces this at the DB level (see
  // current_calling_app_report_scope_admin_ids); this mirrors the same
  // logic so the UI narrows consistently for Dashboard/Reports/Sheet.
  const scopeAdminIds = useMemo(() => dataRepo.computeReportScopeAdminIds(admin, teamAdmins), [admin, teamAdmins]);

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-sm text-slate-400">Loading Calling App…</div>;
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.filter((t) => !t.adminOnly || admin.is_admin).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-medium transition ${
              tab === t.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {toast && (
        <div className={`fixed top-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${
          toast.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
        }`}>
          {toast.msg}
        </div>
      )}

      {tab === "dashboard" && (
        <CallingAppDashboardTab admin={admin} contacts={contacts} callLogs={callLogs} dispositions={dispositions} teamAdmins={teamAdmins} scopeAdminIds={scopeAdminIds} />
      )}
      {tab === "sheet" && (
        <CallingAppSheetTab identity={identity} contacts={contacts} dispositions={dispositions} fieldDefs={fieldDefs} teamAdmins={teamAdmins} onChanged={load} showToast={showToast} />
      )}
      {tab === "master-sheet" && admin.is_admin && (
        <CallingAppMasterSheetTab identity={identity} contacts={contacts} fieldDefs={fieldDefs} teamAdmins={teamAdmins} onChanged={load} showToast={showToast} />
      )}
      {tab === "prospects" && (
        <CallingAppProspectsTab identity={identity} contacts={contacts} handoffs={handoffs} teamAdmins={teamAdmins} scopeAdminIds={scopeAdminIds} onChanged={load} showToast={showToast} />
      )}
      {tab === "breaks" && (
        <CallingAppBreaksTab identity={identity} breaks={breaks} teamAdmins={teamAdmins} scopeAdminIds={scopeAdminIds} onChanged={load} showToast={showToast} />
      )}
      {tab === "reports" && (
        <CallingAppReportsTab contacts={contacts} callLogs={callLogs} dispositions={dispositions} teamAdmins={teamAdmins} scopeAdminIds={scopeAdminIds} />
      )}
      {tab === "settings" && admin.is_admin && (
        <CallingAppSettingsTab identity={identity} dispositions={dispositions} fieldDefs={fieldDefs} onChanged={load} showToast={showToast} />
      )}
    </div>
  );
}
