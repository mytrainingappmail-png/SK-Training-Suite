// src/components/performanceTracker/EveningReportTab.tsx

import { useEffect, useMemo, useState } from 'react';
import { getCurrentUser } from '../../services/auth/session';
import { loadMyReport, loadMyCommitment, loadReportsForDate, submitReport, todayStr } from '../../services/performanceTracker/performanceTrackerService';
import type { Employee } from '../../types/employee';
import type {
  PtActivityDetails, PtBookingRow, PtCommitment, PtCustomField, PtMeetingKind, PtMeetingRow, PtReport, PtSettings,
} from '../../types/performanceTracker';
import {
  MEETING_KINDS, blankBooking, blankMeeting, cleanBookings, cleanReportRows, detailsConfig, doneCount, hasDetails, kindNoun, plannedRowsForEvening,
} from '../../utils/ptActivityDetails';
import { Card, Badge, NumField, LoadingBlock, ptInputCls, employeeName } from './ptUi';
import { IconSend, IconAlert, IconSpinner } from './ptIcons';
import { ActivityDetailsView, BookingRowsEditor, DetailsToggle, MeetingRowsEditor } from './ActivityDetailsEditor';
import { useProjectNames } from './usePtProjectNames';

export function EveningReportTab({ settings, customFields, employees = [] }: { settings: PtSettings; customFields: PtCustomField[]; employees?: Employee[] }) {
  const user = getCurrentUser();
  const today = todayStr();
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<PtReport | null>(null);
  const [commitment, setCommitment] = useState<PtCommitment | null>(null);
  const [teamReports, setTeamReports] = useState<PtReport[]>([]);
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

  // ── optional activity details ──
  // A meeting kind is in "details mode" once its cards are open (rows != null): then its number is simply the count of
  // meetings marked Done, so the numbers and the details can never disagree. Until then it is the plain number field.
  const cfg = detailsConfig(settings);
  const projectNames = useProjectNames(cfg.enabled && cfg.useProjects);
  const [meetingRows, setMeetingRows] = useState<Record<PtMeetingKind, PtMeetingRow[] | null>>({ f2f: null, sv: null, revisit: null });
  const [bookingRows, setBookingRows] = useState<PtBookingRow[] | null>(null);
  const [prospects, setProspects] = useState(0);
  const [callingNote, setCallingNote] = useState('');

  useEffect(() => {
    if (!user?.id || !user.companyId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      loadMyReport(user.id, today),
      loadMyCommitment(user.id, today),
      cfg.visibility === 'team' && cfg.enabled ? loadReportsForDate(user.companyId, today).catch(() => []) : Promise.resolve([] as PtReport[]),
    ])
      .then(([r, c, team]) => { if (!cancelled) { setMine(r); setCommitment(c); setTeamReports(team); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const eveningFields = customFields.filter((f) => f.applies_evening);

  const plannedOf = (kind: PtMeetingKind): number =>
    !commitment ? 0 : kind === 'f2f' ? commitment.f2f_planned : kind === 'sv' ? commitment.sv_planned : commitment.revisit_planned;
  const typedOf = (kind: PtMeetingKind): number => (kind === 'f2f' ? f2f : kind === 'sv' ? sv : revisit);
  const kindEnabled: Record<PtMeetingKind, boolean> = { f2f: settings.f2f_enabled, sv: settings.sv_enabled, revisit: settings.revisit_enabled };

  /** Open the cards for one kind: the morning plan comes pre-filled (waiting for Done / Not done), or — with no plan —
   * as many empty "done" cards as the number already typed. */
  function openMeetingDetails(kind: PtMeetingKind) {
    const planned = plannedRowsForEvening(commitment?.plan_details, kind, plannedOf(kind));
    const rows = planned.length > 0
      ? planned
      : Array.from({ length: Math.max(1, typedOf(kind)) }, () => blankMeeting({ planned: false, status: 'done' as const }));
    setMeetingRows((prev) => ({ ...prev, [kind]: rows }));
  }
  function changeMeetingRows(kind: PtMeetingKind, rows: PtMeetingRow[]) {
    // no cards left (every extra removed, nothing was planned) -> back to the plain number
    setMeetingRows((prev) => ({ ...prev, [kind]: rows.length === 0 ? null : rows }));
    if (rows.length === 0) { if (kind === 'f2f') setF2f(0); else if (kind === 'sv') setSv(0); else setRevisit(0); }
  }
  /** Leave details mode and keep the number as it stands (nothing typed in the cards is saved). */
  function closeMeetingDetails(kind: PtMeetingKind) {
    const n = doneCount(meetingRows[kind] ?? []);
    if (kind === 'f2f') setF2f(n); else if (kind === 'sv') setSv(n); else setRevisit(n);
    setMeetingRows((prev) => ({ ...prev, [kind]: null }));
  }
  function openBookingDetails() {
    setBookingRows(Array.from({ length: Math.max(1, bookings) }, () => blankBooking()));
  }
  function changeBookingRows(rows: PtBookingRow[]) {
    setBookingRows(rows.length === 0 ? null : rows);
    if (rows.length === 0) setBookings(0);
  }

  // The numbers that are sent and scored: the plain field, or — in details mode — what the cards say.
  const f2fDone = meetingRows.f2f ? doneCount(meetingRows.f2f) : f2f;
  const svDone = meetingRows.sv ? doneCount(meetingRows.sv) : sv;
  const revisitDone = meetingRows.revisit ? doneCount(meetingRows.revisit) : revisit;
  const bookingsDone = bookingRows ? bookingRows.length : bookings;
  const doneOf = (kind: PtMeetingKind): number => (kind === 'f2f' ? f2fDone : kind === 'sv' ? svDone : revisitDone);

  // Mirrors pt_reports_compute_score() exactly (enabled flags + scoreable
  // custom fields) so this preview never disagrees with what the server
  // actually stores once submitted.
  const live = useMemo(() => {
    let score = 0;
    if (settings.f2f_enabled) score += f2fDone * settings.score_f2f;
    if (settings.sv_enabled) score += svDone * settings.score_sv;
    if (settings.revisit_enabled) score += revisitDone * settings.score_revisit;
    score += bookingsDone * settings.score_booking;
    if (settings.conn_enabled) score += conn * settings.score_conn;
    if (settings.talk_enabled) score += Math.floor(talk / 5) * settings.score_talk_per5;
    for (const f of eveningFields) {
      if (!f.counts_toward_score) continue;
      score += (customValues[f.field_key] ?? 0) * f.score_weight;
    }

    const metrics: { label: string; planned: number; done: number }[] = [];
    if (commitment) {
      if (settings.f2f_enabled && commitment.f2f_planned > 0) metrics.push({ label: 'F2F', planned: commitment.f2f_planned, done: f2fDone });
      if (settings.sv_enabled && commitment.sv_planned > 0) metrics.push({ label: 'Site Visits', planned: commitment.sv_planned, done: svDone });
      if (settings.calls_enabled && commitment.calls_planned > 0) metrics.push({ label: 'Calls', planned: commitment.calls_planned, done: calls });
    }
    const achPct = metrics.length
      ? Math.round((metrics.reduce((sum, m) => sum + Math.min((m.done / m.planned) * 100, 150), 0) / metrics.length) * 10) / 10
      : null;

    let minMet = true;
    if (settings.f2f_enabled && f2fDone < settings.min_f2f) minMet = false;
    if (settings.sv_enabled && svDone < settings.min_sv) minMet = false;
    if (settings.revisit_enabled && revisitDone < settings.min_revisit) minMet = false;
    if (settings.calls_enabled && calls < settings.min_calls) minMet = false;
    if (settings.conn_enabled && conn < settings.min_conn) minMet = false;
    if (settings.talk_enabled && talk < settings.min_talk) minMet = false;
    for (const f of eveningFields) {
      if (!f.counts_toward_score || f.min_threshold == null) continue;
      if ((customValues[f.field_key] ?? 0) < f.min_threshold) minMet = false;
    }

    return { score, achPct, minMet, metrics };
  }, [f2fDone, svDone, revisitDone, calls, conn, talk, bookingsDone, settings, commitment, eveningFields, customValues]);

  async function submit() {
    if (!user?.id || !user.companyId) return;
    setErr(null);
    setSaving(true);
    try {
      const details: PtActivityDetails = {};
      if (cfg.enabled) {
        for (const k of MEETING_KINDS) {
          const rows = meetingRows[k.key];
          if (rows && kindEnabled[k.key]) details[k.key] = cleanReportRows(rows);
        }
        if (bookingRows) details.bookings = cleanBookings(bookingRows);
        if (settings.calls_enabled && (prospects > 0 || callingNote.trim())) details.calling = { prospects, note: callingNote.trim() };
      }
      await submitReport({
        company_id: user.companyId, employee_id: user.id, work_date: today,
        f2f_done: f2fDone, sv_done: svDone, revisit_done: revisitDone, calls_done: calls,
        conn_done: conn, talk_done: talk, leads, meetings_fixed: meetingsFixed, bookings: bookingsDone,
        remarks: remarks || null, custom_values: customValues,
        activity_details: details,
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

  const empName = (id: string) => employeeName(employees.find((e) => e.id === id));
  const teamWithDetails = teamReports.filter((r) => r.employee_id !== user?.id && hasDetails(r.activity_details));

  return (
    <div className="space-y-4">
    <Card className="max-w-3xl p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Evening Actual Performance Report</h3>
        {mine ? <Badge tone="active">Submitted</Badge> : <Badge tone="gray">Not Submitted</Badge>}
      </div>

      {mine ? (
        <div className="mt-3 space-y-3">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Submitted at {new Date(mine.submitted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} — cannot be edited after submission. If something needs correcting, ask your manager.
          </p>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div><p className="font-mono text-lg font-bold text-emerald-700">{mine.score != null ? Math.round(mine.score) : '—'}</p><p className="text-[11px] text-slate-500">Score</p></div>
            <div><p className="font-mono text-lg font-bold">{mine.achievement_pct != null ? `${mine.achievement_pct}%` : '—'}</p><p className="text-[11px] text-slate-500">Achievement</p></div>
            <div><p className="font-mono text-lg font-bold">{mine.bookings}</p><p className="text-[11px] text-slate-500">Bookings</p></div>
            <div>{mine.min_criteria_met ? <Badge tone="active">✓ Met</Badge> : <Badge tone="rejected">✗ Not Met</Badge>}</div>
          </div>
          <p className="text-[11px] text-slate-400">Achievement % is based on F2F, Site Visits and Calls only — Revisits, Connected Calls and Talk Time are tracked but don't factor into it.</p>
          {hasDetails(mine.activity_details) && (
            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Your details</p>
              <ActivityDetailsView details={mine.activity_details} />
            </div>
          )}
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
            {MEETING_KINDS.filter((k) => kindEnabled[k.key]).map((k) =>
              meetingRows[k.key] ? (
                <div key={k.key} className="rounded-lg bg-emerald-50/60 px-3 py-2">
                  <p className="text-xs font-medium text-slate-600">{k.singular}s done</p>
                  <p className="font-mono text-xl font-bold text-emerald-700">{doneOf(k.key)}</p>
                  <p className="text-[11px] text-slate-500">counted from the cards below</p>
                </div>
              ) : (
                <NumField
                  key={k.key}
                  label={k.key === 'f2f' ? 'F2F Meetings Done' : k.key === 'sv' ? 'Site Visits Done' : 'Revisits Done'}
                  value={typedOf(k.key)}
                  onChange={k.key === 'f2f' ? setF2f : k.key === 'sv' ? setSv : setRevisit}
                />
              ),
            )}
            {settings.calls_enabled && <NumField label="Total Calls Made" value={calls} onChange={setCalls} />}
            {settings.conn_enabled && <NumField label="Calls Connected" value={conn} onChange={setConn} />}
            {settings.talk_enabled && <NumField label="Total Talk Time (mins)" value={talk} onChange={setTalk} />}
            <NumField label="Leads Generated" value={leads} onChange={setLeads} />
            <NumField label="Meetings Fixed" value={meetingsFixed} onChange={setMeetingsFixed} />
            {bookingRows ? (
              <div className="rounded-lg bg-emerald-50/60 px-3 py-2">
                <p className="text-xs font-medium text-slate-600">Bookings Generated</p>
                <p className="font-mono text-xl font-bold text-emerald-700">{bookingRows.length}</p>
                <p className="text-[11px] text-slate-500">counted from the cards below</p>
              </div>
            ) : (
              <NumField label="Bookings Generated" value={bookings} onChange={setBookings} />
            )}
          </div>

          {cfg.enabled && (
            <div className="mt-4 space-y-3">
              {MEETING_KINDS.filter((k) => kindEnabled[k.key]).map((k) => {
                const planned = plannedOf(k.key);
                const rows = meetingRows[k.key];
                if (!rows && planned === 0 && typedOf(k.key) === 0) return null;
                return (
                  <div key={k.key} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    {rows ? (
                      <>
                        <MeetingRowsEditor
                          kind={k.key} rows={rows} mode="report" cfg={cfg} names={projectNames}
                          plannedTotal={planned || undefined}
                          onChange={(r) => changeMeetingRows(k.key, r)}
                        />
                        <button type="button" onClick={() => closeMeetingDetails(k.key)} className="mt-2 text-[11px] text-slate-500 hover:underline">Use a plain number instead (details are not saved)</button>
                      </>
                    ) : (
                      <DetailsToggle
                        label={planned > 0
                          ? `You planned ${planned} ${kindNoun(k.key, planned)} — mark each Done / Not done and add details`
                          : `Add ${kindNoun(k.key, 2)} details — which project, when, which client (optional)`}
                        open={false} onToggle={() => openMeetingDetails(k.key)}
                      />
                    )}
                  </div>
                );
              })}

              {(bookingRows || bookings > 0) && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  {bookingRows ? (
                    <>
                      <BookingRowsEditor rows={bookingRows} onChange={changeBookingRows} cfg={cfg} names={projectNames} />
                      <button type="button" onClick={() => { setBookings(bookingRows.length); setBookingRows(null); }} className="mt-2 text-[11px] text-slate-500 hover:underline">Use a plain number instead (details are not saved)</button>
                    </>
                  ) : (
                    <DetailsToggle label="Add booking details — which client, project, unit (optional)" open={false} onToggle={openBookingDetails} />
                  )}
                </div>
              )}

              {settings.calls_enabled && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <h4 className="mb-2 text-xs font-semibold text-slate-800">Data calling</h4>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <NumField label="Prospects created" value={prospects} onChange={setProspects} />
                    {cfg.askWriteup && (
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-slate-600">Write-up (optional)</label>
                        <textarea
                          value={callingNote} onChange={(e) => setCallingNote(e.target.value)} rows={2}
                          placeholder="Who showed interest, which project, follow-ups planned…" className={`mt-1 resize-y ${ptInputCls}`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {eveningFields.length > 0 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {eveningFields.map((f) => (
                <NumField key={f.id} label={f.label} value={customValues[f.field_key] ?? 0} onChange={(v) => setCustomValues((p) => ({ ...p, [f.field_key]: v }))} />
              ))}
            </div>
          )}
          <div className="mt-3">
            <label className="text-xs font-medium text-slate-600">Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Notes, blockers, highlights, next steps…" className={`mt-1 resize-y ${ptInputCls}`} />
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
          <p className="mt-2 text-[11px] text-slate-500">After you submit, the report is locked — only your manager can correct it.</p>
        </>
      )}
    </Card>

    {cfg.enabled && cfg.visibility === 'team' && (
      <Card className="max-w-3xl p-5">
        <h3 className="text-sm font-semibold text-slate-900">Team activity today</h3>
        <p className="mt-0.5 text-xs text-slate-600">What your teammates have reported so far.</p>
        {teamWithDetails.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">Nobody has added details yet.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {teamWithDetails.map((r) => (
              <div key={r.id}>
                <p className="mb-1.5 text-xs font-semibold text-slate-800">{empName(r.employee_id)}</p>
                <ActivityDetailsView details={r.activity_details} />
              </div>
            ))}
          </div>
        )}
      </Card>
    )}
    </div>
  );
}
