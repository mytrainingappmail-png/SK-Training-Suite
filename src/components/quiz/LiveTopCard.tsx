// A slim strip under the top bar of a trainee's Live Quiz screen: who is leading right now (places and names only - never points),
// updating while the quiz runs. Collapsed it shows the trainee's own place and the leader; a tap opens the whole list.
// Whether it exists at all, how many names it lists, whether the trainee also sees their own place, full or first names and how often
// it refreshes are all the trainer's choices (Settings and the quiz's own settings) and arrive in `config`.

import { useEffect, useRef, useState } from "react";
import { getQuizLiveTop } from "../../services/quiz/quizPlayService";
import { MEDALS } from "../../services/quiz/quizRankingService";
import type { LiveTopConfig, LiveTopRow } from "../../types/quiz";

const OPEN_KEY = "quiz-live-top-open";

function readOpen(): boolean {
  try { return localStorage.getItem(OPEN_KEY) !== "0"; } catch { return true; }
}

const place = (rank: number) => (rank <= MEDALS.length ? MEDALS[rank - 1] : `#${rank}`);

export default function LiveTopCard({ sessionId, config }: { sessionId: string; config: LiveTopConfig | null | undefined }) {
  const [rows, setRows] = useState<LiveTopRow[]>([]);
  const [open, setOpen] = useState(readOpen);
  // where I was on the previous refresh, so a climb or a drop can be shown
  const [move, setMove] = useState(0);
  const lastMine = useRef<number | null>(null);
  const enabled = config?.enabled === true;
  const refreshMs = Math.max(1, config?.refresh_seconds ?? 5) * 1000;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function pull() {
      if (document.visibilityState === "visible") {
        try {
          const next = await getQuizLiveTop(sessionId);
          if (cancelled) return;
          const mine = next.find((r) => r.is_me)?.rank ?? null;
          if (mine !== null && lastMine.current !== null && mine !== lastMine.current) setMove(lastMine.current - mine);
          if (mine !== null) lastMine.current = mine;
          setRows(next);
        } catch { /* try again on the next beat */ }
      }
      // spread a little so a whole room does not ask on the same second
      if (!cancelled) timer = setTimeout(pull, refreshMs * (0.8 + Math.random() * 0.4));
    }
    void pull();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [enabled, sessionId, refreshMs]);

  if (!enabled) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(OPEN_KEY, next ? "1" : "0"); } catch { /* a remembered choice is only a convenience */ }
  }

  const me = rows.find((r) => r.is_me);
  const leader = rows[0];

  return (
    <div className="border-b border-slate-800 bg-slate-900/80">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-2 text-left">
        <span className="text-sm">🏆</span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-300">
          {rows.length === 0 ? (
            "Top ranks appear after the first answers"
          ) : (
            <>
              {me ? <span className="text-amber-300">You: {place(me.rank)}</span> : <span className="text-slate-400">Not ranked yet</span>}
              {move !== 0 && me && <span className={move > 0 ? " ml-1 text-emerald-400" : " ml-1 text-red-400"}>{move > 0 ? `▲${move}` : `▼${-move}`}</span>}
              {leader && <span className="text-slate-400"> · Leading: {leader.display_name}</span>}
            </>
          )}
        </span>
        <span className="text-[10px] text-slate-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && rows.length > 0 && (
        <ol className="space-y-1 px-4 pb-3">
          {rows.map((r, i) => (
            <li key={r.rank} className={`${i > 0 && r.rank - rows[i - 1].rank > 1 ? "mt-2 border-t border-dashed border-slate-700 pt-2 " : ""}flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${r.is_me ? "bg-amber-400/15 font-bold text-amber-200" : "text-slate-200"}`}>
              <span className="w-8 shrink-0 text-center font-mono text-xs">{place(r.rank)}</span>
              <span className="min-w-0 flex-1 truncate">{r.display_name}</span>
              {r.is_me && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-950">You</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
