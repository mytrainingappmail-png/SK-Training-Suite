import { useMemo } from "react";
import type { CallingAppAdmin, CallingAppContact, CallingAppCallLog, CallingAppDisposition } from "../../types/callingApp";

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm" style={{ borderTopWidth: 3, borderTopColor: accent }}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color: accent }}>{value}</p>
    </div>
  );
}

export function CallingAppDashboardTab({
  admin,
  contacts,
  callLogs,
  dispositions,
  teamAdmins,
  scopeAdminIds,
}: {
  admin: CallingAppAdmin;
  contacts: CallingAppContact[];
  callLogs: CallingAppCallLog[];
  dispositions: CallingAppDisposition[];
  teamAdmins: CallingAppAdmin[];
  scopeAdminIds: Set<string>;
}) {
  const isTeamView = scopeAdminIds.size > 1;
  const myLogsToday = useMemo(() => callLogs.filter((l) => l.admin_id === admin.id && isToday(l.called_at)), [callLogs, admin.id]);
  const myContacts = admin.is_admin ? contacts : contacts.filter((c) => c.assigned_to && scopeAdminIds.has(c.assigned_to));

  const dispositionById = useMemo(() => new Map(dispositions.map((d) => [d.id, d])), [dispositions]);
  const myPositiveToday = myLogsToday.filter((l) => l.disposition_id && dispositionById.get(l.disposition_id)?.outcome_type === "positive").length;

  const target = admin.daily_target;
  const progressPct = target > 0 ? Math.min(100, Math.round((myLogsToday.length / target) * 100)) : 0;

  const leaderboard = useMemo(() => {
    if (!isTeamView) return [];
    const countByAdmin = new Map<string, number>();
    callLogs.filter((l) => isToday(l.called_at)).forEach((l) => countByAdmin.set(l.admin_id, (countByAdmin.get(l.admin_id) ?? 0) + 1));
    return teamAdmins
      .filter((a) => scopeAdminIds.has(a.id))
      .map((a) => ({ admin: a, calls: countByAdmin.get(a.id) ?? 0 }))
      .filter((r) => r.calls > 0)
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);
  }, [isTeamView, callLogs, teamAdmins, scopeAdminIds]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Calls Today" value={myLogsToday.length} accent="#6366f1" />
        <StatCard label="Positive Outcomes" value={myPositiveToday} accent="#10b981" />
        <StatCard label={isTeamView ? "Team Contacts" : "My Contacts"} value={myContacts.length} accent="#a855f7" />
        <StatCard label="Pending Follow-ups" value={myContacts.filter((c) => c.next_call_at && new Date(c.next_call_at) <= new Date()).length} accent="#f59e0b" />
      </div>

      {target > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">Today's Target</span>
            <span className="text-slate-600">{myLogsToday.length} / {target} calls</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {isTeamView && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">🏆 Today's Leaderboard</p>
          {leaderboard.length === 0 ? (
            <p className="text-xs text-slate-600">No calls logged yet today.</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((row, i) => (
                <div key={row.admin.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
                  <span className="font-medium text-slate-700">#{i + 1} {row.admin.display_name}</span>
                  <span className="font-bold text-indigo-600">{row.calls} calls</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
