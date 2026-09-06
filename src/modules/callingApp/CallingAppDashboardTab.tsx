import { useEffect, useMemo, useState } from "react";

import { updateMyRegisteredMobile } from "../../repositories/callingApp/callingAppDataRepository";
import type { CallingAppIdentity } from "./CallingAppShell";
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

type RangeKey = "today" | "yesterday" | "week" | "month" | "custom";
const RANGE_LABELS: Record<RangeKey, string> = { today: "Today", yesterday: "Yesterday", week: "This Week", month: "This Month", custom: "Pick a Date" };

function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function rangeBounds(key: RangeKey, customDate: string): { from: Date; to: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  if (key === "today") return { from: startOfDay(now), to: endOfDay(now) };
  if (key === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y) };
  }
  if (key === "week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday start
    const monday = new Date(now);
    monday.setDate(monday.getDate() - diff);
    return { from: startOfDay(monday), to: endOfDay(now) };
  }
  if (key === "custom") {
    // Parse "YYYY-MM-DD" as LOCAL midnight, not UTC — `new Date("YYYY-MM-DD")`
    // parses as UTC and can shift a day off in IST, the exact bug we just
    // hit seeding demo data.
    const [y, m, d] = customDate.split("-").map(Number);
    const picked = new Date(y, (m || 1) - 1, d || 1);
    return { from: startOfDay(picked), to: endOfDay(picked) };
  }
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: startOfDay(first), to: endOfDay(now) };
}

// 8 three-hour buckets, ticked at 12AM/6AM/12PM/6PM to match the
// familiar "calls by time of day" chart shape from phone-tracking apps —
// built entirely from calls the employee already logs in the Calling
// Sheet, since a web app has no way to read a phone's real call log.
const BUCKET_HOURS = 3;
const BUCKET_COUNT = 24 / BUCKET_HOURS;
function bucketLabel(i: number): string {
  const hour = i * BUCKET_HOURS;
  if (hour === 0) return "12AM";
  if (hour === 6) return "6AM";
  if (hour === 12) return "12PM";
  if (hour === 18) return "6PM";
  return "";
}

