import { useEffect, useState } from "react";

import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { getSurveySettings, saveSurveySettings } from "../../repositories/survey/surveyRepository";
import type { SurveySettings } from "../../types/survey";

export default function SurveySettingsPage() {
  const me = getCurrentQuizAdmin();
  const canEdit = canEditQuizContent();
  const [settings, setSettings] = useState<SurveySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!me) return;
    getSurveySettings(me.company_id).then(setSettings).finally(() => setLoading(false));
  }, [me]);

  function updateColor(index: number, field: "box" | "font", value: string) {
    if (!settings) return;
    const colors = settings.option_colors.slice();
    colors[index] = { ...colors[index], [field]: value };
    setSettings({ ...settings, option_colors: colors });
  }

  function addColor() {
    if (!settings) return;
    setSettings({ ...settings, option_colors: [...settings.option_colors, { box: "#64748B", font: "#FFFFFF" }] });
  }

  function removeColor(index: number) {
    if (!settings || settings.option_colors.length <= 1) return;
    setSettings({ ...settings, option_colors: settings.option_colors.filter((_, i) => i !== index) });
  }

  async function handleSave() {
    if (!me || !settings) return;
    setSaving(true);
    setMessage("");
    try {
      await saveSurveySettings(me.company_id, { option_font_size: settings.option_font_size, option_colors: settings.option_colors });
      setMessage("Saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) return <div className="text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Survey Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Appearance for the respondent's screen — separate from Live Quiz's own settings.</p>
        {!canEdit && <p className="text-xs text-amber-400 mt-1">👁 View only — you don't have permission to change these settings.</p>}
      </div>

      <fieldset disabled={!canEdit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
        <h2 className="font-semibold text-white">🎨 Option Appearance</h2>

        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Option Font Size</div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSettings({ ...settings, option_font_size: Math.max(12, settings.option_font_size - 1) })}
              className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold"
            >
              −
            </button>
            <span className="font-mono font-bold text-white min-w-[3rem] text-center">{settings.option_font_size}px</span>
            <button
              onClick={() => setSettings({ ...settings, option_font_size: Math.min(28, settings.option_font_size + 1) })}
              className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Choice Option Colors</div>
          <p className="text-xs text-slate-500 mb-2">Cycled across single/multi-choice options on the survey — add as many as you like.</p>
          <div className="space-y-2">
            {settings.option_colors.map((c, i) => (
              <div key={i} className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-400">Box:</span>
                <input type="color" value={c.box} onChange={(e) => updateColor(i, "box", e.target.value)} className="h-8 w-12 rounded border border-slate-700 bg-transparent" />
                <span className="text-xs text-slate-400">Font:</span>
                <input type="color" value={c.font} onChange={(e) => updateColor(i, "font", e.target.value)} className="h-8 w-12 rounded border border-slate-700 bg-transparent" />
                <span className="px-4 py-1.5 rounded-lg font-bold text-sm" style={{ backgroundColor: c.box, color: c.font, fontSize: settings.option_font_size }}>
                  Preview
                </span>
                <button onClick={() => removeColor(i)} disabled={settings.option_colors.length <= 1} className="text-xs text-red-300 hover:text-red-200 disabled:opacity-30 ml-auto">
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button onClick={addColor} className="mt-3 text-xs font-semibold text-violet-300 hover:text-violet-200">+ Add Color</button>
        </div>

        {message && <div className="text-sm text-emerald-300">{message}</div>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2"
        >
          💾 {saving ? "Saving…" : "Save Settings"}
        </button>
      </fieldset>
    </div>
  );
}
