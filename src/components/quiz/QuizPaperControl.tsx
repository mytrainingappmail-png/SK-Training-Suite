// The trainer's control for the ANSWER PAPER (each trainee's review of every question) after a Live Quiz: release it, hide it again,
// and optionally let it leave by itself after some minutes - the way an exam's results are released. Shown on the host's end screen.
// What the quiz does by default (release / automatic / off) is chosen in Quiz Settings and in each quiz's own settings.

import { useEffect, useState } from "react";
import { releaseQuizPaper } from "../../repositories/quiz/quizSessionRepository";
import type { QuizSession } from "../../types/quiz";

export default function QuizPaperControl({ session, defaultMinutes }: { session: QuizSession; defaultMinutes: number | null }) {
  const mode = session.paper_mode ?? "auto";
  const [minutes, setMinutes] = useState<string>(defaultMinutes ? String(defaultMinutes) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { setMinutes(defaultMinutes ? String(defaultMinutes) : ""); }, [defaultMinutes]);
  useEffect(() => {
    if (!session.paper_released || !session.paper_minutes) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session.paper_released, session.paper_minutes]);

  if (mode === "off") {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="text-sm font-bold text-white">📄 Answer paper</div>
        <p className="mt-1 text-xs text-slate-500">Switched off for this quiz — trainees do not get their answer paper. (Quiz Settings → Answer paper, or this quiz's own settings.)</p>
      </div>
    );
  }
  if (mode === "auto") {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="text-sm font-bold text-white">📄 Answer paper</div>
        <p className="mt-1 text-xs text-slate-500">Shown to trainees automatically right after the quiz. (Change it to “I release it” in Quiz Settings → Answer paper, or in this quiz's own settings.)</p>
      </div>
    );
  }

  const expiresAt = session.paper_released && session.paper_released_at && session.paper_minutes
    ? new Date(session.paper_released_at).getTime() + session.paper_minutes * 60000 : null;
  const left = expiresAt ? Math.max(0, Math.round((expiresAt - now) / 1000)) : null;
  const open = session.paper_released && (left === null || left > 0);

  async function act(release: boolean) {
    setBusy(true); setError("");
    try {
      const m = Number(minutes);
      await releaseQuizPaper(session.id, release, release && Number.isFinite(m) && m > 0 ? Math.min(1440, Math.round(m)) : null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not change this."); }
    finally { setBusy(false); }
  }

  return (
    <div className={`rounded-2xl border p-5 ${open ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-800 bg-slate-900"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-white">📄 Answer paper for trainees</div>
          <p className="mt-0.5 text-xs text-slate-400">
            {open
              ? left !== null
                ? `✓ Visible to trainees — closes by itself in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}.`
                : "✓ Visible to trainees until you hide it."
              : session.paper_released && left === 0
                ? "The time you set is over — the paper has gone from the trainees' screens."
                : "Hidden. Trainees see their result, but not the answer paper, until you release it."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!open && (
            <label className="flex items-center gap-1.5 text-xs text-slate-400" title="Leave empty to keep it open until you hide it">
              for
              <input
                type="number" min={1} max={1440} value={minutes} placeholder="∞"
                onChange={(e) => setMinutes(e.target.value)}
                className="w-16 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-white outline-none focus:border-violet-500"
              />
              min
            </label>
          )}
          <button
            onClick={() => void act(!open)}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${open ? "border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10" : "bg-amber-400 text-slate-950 hover:bg-amber-300"}`}
          >
            {busy ? "…" : open ? "🙈 Hide paper" : "📢 Release paper"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
