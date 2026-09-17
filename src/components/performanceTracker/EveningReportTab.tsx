// src/components/performanceTracker/EveningReportTab.tsx

import { useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadMyReport, loadMyCommitment, submitReport, todayStr } from '../../services/performanceTracker/performanceTrackerService';
import type { PtCommitment, PtCustomField, PtReport, PtSettings } from '../../types/performanceTracker';
import { Card, Badge, NumField, LoadingBlock, ptInputCls } from './ptUi';
import { IconSend, IconAlert, IconSpinner } from './ptIcons';

export function EveningReportTab({ settings, customFields }: { settings: PtSettings; customFields: PtCustomField[] }) {
  const user = getCurrentUser();
  const today = todayStr();
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<PtReport | null>(null);
  const [commitment, setCommitment] = useState<PtCommitment | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [f2f, setF2f] = useState(0);
  const [sv, setSv] = useState(0);
  const [revisit, setRevisit] = useState(0);
  const [calls, setCalls] = useState(0);
  const [conn, setConn] = useState(0);
  const [talk, setTalk] = useState(0);
  const [leads, setLeads] = useState(0);
  const [meetingsFixed, setMeetingsFixed] = useState(0);
  const [bookings, setBookings] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([loadMyReport(user.id, today), loadMyCommitment(user.id, today)])
      .then(([r, c]) => { if (!cancelled) { setMine(r); setCommitment(c); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const eveningFields = customFields.filter((f) => f.applies_evening);

  // Mirrors pt_reports_compute_score() exactly (enabled flags + scoreable
  // custom fields) so this preview never disagrees with what the server
  // actually stores once submitted.
  const live = useMemo(() => {
    let score = 0;
    if (settings.f2f_enabled) score += f2f * settings.score_f2f;
    if (settings.sv_enabled) score += sv * settings.score_sv;
    if (settings.revisit_enabled) score += revisit * settings.score_revisit;
    score += bookings * settings.score_booking;
    if (settings.conn_enabled) score += conn * settings.score_conn;
    if (settings.talk_enabled) score += Math.floor(talk / 5) * settings.score_talk_per5;
    for (const f of eveningFields) {
      if (!f.counts_toward_score) continue;
      score += (customValues[f.field_key] ?? 0) * f.score_weight;
    }

    const metrics: { label: string; planned: number; done: number }[] = [];
    if (commitment) {
      if (settings.f2f_enabled && commitment.f2f_planned > 0) metrics.push({ label: 'F2F', planned: commitment.f2f_planned, done: f2f });
      if (settings.sv_enabled && commitment.sv_planned > 0) metrics.push({ label: 'Site Visits', planned: commitment.sv_planned, done: sv });
      if (settings.calls_enabled && commitment.calls_planned > 0) metrics.push({ label: 'Calls', planned: commitment.calls_planned, done: calls });
    }
    const achPct = metrics.length
      ? Math.round((metrics.reduce((sum, m) => sum + Math.min((m.done / m.planned) * 100, 150), 0) / metrics.length) * 10) / 10
      : null;

    let minMet = true;
    if (settings.f2f_enabled && f2f < settings.min_f2f) minMet = false;
    if (settings.sv_enabled && sv < settings.min_sv) minMet = false;
    if (settings.revisit_enabled && revisit < settings.min_revisit) minMet = false;
    if (settings.calls_enabled && calls < settings.min_calls) minMet = false;
    if (settings.conn_enabled && conn < settings.min_conn) minMet = false;
    if (settings.talk_enabled && talk < settings.min_talk) minMet = false;
    for (const f of eveningFields) {
      if (!f.counts_toward_score || f.min_threshold == null) continue;
      if ((customValues[f.field_key] ?? 0) < f.min_threshold) minMet = false;
    }

    return { score, achPct, minMet, metrics };
  }, [f2f, sv, revisit, calls, conn, talk, bookings, settings, commitment, eveningFields, customValues]);

  async function submit() {
    if (!user?.id || !user.companyId) return;
    setErr(null);
    setSaving(true);
    try {
      await submitReport({
        company_id: user.companyId, employee_id: user.id, work_date: today,
        f2f_done: f2f, sv_done: sv, revisit_done: revisit, calls_done: calls,
        conn_done: conn, talk_done: talk, leads, meetings_fixed: meetingsFixed, bookings,
        remarks: remarks || null, custom_values: customValues,
      });
      const r = await loadMyReport(user.id, today);
      setMine(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to submit.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingBlock />;

  return (
    <Card className="max-w-3xl p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Evening Actual Performance Report</h3>
        {mine ? <Badge tone="active">Submitted</Badge> : <Badge tone="gray">Not Submitted</Badge>}
      </div>

      {mine ? (
        <div className="mt-3 space-y-3">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Submitted at {new Date(mine.submitted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} — cannot be edited after submission.
          </p>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div><p className="font-mono text-lg font-bold text-emerald-700">{mine.score != null ? Math.round(mine.score) : '—'}</p><p className="text-[11px] text-slate-500">Score</p></div>
            <div><p className="font-mono text-lg font-bold">{mine.achievement_pct != null ? `${mine.achievement_pct}%` : '—'}</p><p className="text-[11px] text-slate-500">Achievement</p></div>
            <div><p className="font-mono text-lg font-bold">{mine.bookings}</p><p className="text-[11px] text-slate-500">Bookings</p></div>
            <div>{mine.min_criteria_met ? <Badge tone="active">✓ Met</Badge> : <Badge tone="rejected">✗ Not Met</Badge>}</div>
          </div>
          <p className="text-[11px] text-slate-400">Achievement % is based on F2F, Site Visits and Calls only — Revisits, Connected Calls and Talk Time are tracked but don't factor into it.</p>
          {mine.manager_comment && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Manager Feedback</p>
              <p className="mt-1 text-sm text-slate-800">{mine.manager_comment}</p>
            </div>
          )}
        </div>
      ) : !commitment ? (
        <p className="my-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          You haven't submitted a Morning Commitment today — you can still file an evening report, but "Achievement %" will only reflect metrics you plan for in the future (it needs a planned number to compare against).
        </p>
      ) : null}

      {!mine && (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {settings.f2f_enabled && <NumField label="F2F Meetings Done" value={f2f} onChange={setF2f} />}
            {settings.sv_enabled && <NumField label="Site Visits Done" value={sv} onChange={setSv} />}
            {settings.revisit_enabled && <NumField label="Revisits Done" value={revisit} onChange={setRevisit} />}
            {settings.calls_enabled && <NumField label="Total Calls Made" value={calls} onChange={setCalls} />}
            {settings.conn_enabled && <NumField label="Calls Connected" value={conn} onChange={setConn} />}
            {settings.talk_enabled && <NumField label="Total Talk Time (mins)" value={talk} onChange={setTalk} />}
            <NumField label="Leads Generated" value={leads} onChange={setLeads} />
            <NumField label="Meetings Fixed" value={meetingsFixed} onChange={setMeetingsFixed} />
            <NumField label="Bookings Generated" value={bookings} onChange={setBookings} />
          </div>
          {eveningFields.length > 0 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {eveningFields.map((f) => (
                <NumField key={f.id} label={f.label} value={customValues[f.field_key] ?? 0} onChange={(v) => setCustomValues((p) => ({ ...p, [f.field_key]: v }))} />
              ))}
            </div>
          )}
          <div className="mt-3">
            <label className="text-xs font-medium text-slate-600">Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Notes, blockers, highlights, next steps…" className={`mt-1 resize-none ${ptInputCls}`} />
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Live Auto-Calculated Performance</span>
              <Badge tone="info">Live</Badge>
            </div>
            <p className="mb-3 text-[11px] text-slate-500">"Achievement" per metric only shows for F2F, Site Visits and Calls (the ones counted in your overall Achievement %) — Revisits/Connected/Talk still count toward Score and Min Criteria below, just not Achievement %.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {live.metrics.map((m) => {
                const pct = Math.round((m.done / m.planned) * 100);
                return (
                  <div key={m.label}>
                    <p className="text-[11px] text-slate-500">{m.label} Achievement</p>
                    <p className={`font-mono text-lg font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{pct}%</p>
                  </div>
                );
              })}
              <div>
                <p className="text-[11px] text-slate-500">Performance Score</p>
                <p className="font-mono text-lg font-bold text-emerald-700">{Math.round(live.score)} pts</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Min Criteria</p>
                {live.minMet ? <Badge tone="active">✓ Met</Badge> : <Badge tone="rejected">✗ Not Met</Badge>}
              </div>
            </div>
          </div>

          {err && <p className="mt-2 flex items-center gap-1 text-xs text-rose-600"><IconAlert />{err}</p>}
          <button onClick={submit} disabled={saving} className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
            {saving ? <IconSpinner className="h-3.5 w-3.5" /> : <IconSend />}
            {saving ? 'Submitting…' : 'Submit Evening Report'}
          </button>
        </>
      )}
    </Card>
  );
}
