import { useEffect, useMemo, useState } from "react";

import * as dataRepo from "../../repositories/callingApp/callingAppDataRepository";
import type { CallingAppIdentity } from "./CallingAppShell";
import type { CallingAppBreak, CallingAppAdmin, BreakType } from "../../types/callingApp";

const BREAK_TYPES: { value: BreakType; label: string; icon: string }[] = [
  { value: "coffee", label: "Coffee", icon: "☕" },
  { value: "lunch", label: "Lunch", icon: "🍽️" },
  { value: "other", label: "Other", icon: "⏸️" },
];

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function CallingAppBreaksTab({
  identity,
  breaks,
  teamAdmins,
  scopeAdminIds,
  onChanged,
  showToast,
}: {
  identity: CallingAppIdentity;
  breaks: CallingAppBreak[];
  teamAdmins: CallingAppAdmin[];
  scopeAdminIds: Set<string>;
  onChanged: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const { admin, client } = identity;
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const isTeamView = scopeAdminIds.size > 1;

  // A live ticking clock so an in-progress break's elapsed time visibly
  // counts up rather than looking frozen.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const myActiveBreak = useMemo(() => breaks.find((b) => b.admin_id === admin.id && b.ended_at === null), [breaks, admin.id]);
  const myBreaksToday = useMemo(() => breaks.filter((b) => b.admin_id === admin.id && isToday(b.started_at)), [breaks, admin.id]);
  const myMinutesToday = useMemo(
    () => myBreaksToday.reduce((sum, b) => sum + (new Date(b.ended_at ?? now).getTime() - new Date(b.started_at).getTime()), 0),
    [myBreaksToday, now]
  );

  const teamStatus = useMemo(() => {
    if (!isTeamView) return [];
    return teamAdmins
      .filter((a) => scopeAdminIds.has(a.id))
      .map((a) => {
        const active = breaks.find((b) => b.admin_id === a.id && b.ended_at === null);
        const todayTotal = breaks
          .filter((b) => b.admin_id === a.id && isToday(b.started_at))
          .reduce((sum, b) => sum + (new Date(b.ended_at ?? now).getTime() - new Date(b.started_at).getTime()), 0);
        return { admin: a, active, todayTotal };
      })
      .sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));
  }, [isTeamView, teamAdmins, scopeAdminIds, breaks, now]);

  async function handleStart(type: BreakType) {
    setStarting(true);
    try {
      await dataRepo.startBreak(client, admin.company_id, admin.id, type);
      onChanged();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not start the break.", false);
    } finally {
      setStarting(false);
    }
  }

  async function handleEnd() {
    if (!myActiveBreak) return;
    setEnding(true);
    try {
      await dataRepo.endBreak(client, myActiveBreak.id);
      onChanged();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not end the break.", false);
    } finally {
      setEnding(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        {myActiveBreak ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {BREAK_TYPES.find((t) => t.value === myActiveBreak.break_type)?.icon} On {myActiveBreak.break_type} break
              </p>
              <p className="mt-1 text-xs text-slate-600">Started {new Date(myActiveBreak.started_at).toLocaleTimeString()} · {formatDuration(now - new Date(myActiveBreak.started_at).getTime())} so far</p>
            </div>
            <button onClick={handleEnd} disabled={ending} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {ending ? "Ending…" : "End Break"}
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-900">Start a Break</p>
            <div className="flex flex-wrap gap-2">
              {BREAK_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleStart(t.value)}
                  disabled={starting}
                  className="rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-50"
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
          Today's total break time: <span className="font-semibold text-slate-700">{formatDuration(myMinutesToday)}</span> across {myBreaksToday.length} break{myBreaksToday.length === 1 ? "" : "s"}.
        </p>
      </section>

      {isTeamView && (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Team Status</h3>
          <div className="space-y-2">
            {teamStatus.map((s) => (
              <div key={s.admin.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
                <span className="font-medium text-slate-800">{s.admin.display_name}</span>
                <div className="flex items-center gap-3 text-xs">
                  {s.active ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700">
                      {BREAK_TYPES.find((t) => t.value === s.active!.break_type)?.icon} On {s.active.break_type} · {formatDuration(now - new Date(s.active.started_at).getTime())}
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">Available</span>
                  )}
                  <span className="text-slate-600">Today: {formatDuration(s.todayTotal)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
