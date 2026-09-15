// src/components/performanceTracker/PerformanceTrackerLayout.tsx
//
// Performance Tracker's own dedicated space — a distinct top nav bar (not
// the usual sidebar-page chrome) reusing the SAME employee session as the
// rest of the app, gated by the performance_tracker company module (see
// supabase/migrations/20260914120000_performance_tracker_module.sql).

import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadCompanyModuleFlags } from '../../services/company/appModuleService';
import { useAuthorization } from '../../hooks/useAuthorization';
import { employeeService } from '../../services/employee/employeeService';
import { departmentService } from '../../services/department/departmentService';
import {
  loadTeams, loadSettings, loadCustomFields, loadEmployeeTeamMap, checkAndRunAutoReminders,
} from '../../services/performanceTracker/performanceTrackerService';
import type { Employee } from '../../types/employee';
import type { Department } from '../../types/department';
import type { PtTeam, PtSettings, PtCustomField } from '../../types/performanceTracker';
import {
  IconTrendingUp, IconSun, IconMoon, IconChartLine, IconTrophy, IconBarChart,
  IconUsers, IconBell, IconDocument, IconGear, IconLock, IconSpinner,
} from './ptIcons';
import { DashboardTab } from './DashboardTab';
import { MorningCommitTab } from './MorningCommitTab';
import { EveningReportTab } from './EveningReportTab';
import { TrendsTab } from './TrendsTab';
import { LeaderboardTab } from './LeaderboardTab';
import { AnalyticsTab } from './AnalyticsTab';
import { TeamViewTab } from './TeamViewTab';
import { AlertsTab } from './AlertsTab';
import { ReportsTab } from './ReportsTab';
import { SettingsTab } from './SettingsTab';

type TabKey = 'dashboard' | 'morning' | 'evening' | 'trends' | 'leaderboard' | 'analytics' | 'team' | 'alerts' | 'reports' | 'settings';

function GateScreen({ state }: { state: 'checking' | 'locked' }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      {state === 'checking' ? (
        <IconSpinner className="h-6 w-6 text-emerald-500" />
      ) : (
        <div className="max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
            <IconLock className="h-6 w-6 text-amber-500" />
          </div>
          <h3 className="font-semibold text-slate-900">Performance Tracker is a premium add-on</h3>
          <p className="text-sm text-slate-600">
            This daily sales-activity commitment &amp; scoring module isn't included in your current plan.
            Ask your Super Admin to enable it.
          </p>
        </div>
      )}
    </div>
  );
}

