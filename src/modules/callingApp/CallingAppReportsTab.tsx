import { useMemo } from "react";
import type { CallingAppAdmin, CallingAppContact, CallingAppCallLog, CallingAppDisposition } from "../../types/callingApp";

export function CallingAppReportsTab({
  contacts,
  callLogs,
  dispositions,
  teamAdmins,
  scopeAdminIds,
}: {
  contacts: CallingAppContact[];
  callLogs: CallingAppCallLog[];
  dispositions: CallingAppDisposition[];
  teamAdmins: CallingAppAdmin[];
  scopeAdminIds: Set<string>;
}) {
  const dispositionById = useMemo(() => new Map(dispositions.map((d) => [d.id, d])), [dispositions]);

  const scope = teamAdmins.filter((a) => scopeAdminIds.has(a.id));

  const rows = useMemo(() => {
    return scope.map((a) => {
      const logs = callLogs.filter((l) => l.admin_id === a.id);
      const positive = logs.filter((l) => l.disposition_id && dispositionById.get(l.disposition_id)?.outcome_type === "positive").length;
      const negative = logs.filter((l) => l.disposition_id && dispositionById.get(l.disposition_id)?.outcome_type === "negative").length;
      const total = logs.length;
      const qualityScore = total > 0 ? Math.round((positive / total) * 100) : 0;
      const assignedContacts = contacts.filter((c) => c.assigned_to === a.id).length;
      return { admin: a, totalCalls: total, positive, negative, qualityScore, assignedContacts };
    }).sort((x, y) => y.totalCalls - x.totalCalls);
  }, [scope, callLogs, contacts, dispositionById]);

  const dispositionBreakdown = useMemo(() => {
    const relevantLogs = callLogs.filter((l) => scopeAdminIds.has(l.admin_id));
    const counts = new Map<string, number>();
    relevantLogs.forEach((l) => {
      const key = l.disposition_id ?? "none";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([id, count]) => ({ label: id === "none" ? "No outcome" : dispositionById.get(id)?.label ?? "Unknown", color: id === "none" ? "#94a3b8" : dispositionById.get(id)?.color ?? "#64748b", count }))
      .sort((a, b) => b.count - a.count);
  }, [scopeAdminIds, callLogs, dispositionById]);

  const maxBreakdown = Math.max(...dispositionBreakdown.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3 text-right">Total Calls</th>
              <th className="px-4 py-3 text-right">Positive</th>
              <th className="px-4 py-3 text-right">Negative</th>
              <th className="px-4 py-3 text-right">Quality Score</th>
              <th className="px-4 py-3 text-right">Assigned Contacts</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-600">No call activity yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.admin.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-800">{r.admin.display_name}</td>
                <td className="px-4 py-3 text-right text-slate-600">{r.totalCalls}</td>
                <td className="px-4 py-3 text-right text-emerald-600">{r.positive}</td>
                <td className="px-4 py-3 text-right text-rose-500">{r.negative}</td>
                <td className="px-4 py-3 text-right font-bold text-indigo-600">{r.qualityScore}%</td>
                <td className="px-4 py-3 text-right text-slate-600">{r.assignedContacts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-900">Disposition Breakdown</p>
        {dispositionBreakdown.length === 0 ? (
          <p className="text-xs text-slate-600">No calls logged yet.</p>
        ) : (
          <div className="space-y-2">
            {dispositionBreakdown.map((d) => (
              <div key={d.label}>
                <div className="mb-0.5 flex justify-between text-xs text-slate-600"><span>{d.label}</span><span>{d.count}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${(d.count / maxBreakdown) * 100}%`, backgroundColor: d.color }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
