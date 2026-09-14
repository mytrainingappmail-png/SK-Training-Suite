// src/components/performanceTracker/DashboardTab.tsx

import { useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadCommitmentsForDate, loadReportsForDate, todayStr } from '../../services/performanceTracker/performanceTrackerService';
import type { Employee } from '../../types/employee';
import type { Department } from '../../types/department';
import type { PtCommitment, PtReport } from '../../types/performanceTracker';
import { Card, Badge, SelectField, LoadingBlock, employeeName } from './ptUi';
import { IconUsers, IconClock, IconTrendingUp, IconCheck } from './ptIcons';

const TONE_CLS: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-600 border-t-emerald-400',
  amber: 'bg-amber-50 text-amber-600 border-t-amber-400',
  sky: 'bg-sky-50 text-sky-600 border-t-sky-400',
};

export function DashboardTab({ employees, departments, isManagerUp }: {
  employees: Employee[]; departments: Department[]; isManagerUp: boolean;
}) {
  const user = getCurrentUser();
  const today = todayStr();
  const [loading, setLoading] = useState(true);
  const [commitments, setCommitments] = useState<PtCommitment[]>([]);
  const [reports, setReports] = useState<PtReport[]>([]);
  const [deptFilter, setDeptFilter] = useState('');

  useEffect(() => {
    if (!user?.companyId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([loadCommitmentsForDate(user.companyId, today), loadReportsForDate(user.companyId, today)])
      .then(([c, r]) => { if (!cancelled) { setCommitments(c); setReports(r); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.companyId, today]);

  const activeEmployees = useMemo(() => employees.filter((e) => e.active), [employees]);
  const scope = useMemo(() => {
    const base = isManagerUp ? activeEmployees : activeEmployees.filter((e) => e.id === user?.id);
    return deptFilter ? base.filter((e) => e.department_id === deptFilter) : base;
  }, [activeEmployees, isManagerUp, user?.id, deptFilter]);

  if (loading) return <LoadingBlock />;

  const submittedIds = new Set(commitments.map((c) => c.employee_id));
  const submitted = scope.filter((e) => submittedIds.has(e.id)).length;
  const pending = scope.length - submitted;
  const reportedIds = new Set(reports.map((r) => r.employee_id));

  const deptChart = (() => {
    const byDept = new Map<string, number[]>();
    for (const e of scope) {
      const rep = reports.find((r) => r.employee_id === e.id);
      if (!rep || rep.achievement_pct == null) continue;
      const dname = departments.find((d) => d.id === e.department_id)?.department_name ?? 'Unassigned';
      if (!byDept.has(dname)) byDept.set(dname, []);
      byDept.get(dname)!.push(rep.achievement_pct);
    }
    return Array.from(byDept.entries()).map(([label, vals]) => ({
      label, value: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
    }));
  })();
  const deptMax = Math.max(...deptChart.map((d) => d.value), 1);

  const kpiCards = [
    { label: 'Morning Commit — Submitted', value: submitted, sub: `of ${scope.length}${isManagerUp ? ' active employees' : ''}`, icon: IconUsers, tone: 'emerald' },
    { label: 'Pending', value: pending, sub: "haven't submitted today", icon: IconClock, tone: 'amber' },
    { label: 'Evening Reports In', value: scope.filter((e) => reportedIds.has(e.id)).length, sub: `of ${scope.length}`, icon: IconTrendingUp, tone: 'sky' },
  ];

  return (
    <div className="space-y-4">
      {isManagerUp && departments.length > 0 && (
        <div className="w-56"><SelectField label="" value={deptFilter} onChange={setDeptFilter} options={[{ value: '', label: 'All Departments' }, ...departments.map((d) => ({ value: d.id, label: d.department_name }))]} /></div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {kpiCards.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className={`border-t-4 p-4 ${TONE_CLS[k.tone]}`}>
              <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${TONE_CLS[k.tone]}`}><Icon className="h-4 w-4" /></div>
              <p className="mb-1 text-xs text-slate-600">{k.label}</p>
              <p className="font-mono text-2xl font-bold text-slate-900">{k.value}</p>
              <p className="mt-1 text-xs text-slate-500">{k.sub}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-5">
        <p className="mb-3 text-sm font-semibold text-slate-900">Department-wise Achievement — Today</p>
        {deptChart.length > 0 ? (
          <div className="space-y-2.5">
            {deptChart.map((d) => (
              <div key={d.label} className="flex items-center gap-3">
                <span className="w-32 flex-shrink-0 truncate text-xs text-slate-600">{d.label}</span>
                <div className="h-2.5 flex-1 rounded-full bg-slate-100">
                  <div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${Math.max(4, (d.value / deptMax) * 100)}%` }} />
                </div>
                <span className="w-14 flex-shrink-0 text-right font-mono text-xs font-semibold text-slate-700">{d.value}%</span>
              </div>
            ))}
          </div>
        ) : <p className="py-10 text-center text-xs text-slate-500">No evening reports submitted yet today.</p>}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
          {isManagerUp ? 'Team Status — Today' : 'Your Status — Today'}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium">Morning Commit</th>
                <th className="px-4 py-2 font-medium">Evening Report</th>
                <th className="px-4 py-2 font-medium">Score</th>
                <th className="px-4 py-2 font-medium">Achievement</th>
              </tr>
            </thead>
            <tbody>
              {scope.map((e) => {
                const rep = reports.find((r) => r.employee_id === e.id);
                return (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-900">{employeeName(e)}</td>
                    <td className="px-4 py-2">{submittedIds.has(e.id) ? <Badge tone="active"><IconCheck className="h-2.5 w-2.5" />Submitted</Badge> : <Badge tone="pending"><IconClock className="h-2.5 w-2.5" />Not submitted</Badge>}</td>
                    <td className="px-4 py-2">{reportedIds.has(e.id) ? <Badge tone="active">Submitted</Badge> : <Badge tone="pending">Not submitted</Badge>}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{rep?.score != null ? Math.round(rep.score) : '—'}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{rep?.achievement_pct != null ? `${rep.achievement_pct}%` : '—'}</td>
                  </tr>
                );
              })}
              {scope.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No active employees in scope.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {!isManagerUp && submitted === 0 && (
        <Card className="flex items-center gap-3 border-emerald-100 bg-emerald-50 p-4">
          <IconTrendingUp className="h-4.5 w-4.5 flex-shrink-0 text-emerald-600" />
          <p className="text-sm text-emerald-800">You haven't submitted today's Morning Commitment yet — head to the "Morning Commit" tab.</p>
        </Card>
      )}
    </div>
  );
}
