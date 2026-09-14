// src/components/performanceTracker/SettingsTab.tsx
//
// Admin configuration: minimum criteria, scoring weights, leaderboard
// formula, reminder copy, sales teams (+ team leads), custom KPI fields,
// and champion category labels. Nothing here is hardcoded elsewhere in the
// module — every number, label, and message an admin might want to change
// lives on this one screen.

import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import {
  saveSettings, saveTeam, removeTeam, editTeam, assignEmployeeTeam,
  saveCustomField, removeCustomField,
  loadChampionCategories, editChampionCategory,
} from '../../services/performanceTracker/performanceTrackerService';
import type { Employee } from '../../types/employee';
import type { PtSettings, PtTeam, PtCustomField, PtLeaderboardFormula, PtChampionCategory } from '../../types/performanceTracker';
import { Card, SelectField, NumField, ptInputCls, employeeName } from './ptUi';

const FORMULA_OPTIONS: { value: PtLeaderboardFormula; label: string }[] = [
  { value: 'achievement', label: 'Achievement % (Recommended)' },
  { value: 'score', label: 'Total Score Points' },
  { value: 'bookings', label: 'Bookings Generated' },
  { value: 'composite', label: 'Composite (60% Achievement + 40% Score)' },
];

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function SettingsTab({
  settings, onSettingsChange, teams, onTeamsChange, customFields, onCustomFieldsChange, employees, teamMap, onTeamMapChange,
}: {
  settings: PtSettings; onSettingsChange: (s: PtSettings) => void;
  teams: PtTeam[]; onTeamsChange: (t: PtTeam[]) => void;
  customFields: PtCustomField[]; onCustomFieldsChange: (f: PtCustomField[]) => void;
  employees: Employee[];
  teamMap: Record<string, string | null>; onTeamMapChange: (m: Record<string, string | null>) => void;
}) {
  const user = getCurrentUser();
  const [draft, setDraft] = useState(settings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [toast, setToast] = useState('');

  const [newTeamName, setNewTeamName] = useState('');
  const [savingTeam, setSavingTeam] = useState(false);

  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldMorning, setNewFieldMorning] = useState(true);
  const [newFieldEvening, setNewFieldEvening] = useState(true);
  const [savingField, setSavingField] = useState(false);

  const [categories, setCategories] = useState<PtChampionCategory[]>([]);

  useEffect(() => { setDraft(settings); }, [settings]);
  useEffect(() => {
    if (!user?.companyId) return;
    loadChampionCategories(user.companyId).then(setCategories).catch(() => {});
  }, [user?.companyId]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  async function handleSaveSettings() {
    if (!user?.companyId) return;
    setSavingSettings(true);
    try {
      const saved = await saveSettings(user.companyId, draft);
      onSettingsChange(saved);
      showToast('Settings saved.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleAddTeam() {
    if (!user?.companyId || !newTeamName.trim()) return;
    setSavingTeam(true);
    try {
      const t = await saveTeam(user.companyId, newTeamName, null);
      onTeamsChange([...teams, t].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTeamName('');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to add team.');
    } finally {
      setSavingTeam(false);
    }
  }

  async function handleDeleteTeam(id: string) {
    try {
      await removeTeam(id);
      onTeamsChange(teams.filter((t) => t.id !== id));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to delete team.');
    }
  }

  async function handleSetTeamLeader(teamId: string, leaderId: string) {
    try {
      await editTeam(teamId, { team_leader_employee_id: leaderId || null });
      onTeamsChange(teams.map((t) => (t.id === teamId ? { ...t, team_leader_employee_id: leaderId || null } : t)));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to set team leader.');
    }
  }

  async function handleAssignTeam(employeeId: string, teamId: string) {
    try {
      await assignEmployeeTeam(employeeId, teamId || null);
      onTeamMapChange({ ...teamMap, [employeeId]: teamId || null });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to assign team.');
    }
  }

  async function handleAddField() {
    if (!user?.companyId || !newFieldLabel.trim()) return;
    setSavingField(true);
    try {
      const f = await saveCustomField(user.companyId, {
        field_key: newFieldLabel, label: newFieldLabel, applies_morning: newFieldMorning, applies_evening: newFieldEvening,
      });
      onCustomFieldsChange([...customFields, f]);
      setNewFieldLabel('');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to add field.');
    } finally {
      setSavingField(false);
    }
  }

  async function handleDeleteField(id: string) {
    try {
      await removeCustomField(id);
      onCustomFieldsChange(customFields.filter((f) => f.id !== id));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to remove field.');
    }
  }

  async function handleToggleCategory(id: string, is_active: boolean) {
    await editChampionCategory(id, { is_active });
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, is_active } : c)));
  }

  async function handleRenameCategory(id: string, label: string) {
    await editChampionCategory(id, { label });
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, label } : c)));
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Minimum Daily Criteria" subtitle="An evening report only counts as 'criteria met' once every threshold below is reached.">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <NumField label="Min F2F" value={draft.min_f2f} onChange={(v) => setDraft((d) => ({ ...d, min_f2f: v }))} />
          <NumField label="Min Site Visits" value={draft.min_sv} onChange={(v) => setDraft((d) => ({ ...d, min_sv: v }))} />
          <NumField label="Min Revisits" value={draft.min_revisit} onChange={(v) => setDraft((d) => ({ ...d, min_revisit: v }))} />
          <NumField label="Min Calls" value={draft.min_calls} onChange={(v) => setDraft((d) => ({ ...d, min_calls: v }))} />
          <NumField label="Min Connected" value={draft.min_conn} onChange={(v) => setDraft((d) => ({ ...d, min_conn: v }))} />
          <NumField label="Min Talk (mins)" value={draft.min_talk} onChange={(v) => setDraft((d) => ({ ...d, min_talk: v }))} />
        </div>
      </SectionCard>

      <SectionCard title="Scoring Weights" subtitle="Points awarded per unit of each activity — used to compute the daily Score.">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <NumField label="Points / F2F" value={draft.score_f2f} onChange={(v) => setDraft((d) => ({ ...d, score_f2f: v }))} />
          <NumField label="Points / Site Visit" value={draft.score_sv} onChange={(v) => setDraft((d) => ({ ...d, score_sv: v }))} />
          <NumField label="Points / Revisit" value={draft.score_revisit} onChange={(v) => setDraft((d) => ({ ...d, score_revisit: v }))} />
          <NumField label="Points / Booking" value={draft.score_booking} onChange={(v) => setDraft((d) => ({ ...d, score_booking: v }))} />
          <NumField label="Points / Connected Call" value={draft.score_conn} onChange={(v) => setDraft((d) => ({ ...d, score_conn: v }))} />
          <NumField label="Points / 5 min Talk" value={draft.score_talk_per5} onChange={(v) => setDraft((d) => ({ ...d, score_talk_per5: v }))} />
        </div>
      </SectionCard>

      <SectionCard title="Leaderboard">
        <div className="w-72"><SelectField label="Default Ranking Formula" value={draft.leaderboard_formula} onChange={(v) => setDraft((d) => ({ ...d, leaderboard_formula: v }))} options={FORMULA_OPTIONS} /></div>
      </SectionCard>

      <SectionCard title="Reminder Messages" subtitle="Shown to an employee when a manager sends a reminder from Morning Commit or Alerts — edit the wording to match your team's tone.">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Morning Reminder — Title</label>
              <input value={draft.morning_reminder_title} onChange={(e) => setDraft((d) => ({ ...d, morning_reminder_title: e.target.value }))} className={ptInputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Evening Reminder — Title</label>
              <input value={draft.evening_reminder_title} onChange={(e) => setDraft((d) => ({ ...d, evening_reminder_title: e.target.value }))} className={ptInputCls} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Morning Reminder — Message</label>
              <textarea value={draft.morning_reminder_message} onChange={(e) => setDraft((d) => ({ ...d, morning_reminder_message: e.target.value }))} rows={2} className={`resize-none ${ptInputCls}`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Evening Reminder — Message</label>
              <textarea value={draft.evening_reminder_message} onChange={(e) => setDraft((d) => ({ ...d, evening_reminder_message: e.target.value }))} rows={2} className={`resize-none ${ptInputCls}`} />
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="flex items-center gap-3">
        <button onClick={handleSaveSettings} disabled={savingSettings} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {savingSettings ? 'Saving…' : 'Save Settings'}
        </button>
        {toast && <span className="text-sm text-slate-600">{toast}</span>}
      </div>

      <SectionCard title="Sales Teams" subtitle="Group employees into teams for the Leaderboard and Team View — independent of Department. Each team can have a Team Leader.">
        <div className="mb-3 flex gap-2">
          <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="New team name…" className={ptInputCls} />
          <button onClick={handleAddTeam} disabled={savingTeam || !newTeamName.trim()} className="flex-shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">Add Team</button>
        </div>
        {teams.length > 0 && (
          <div className="mb-4 space-y-1.5">
            {teams.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                <span className="font-medium text-slate-800">{t.name}</span>
                <div className="ml-auto flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-600">Team Leader</label>
                  <select value={t.team_leader_employee_id ?? ''} onChange={(e) => handleSetTeamLeader(t.id, e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                    <option value="">Not set</option>
                    {employees.filter((e) => e.active && teamMap[e.id] === t.id).map((e) => <option key={e.id} value={e.id}>{employeeName(e)}</option>)}
                  </select>
                  <button onClick={() => handleDeleteTeam(t.id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mb-2 text-xs font-semibold text-slate-600">Assign employees to a team</p>
        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {employees.filter((e) => e.active).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
              <span className="text-sm text-slate-800">{employeeName(e)}</span>
              <select value={teamMap[e.id] ?? ''} onChange={(ev) => handleAssignTeam(e.id, ev.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                <option value="">No team</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Custom KPI Fields" subtitle="Extra numeric fields to collect on the Morning/Evening forms — not counted toward Score or Achievement, just tracked.">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Field Label</label>
            <input value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} placeholder="e.g. Site Photos Shared" className={ptInputCls} />
          </div>
          <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-700"><input type="checkbox" checked={newFieldMorning} onChange={(e) => setNewFieldMorning(e.target.checked)} />Morning</label>
          <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-700"><input type="checkbox" checked={newFieldEvening} onChange={(e) => setNewFieldEvening(e.target.checked)} />Evening</label>
          <button onClick={handleAddField} disabled={savingField || !newFieldLabel.trim()} className="flex-shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">Add Field</button>
        </div>
        <div className="space-y-1.5">
          {customFields.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
              <span className="text-slate-800">{f.label} <span className="text-xs text-slate-600">({[f.applies_morning && 'Morning', f.applies_evening && 'Evening'].filter(Boolean).join(', ')})</span></span>
              <button onClick={() => handleDeleteField(f.id)} className="text-xs font-semibold text-red-500 hover:underline">Remove</button>
            </div>
          ))}
          {customFields.length === 0 && <p className="text-xs text-slate-600">No custom fields yet.</p>}
        </div>
      </SectionCard>

      <SectionCard title="Champion Categories" subtitle="Labels shown on the Leaderboard's 'Champions' banner — turn off any you don't want to track.">
        <div className="space-y-1.5">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
              <input value={c.label} onChange={(e) => handleRenameCategory(c.id, e.target.value)} className="flex-1 rounded-lg bg-slate-50 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400/40" />
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={c.is_active} onChange={(e) => handleToggleCategory(c.id, e.target.checked)} />Active
              </label>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
