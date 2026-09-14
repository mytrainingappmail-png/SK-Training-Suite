// src/components/performanceTracker/TeamViewTab.tsx
//
// Roster grouped by sales team, with today's commit/report status per
// person — a manager's daily "who's on track" screen.

import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadCommitmentsForDate, loadReportsForDate, todayStr } from '../../services/performanceTracker/performanceTrackerService';
import type { Employee } from '../../types/employee';
import type { PtTeam, PtCommitment, PtReport } from '../../types/performanceTracker';
import { Card, Badge, LoadingBlock, employeeName } from './ptUi';
import { IconCheck, IconClock, IconUsers } from './ptIcons';

export function TeamViewTab({ employees, teams, teamMap }: {
  employees: Employee[]; teams: PtTeam[]; teamMap: Record<string, string | null>;
}) {
  const user = getCurrentUser();
  const today = todayStr();
  const [loading, setLoading] = useState(true);
  const [commitments, setCommitments] = useState<PtCommitment[]>([]);
  const [reports, setReports] = useState<PtReport[]>([]);

  useEffect(() => {
    if (!user?.companyId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([loadCommitmentsForDate(user.companyId, today), loadReportsForDate(user.companyId, today)])
      .then(([c, r]) => { if (!cancelled) { setCommitments(c); setReports(r); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.companyId, today]);

  if (loading) return <LoadingBlock />;

  const submittedIds = new Set(commitments.map((c) => c.employee_id));
  const reportedIds = new Set(reports.map((r) => r.employee_id));
  const active = employees.filter((e) => e.active);
  const groups = [...teams.map((t) => ({ id: t.id, name: t.name, members: active.filter((e) => teamMap[e.id] === t.id) })),
    { id: null, name: 'Unassigned', members: active.filter((e) => !teamMap[e.id]) }]
    .filter((g) => g.members.length > 0);

  return (
    <div className="space-y-4">
      {groups.length === 0 && (
        <Card className="p-8 text-center text-sm text-slate-500">No active employees found.</Card>
      )}
      {groups.map((g) => {
        const submitted = g.members.filter((e) => submittedIds.has(e.id)).length;
        return (
          <Card key={g.id ?? 'unassigned'} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><IconUsers className="h-4 w-4 text-emerald-500" />{g.name}</span>
              <Badge tone={submitted === g.members.length ? 'active' : 'pending'}>{submitted}/{g.members.length} submitted today</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-2 font-medium">Employee</th>
                    <th className="px-4 py-2 font-medium">Morning Commit</th>
                    <th className="px-4 py-2 font-medium">Evening Report</th>
                    <th className="px-4 py-2 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {g.members.map((e) => {
                    const rep = reports.find((r) => r.employee_id === e.id);
                    return (
                      <tr key={e.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2 font-medium text-slate-900">{employeeName(e)}</td>
                        <td className="px-4 py-2">{submittedIds.has(e.id) ? <Badge tone="active"><IconCheck className="h-2.5 w-2.5" />Submitted</Badge> : <Badge tone="pending"><IconClock className="h-2.5 w-2.5" />Pending</Badge>}</td>
                        <td className="px-4 py-2">{reportedIds.has(e.id) ? <Badge tone="active">Submitted</Badge> : <Badge tone="pending">Pending</Badge>}</td>
                        <td className="px-4 py-2 font-mono text-slate-700">{rep?.score != null ? Math.round(rep.score) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
