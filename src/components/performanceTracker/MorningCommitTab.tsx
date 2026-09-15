// src/components/performanceTracker/MorningCommitTab.tsx

import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import {
  loadMyCommitment, submitCommitment, loadCommitmentsForDate, todayStr, sendReminder,
} from '../../services/performanceTracker/performanceTrackerService';
import type { Employee } from '../../types/employee';
import type { PtCommitment, PtCustomField, PtSettings } from '../../types/performanceTracker';
import { Card, Badge, NumField, LoadingBlock, ptInputCls, employeeName } from './ptUi';
import { IconSend, IconAlert, IconBell, IconCheck, IconClock, IconSpinner } from './ptIcons';

export function MorningCommitTab({ employees, customFields, isManagerUp, settings }: {
  employees: Employee[]; customFields: PtCustomField[]; isManagerUp: boolean; settings: PtSettings;
}) {
  const user = getCurrentUser();
  const today = todayStr();
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<PtCommitment | null>(null);
  const [all, setAll] = useState<PtCommitment[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);

  const [f2f, setF2f] = useState(0);
  const [sv, setSv] = useState(0);
  const [revisit, setRevisit] = useState(0);
  const [calls, setCalls] = useState(0);
  const [conn, setConn] = useState(0);
  const [talk, setTalk] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, number>>({});

  async function load() {
    if (!user?.id || !user.companyId) return;
    setLoading(true);
    try {
      const [m, list] = await Promise.all([
        loadMyCommitment(user.id, today),
        loadCommitmentsForDate(user.companyId, today),
      ]);
      setMine(m);
      setAll(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [today]);

  const morningFields = customFields.filter((f) => f.applies_morning);

  async function submit() {
    if (!user?.id || !user.companyId) return;
    setErr(null);
    setSaving(true);
    try {
      await submitCommitment({
        company_id: user.companyId, employee_id: user.id, work_date: today,
        f2f_planned: f2f, sv_planned: sv, revisit_planned: revisit,
        calls_planned: calls, conn_target: conn, talk_target: talk,
        remarks: remarks || null, custom_values: customValues,
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to submit.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendReminder() {
    if (!user?.id || !user.companyId) return;
    const pendingIds = employees.filter((e) => e.active && !all.some((c) => c.employee_id === e.id)).map((e) => e.id);
    if (pendingIds.length === 0) return;
    setSendingReminder(true);
    setReminderMsg(null);
    try {
      const n = await sendReminder(user.companyId, user.id, `${user.firstName} ${user.lastName}`.trim(), pendingIds, 'morning', settings);
      setReminderMsg(`Sent to ${n} employee(s).`);
    } catch (e) {
      setReminderMsg(e instanceof Error ? e.message : 'Failed to send reminders.');
    } finally {
      setSendingReminder(false);
    }
  }

  if (loading) return <LoadingBlock />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Submit Morning Commitment</h3>
          {mine ? <Badge tone="active">Submitted</Badge> : <Badge tone="pending">Not Submitted</Badge>}
        </div>
        {mine ? (
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Submitted at {new Date(mine.submitted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} — cannot be edited after submission.
            </p>
            <div className="grid grid-cols-3 gap-3 pt-2 text-center">
              <div><p className="font-mono text-lg font-bold">{mine.f2f_planned}</p><p className="text-[11px] text-slate-500">F2F Planned</p></div>
              <div><p className="font-mono text-lg font-bold">{mine.sv_planned}</p><p className="text-[11px] text-slate-500">Site Visits</p></div>
              <div><p className="font-mono text-lg font-bold">{mine.calls_planned}</p><p className="text-[11px] text-slate-500">Calls</p></div>
            </div>
          </div>
        ) : (
          <>
            <p className="my-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Cannot be edited after submission — double-check before submitting.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {settings.f2f_enabled && <NumField label="F2F Meetings Planned" value={f2f} onChange={setF2f} />}
              {settings.sv_enabled && <NumField label="Site Visits Planned" value={sv} onChange={setSv} />}
              {settings.revisit_enabled && <NumField label="Revisits Planned" value={revisit} onChange={setRevisit} />}
              {settings.calls_enabled && <NumField label="Total Calls Planned" value={calls} onChange={setCalls} />}
              {settings.conn_enabled && <NumField label="Connected Calls Target" value={conn} onChange={setConn} />}
              {settings.talk_enabled && <NumField label="Talk Time Target (mins)" value={talk} onChange={setTalk} />}
            </div>
            {morningFields.length > 0 && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {morningFields.map((f) => (
                  <NumField key={f.id} label={f.label} value={customValues[f.field_key] ?? 0} onChange={(v) => setCustomValues((p) => ({ ...p, [f.field_key]: v }))} />
                ))}
              </div>
            )}
            <div className="mt-3">
              <label className="text-xs font-medium text-slate-600">Additional Remarks</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Optional — plans, focus areas, notes…" className={`mt-1 resize-none ${ptInputCls}`} />
            </div>
            {err && <p className="mt-2 flex items-center gap-1 text-xs text-rose-600"><IconAlert />{err}</p>}
            <button onClick={submit} disabled={saving} className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
              {saving ? <IconSpinner className="h-3.5 w-3.5" /> : <IconSend />}
              {saving ? 'Submitting…' : 'Submit Commitment'}
            </button>
          </>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-semibold text-slate-900">Team Commitment Status</span>
          {isManagerUp && (
            <button onClick={handleSendReminder} disabled={sendingReminder} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50">
              {sendingReminder ? <IconSpinner className="h-3 w-3" /> : <IconBell className="h-3 w-3" />}
              Send Reminder
            </button>
          )}
        </div>
        {reminderMsg && <p className="px-4 pt-2 text-xs text-slate-600">{reminderMsg}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="px-4 py-2 font-medium">Employee</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {employees.filter((e) => e.active && (isManagerUp || e.id === user?.id)).map((e) => {
                const c = all.find((x) => x.employee_id === e.id);
                return (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-900">{employeeName(e)}</td>
                    <td className="px-4 py-2">{c ? <Badge tone="active"><IconCheck className="h-2.5 w-2.5" />Submitted</Badge> : <Badge tone="pending"><IconClock className="h-2.5 w-2.5" />Not Submitted</Badge>}</td>
                    <td className="px-4 py-2 text-slate-600">{c ? new Date(c.submitted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
