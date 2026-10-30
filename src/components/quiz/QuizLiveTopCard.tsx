// Settings → Live top ranks: the leaderboard strip a trainee sees on their own phone while a Live Quiz runs (places and names only,
// never points). Everything about it is the trainer's choice. A single quiz can follow this, switch it on or off (in its own settings).

import { useEffect, useState } from "react";
import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { getSettings, saveSettings } from "../../repositories/quiz/quizSettingsRepository";
import {
  LIVE_TOP_COUNT_MAX,
  LIVE_TOP_COUNT_MIN,
  LIVE_TOP_REFRESH_MAX,
  LIVE_TOP_REFRESH_MIN,
  type LiveTopNameStyle,
} from "../../types/quiz";

const NAME_STYLES: { value: LiveTopNameStyle; label: string; sample: string }[] = [
  { value: "full", label: "Full name", sample: "Rahul Sharma" },
  { value: "first", label: "First name only", sample: "Rahul" },
];

export default function QuizLiveTopCard() {
  const admin = getCurrentQuizAdmin();
  const canEdit = canEditQuizContent();
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [count, setCount] = useState(5);
  const [showMe, setShowMe] = useState(true);
  const [nameStyle, setNameStyle] = useState<LiveTopNameStyle>("full");
  const [refresh, setRefresh] = useState(5);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    getSettings(admin.company_id)
      .then((s) => {
        if (cancelled) return;
        setEnabled(s.live_top_enabled ?? false);
        setCount(s.live_top_count ?? 5);
        setShowMe(s.live_top_show_me ?? true);
        setNameStyle(s.live_top_name_style ?? "full");
        setRefresh(s.live_top_refresh_seconds ?? 5);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the live ranks settings."); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!admin) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveSettings(admin.company_id, {
        live_top_enabled: enabled,
        live_top_count: count,
        live_top_show_me: showMe,
        live_top_name_style: nameStyle,
        live_top_refresh_seconds: refresh,
      });
      setMessage("Saved. It applies to Live Quizzes from now on (a quiz that is already running picks it up on the next refresh).");
      setTimeout(() => setMessage(""), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  const clampInt = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || lo)));

  return (
    <fieldset disabled={!canEdit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-white">🏆 Live Top Ranks on the Trainee's Screen</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          While a Live Quiz runs, each trainee sees who is leading - names and places only, never points or marks - and it changes live as answers come in. It creates competition.
          This is the default for every Live Quiz; any single quiz can switch it on or off in its own settings.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-300">
        <input type="checkbox" className="mt-0.5" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>
          Show the top ranks on trainees' screens (Live Quiz)
          <span className="block text-xs text-slate-500 mt-0.5">
            Off to begin with. It switches itself off for a quiz that hides right / wrong from players, because a moving rank would give the answer away.
          </span>
        </span>
      </label>

      <div className={`grid gap-4 sm:grid-cols-2 ${enabled ? "" : "opacity-50"}`}>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">How many names ({LIVE_TOP_COUNT_MIN}-{LIVE_TOP_COUNT_MAX})</label>
          <input
            type="number"
            min={LIVE_TOP_COUNT_MIN}
            max={LIVE_TOP_COUNT_MAX}
            value={count}
            onChange={(e) => setCount(clampInt(e.target.value, LIVE_TOP_COUNT_MIN, LIVE_TOP_COUNT_MAX))}
            className="w-24 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Refresh every ({LIVE_TOP_REFRESH_MIN}-{LIVE_TOP_REFRESH_MAX} seconds)</label>
          <input
            type="number"
            min={LIVE_TOP_REFRESH_MIN}
            max={LIVE_TOP_REFRESH_MAX}
            value={refresh}
            onChange={(e) => setRefresh(clampInt(e.target.value, LIVE_TOP_REFRESH_MIN, LIVE_TOP_REFRESH_MAX))}
            className="w-24 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
          />
          <p className="mt-1 text-[11px] text-slate-500">A shorter time feels more live; a longer one is lighter when a big room plays.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">How names appear</label>
          <div className="flex flex-wrap gap-2">
            {NAME_STYLES.map((n) => (
              <button
                key={n.value}
                type="button"
                onClick={() => setNameStyle(n.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${nameStyle === n.value ? "border-violet-500 bg-violet-500/10 text-white" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}
              >
                {n.label} <span className="font-normal text-slate-400">· {n.sample}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-300 sm:col-span-2">
          <input type="checkbox" className="mt-0.5" checked={showMe} onChange={(e) => setShowMe(e.target.checked)} />
          <span>
            A trainee outside the top list still sees their own place
            <span className="block text-xs text-slate-500 mt-0.5">For example “🥇 … #5, then … #12 You”. It keeps the ones further down in the race.</span>
          </span>
        </label>
      </div>

      {error && <div className="text-sm text-red-300">{error}</div>}
      {message && <div className="text-sm text-emerald-300">{message}</div>}
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2"
      >
        💾 {saving ? "Saving…" : "Save Live Ranks"}
      </button>
    </fieldset>
  );
}