export function CallingAppDashboardTab({
  identity,
  admin,
  contacts,
  callLogs,
  dispositions,
  teamAdmins,
  scopeAdminIds,
  onChanged,
}: {
  identity: CallingAppIdentity;
  admin: CallingAppAdmin;
  contacts: CallingAppContact[];
  callLogs: CallingAppCallLog[];
  dispositions: CallingAppDisposition[];
  teamAdmins: CallingAppAdmin[];
  scopeAdminIds: Set<string>;
  onChanged: () => void;
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

  // ── Call Activity (Callyzer-style breakdown for one person) ──────────
  const [viewingId, setViewingId] = useState(admin.id);
  const [range, setRange] = useState<RangeKey>("today");
  const [customDate, setCustomDate] = useState(todayStr());

  const viewingAdmin = teamAdmins.find((a) => a.id === viewingId) ?? admin;
  const isViewingSelf = viewingId === admin.id;
  // teamAdmins (freshly fetched every load) reflects the true saved value
  // — the `admin` prop is only as fresh as when this session first logged
  // in, so seeding from it directly could show a stale/blank number.
  const myRegisteredMobile = (teamAdmins.find((a) => a.id === admin.id) ?? admin).registered_mobile_no;

  const [mobileInput, setMobileInput] = useState(myRegisteredMobile ?? "");
  const [savingMobile, setSavingMobile] = useState(false);
  const [mobileSaved, setMobileSaved] = useState(false);

  useEffect(() => {
    setMobileInput(myRegisteredMobile ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRegisteredMobile]);
  const { from, to } = rangeBounds(range, customDate);
  const viewingLogs = useMemo(
    () => callLogs.filter((l) => l.admin_id === viewingId && new Date(l.called_at) >= from && new Date(l.called_at) <= to),
    [callLogs, viewingId, from, to]
  );

  const outcomeCounts = useMemo(() => {
    let positive = 0, neutral = 0, negative = 0, none = 0;
    for (const l of viewingLogs) {
      const outcome = l.disposition_id ? dispositionById.get(l.disposition_id)?.outcome_type : undefined;
      if (outcome === "positive") positive += 1;
      else if (outcome === "negative") negative += 1;
      else if (outcome === "neutral") neutral += 1;
      else none += 1;
    }
    return { positive, neutral, negative, none };
  }, [viewingLogs, dispositionById]);

  const hourlyBuckets = useMemo(() => {
    const buckets = Array.from({ length: BUCKET_COUNT }, () => ({ positive: 0, neutral: 0, negative: 0 }));
    for (const l of viewingLogs) {
      const hour = new Date(l.called_at).getHours();
      const bi = Math.floor(hour / BUCKET_HOURS);
      const outcome = l.disposition_id ? dispositionById.get(l.disposition_id)?.outcome_type : undefined;
      if (outcome === "positive") buckets[bi].positive += 1;
      else if (outcome === "negative") buckets[bi].negative += 1;
      else buckets[bi].neutral += 1;
    }
    return buckets;
  }, [viewingLogs, dispositionById]);
  const maxBucketValue = Math.max(1, ...hourlyBuckets.map((b) => b.positive + b.neutral + b.negative));

  async function handleSaveMobile() {
    setSavingMobile(true);
    setMobileSaved(false);
    try {
      await updateMyRegisteredMobile(identity.client, mobileInput.trim());
      setMobileSaved(true);
      onChanged();
    } finally {
      setSavingMobile(false);
    }
  }

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

      {/* Call Activity — a Callyzer-style personal breakdown, built from
          calls already logged in the Calling Sheet (no phone/telephony
          access from a web app, so this can't be more "automatic" than
          that — see the registered-number note below). */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">📞 Call Activity</p>
            <p className="text-xs text-slate-600">{viewingAdmin.display_name}{viewingAdmin.registered_mobile_no && <> · 📱 {viewingAdmin.registered_mobile_no}</>}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isTeamView && (
              <select
                value={viewingId}
                onChange={(e) => setViewingId(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
              >
                <option value={admin.id}>Myself</option>
                {teamAdmins.filter((a) => scopeAdminIds.has(a.id) && a.id !== admin.id).map((a) => (
                  <option key={a.id} value={a.id}>{a.display_name}</option>
                ))}
              </select>
            )}
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as RangeKey)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
            >
              {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => <option key={k} value={k}>{RANGE_LABELS[k]}</option>)}
            </select>
            {range === "custom" && (
              <input
                type="date"
                value={customDate}
                max={todayStr()}
                onChange={(e) => setCustomDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
              />
            )}
          </div>
        </div>

        {isViewingSelf && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
            <span className="text-xs font-semibold text-slate-600 shrink-0">📱 Registered number:</span>
            <input
              value={mobileInput}
              onChange={(e) => { setMobileInput(e.target.value); setMobileSaved(false); }}
              placeholder="e.g. 98765 43210 — whichever SIM you call from"
              className="min-w-[10rem] flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400"
            />
            <button
              onClick={handleSaveMobile}
              disabled={savingMobile || mobileInput.trim() === (myRegisteredMobile ?? "")}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              {savingMobile ? "Saving…" : "Save"}
            </button>
            {mobileSaved && <span className="text-xs font-semibold text-emerald-600">Saved ✓</span>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
            <p className="text-lg font-bold text-slate-900">{viewingLogs.length}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Calls</p>
          </div>
          <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-center">
            <p className="text-lg font-bold text-emerald-700">{outcomeCounts.positive}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Positive</p>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-center">
            <p className="text-lg font-bold text-amber-700">{outcomeCounts.neutral + outcomeCounts.none}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Neutral</p>
          </div>
          <div className="rounded-xl bg-rose-50 px-3 py-2.5 text-center">
            <p className="text-lg font-bold text-rose-700">{outcomeCounts.negative}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">Negative</p>
          </div>
        </div>

        {viewingLogs.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">No calls logged in this range.</p>
        ) : (
          <div>
            <div className="flex h-32 items-end gap-1.5">
              {hourlyBuckets.map((b, i) => {
                const total = b.positive + b.neutral + b.negative;
                const heightPct = (total / maxBucketValue) * 100;
                return (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-0.5" style={{ height: "100%" }}>
                    <div className="flex w-full flex-1 flex-col-reverse items-stretch justify-start overflow-hidden rounded-t" style={{ height: `${Math.max(heightPct, total > 0 ? 4 : 0)}%`, marginTop: "auto" }}>
                      {b.positive > 0 && <div className="w-full bg-emerald-500" style={{ flex: b.positive }} title={`${b.positive} positive`} />}
                      {b.neutral > 0 && <div className="w-full bg-amber-400" style={{ flex: b.neutral }} title={`${b.neutral} neutral`} />}
                      {b.negative > 0 && <div className="w-full bg-rose-500" style={{ flex: b.negative }} title={`${b.negative} negative`} />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex gap-1.5">
              {hourlyBuckets.map((_, i) => (
                <div key={i} className="flex-1 text-center text-[10px] text-slate-400">{bucketLabel(i)}</div>
              ))}
            </div>
            <div className="mt-3 flex justify-center gap-4 text-[11px] text-slate-600">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Positive</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Neutral</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Negative</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
