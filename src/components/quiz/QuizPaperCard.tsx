// Quiz Settings -> "Answer paper": what happens to the trainee's answer paper (the review of every question) after a Live Quiz.
// This is the company default; any single quiz can choose differently in its own settings.

import { useEffect, useState } from "react";
import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { getSettings, saveSettings } from "../../repositories/quiz/quizSettingsRepository";
import type { PaperMode } from "../../types/quiz";

export const PAPER_MODES: { value: PaperMode; label: string; hint: string }[] = [
  { value: "release", label: "I release it", hint: "Trainees see their result right away, and the answer paper only when you press Release (and it goes again when you hide it, or after the minutes you set)." },
  { value: "auto", label: "Show it automatically", hint: "The answer paper appears on every trainee's screen right after the quiz, as it did before." },
  { value: "off", label: "Do not show it at all", hint: "Trainees never get the answer paper — good for strict tests." },
];

export default function QuizPaperCard() {
  const admin = getCurrentQuizAdmin();
  const canEdit = canEditQuizContent();
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<PaperMode>("release");
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!admin) return;
    getSettings(admin.company_id)
      .then((s) => { setMode((s.paper_release_mode as PaperMode) ?? "release"); setMinutes(s.paper_default_minutes ? String(s.paper_default_minutes) : ""); })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load."))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!admin) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const m = Math.round(Number(minutes));
      await saveSettings(admin.company_id, { paper_release_mode: mode, paper_default_minutes: Number.isFinite(m) && m > 0 ? Math.min(1440, m) : null });
      setMessage("Saved. It applies to quizzes launched from now on.");
      setTimeout(() => setMessage(""), 5000);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    finally { setSaving(false); }
  }

  if (!loaded) return null;
  return (
    <fieldset disabled={!canEdit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-white">📄 Answer Paper after a Live Quiz</h2>
        <p className="text-xs text-slate-500 mt-0.5">The answer paper is each trainee's review of every question (their answer, the right answer, the explanation). Choose when trainees get it. This is the default for every Live Quiz; any single quiz can choose differently in its own settings.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {PAPER_MODES.map((m) => (
          <label key={m.value} className={`cursor-pointer rounded-xl border-2 p-3 text-sm ${mode === m.value ? "border-amber-400 bg-amber-400/10" : "border-slate-700 hover:border-slate-600"}`}>
            <input type="radio" name="paper-mode" className="mr-2" checked={mode === m.value} onChange={() => setMode(m.value)} />
            <span className="font-semibold text-white">{m.label}</span>
            <span className="mt-1 block text-xs text-slate-400">{m.hint}</span>
          </label>
        ))}
      </div>
      <div className={mode === "release" ? "" : "opacity-50"}>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Close it by itself after (minutes) — optional</label>
        <input
          type="number" min={1} max={1440} value={minutes} placeholder="Until I hide it" disabled={mode !== "release"}
          onChange={(e) => setMinutes(e.target.value)}
          className="w-44 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
        />
        <p className="mt-1 text-[11px] text-slate-500">When you release the paper this number is filled in for you; you can change it each time. Leave it empty to keep the paper open until you hide it.</p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">{saving ? "Saving…" : "💾 Save"}</button>
        {message && <span className="text-xs text-emerald-300">{message}</span>}
        {error && <span className="text-xs text-red-300">{error}</span>}
      </div>
    </fieldset>
  );
}