function PerformanceTrackerLayout() {
  const user = getCurrentUser();
  const { can, PERMISSIONS } = useAuthorization();
  const [gate, setGate] = useState<'checking' | 'ok' | 'locked'>('checking');
  const [tab, setTab] = useState<TabKey>('dashboard');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<PtTeam[]>([]);
  const [settings, setSettings] = useState<PtSettings | null>(null);
  const [customFields, setCustomFields] = useState<PtCustomField[]>([]);
  const [teamMap, setTeamMap] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.companyId) return;
    setLoading(true);
    try {
      const [emps, depts, tms, sett, cfs, tmap] = await Promise.all([
        employeeService.getAll(),
        departmentService.getAll(),
        loadTeams(user.companyId),
        loadSettings(user.companyId),
        loadCustomFields(user.companyId),
        loadEmployeeTeamMap(user.companyId),
      ]);
      setEmployees(emps);
      setDepartments(depts);
      setTeams(tms);
      setSettings(sett);
      setCustomFields(cfs);
      setTeamMap(tmap);

      // Fire-and-forget: the entire "automatic" mechanism, since this app
      // has no server-side cron — see checkAndRunAutoReminders' own
      // comment. Never blocks the UI and never surfaces an error to the
      // user; it's a background nicety, not a page dependency.
      if (user.id) checkAndRunAutoReminders(user.companyId, user.id, emps).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [user?.companyId]);

  useEffect(() => {
    if (!user?.companyId) { setGate('locked'); return; }
    loadCompanyModuleFlags(user.companyId)
      .then((flags) => setGate(flags.performance_tracker !== false ? 'ok' : 'locked'))
      .catch(() => setGate('locked'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyId]);

  useEffect(() => { if (gate === 'ok') load(); }, [gate, load]);

  if (!user) return null;
  if (gate !== 'ok') return <GateScreen state={gate === 'checking' ? 'checking' : 'locked'} />;
  if (loading || !settings) return <GateScreen state="checking" />;

  const isManagerUp = can(PERMISSIONS.VIEW_REPORTS);
  const isAdmin = can(PERMISSIONS.VIEW_SETTINGS);

  const TABS: { key: TabKey; label: string; icon: typeof IconTrendingUp; show: boolean }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: IconTrendingUp, show: true },
    { key: 'morning', label: 'Morning Commit', icon: IconSun, show: true },
    { key: 'evening', label: 'Evening Report', icon: IconMoon, show: true },
    { key: 'trends', label: 'Trends', icon: IconChartLine, show: true },
    { key: 'leaderboard', label: 'Leaderboard', icon: IconTrophy, show: true },
    { key: 'analytics', label: 'Analytics', icon: IconBarChart, show: isManagerUp },
    { key: 'team', label: 'Team View', icon: IconUsers, show: isManagerUp },
    { key: 'alerts', label: 'Alerts', icon: IconBell, show: isManagerUp },
    { key: 'reports', label: 'Reports', icon: IconDocument, show: isManagerUp },
    { key: 'settings', label: 'Settings', icon: IconGear, show: isAdmin },
  ];

  return (
    // min-w-0 stops the tab bar's un-shrinking content (flex-shrink-0 +
    // whitespace-nowrap on each tab) from propagating its natural width up
    // through AppLayout's flex chain — without it, every ancestor flex
    // container grows to fit the widest descendant instead of honoring
    // the real viewport, and this subtree's own overflow-x-auto never
    // gets a chance to kick in. Classic flexbox min-width:auto gotcha.
    <div className="-m-8 min-h-screen min-w-0 bg-slate-50">
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <IconTrendingUp className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-base font-bold text-white">Performance Tracker</h1>
            <p className="text-xs text-slate-500">Daily commitment, scoring &amp; team performance</p>
          </div>
        </div>
        <div className="mx-auto mt-4 flex max-w-7xl gap-1 overflow-x-auto">
          {TABS.filter((t) => t.show).map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3.5 py-2 text-sm font-medium transition ${
                  active ? 'bg-slate-50 text-slate-900' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {tab === 'dashboard' && <DashboardTab employees={employees} departments={departments} isManagerUp={isManagerUp} />}
        {tab === 'morning' && <MorningCommitTab employees={employees} customFields={customFields} isManagerUp={isManagerUp} settings={settings} />}
        {tab === 'evening' && <EveningReportTab settings={settings} customFields={customFields} />}
        {tab === 'trends' && <TrendsTab employees={employees} teams={teams} teamMap={teamMap} isManagerUp={isManagerUp} />}
        {tab === 'leaderboard' && <LeaderboardTab employees={employees} teams={teams} teamMap={teamMap} settings={settings} isManagerUp={isManagerUp} />}
        {tab === 'analytics' && isManagerUp && <AnalyticsTab employees={employees} departments={departments} />}
        {tab === 'team' && isManagerUp && <TeamViewTab employees={employees} teams={teams} teamMap={teamMap} />}
        {tab === 'alerts' && isManagerUp && <AlertsTab employees={employees} settings={settings} />}
        {tab === 'reports' && isManagerUp && <ReportsTab employees={employees} teams={teams} teamMap={teamMap} departments={departments} />}
        {tab === 'settings' && isAdmin && (
          <SettingsTab
            settings={settings} onSettingsChange={setSettings}
            teams={teams} onTeamsChange={setTeams}
            customFields={customFields} onCustomFieldsChange={setCustomFields}
            employees={employees} teamMap={teamMap} onTeamMapChange={setTeamMap}
          />
        )}
      </div>
    </div>
  );
}

export default PerformanceTrackerLayout;
