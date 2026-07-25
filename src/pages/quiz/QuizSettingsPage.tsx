import { useEffect, useState } from "react";

import { getCurrentQuizAdmin } from "../../services/quiz/quizAdminSession";
import { getSettings, saveSettings } from "../../repositories/quiz/quizSettingsRepository";
import type { QuizSettings, OptionColor } from "../../types/quiz";

const OPTION_LABELS = ["A", "B", "C", "D"];

export default function QuizSettingsPage() {
  const me = getCurrentQuizAdmin();
  const [settings, setSettings] = useState<QuizSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceMessage, setAppearanceMessage] = useState("");
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingMessage, setBrandingMessage] = useState("");

  useEffect(() => {
    if (!me) return;
    getSettings(me.company_id).then(setSettings).finally(() => setLoading(false));
  }, [me]);

  function updateOptionColor(index: number, field: "box" | "font", value: string) {
    if (!settings) return;
    const colors = settings.option_colors.slice();
    colors[index] = { ...colors[index], [field]: value };
    setSettings({ ...settings, option_colors: colors });
  }

  async function handleSaveAppearance() {
    if (!me || !settings) return;
    setAppearanceSaving(true);
    setAppearanceMessage("");
    try {
      await saveSettings(me.company_id, {
        option_font_size: settings.option_font_size,
        option_colors: settings.option_colors,
        sound_enabled: settings.sound_enabled,
      });
      setAppearanceMessage("Appearance saved.");
    } finally {
      setAppearanceSaving(false);
    }
  }

  function resetAppearance() {
    if (!settings) return;
    const defaults: OptionColor[] = [
      { box: "#DC2626", font: "#FFFFFF" },
      { box: "#2563EB", font: "#FFFFFF" },
      { box: "#16A34A", font: "#FFFFFF" },
      { box: "#78350F", font: "#FFFFFF" },
    ];
    setSettings({ ...settings, option_font_size: 16, option_colors: defaults });
  }

  async function handleSaveBranding() {
    if (!me || !settings) return;
    setBrandingSaving(true);
    setBrandingMessage("");
    try {
      await saveSettings(me.company_id, {
        brand_name: settings.brand_name,
        brand_tagline: settings.brand_tagline,
        brand_logo_url: settings.brand_logo_url,
      });
      setBrandingMessage("Branding saved.");
    } finally {
      setBrandingSaving(false);
    }
  }

  if (loading || !settings) return <div className="text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Appearance, branding and sound for the player view</p>
      </div>

      {/* Appearance */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
        <h2 className="font-semibold text-white">🎨 Quiz Appearance (Player View)</h2>

        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Option Font Size</div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSettings({ ...settings, option_font_size: Math.max(10, settings.option_font_size - 1) })}
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
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Option Colors</div>
          <div className="space-y-2">
            {settings.option_colors.map((c, i) => (
              <div key={i} className="flex items-center gap-3 flex-wrap">
                <span className="font-bold text-white w-4">{OPTION_LABELS[i]}</span>
                <span className="text-xs text-slate-400">Box:</span>
                <input
                  type="color"
                  value={c.box}
                  onChange={(e) => updateOptionColor(i, "box", e.target.value)}
                  className="h-8 w-12 rounded border border-slate-700 bg-transparent"
                />
                <span className="text-xs text-slate-400">Font:</span>
                <input
                  type="color"
                  value={c.font}
                  onChange={(e) => updateOptionColor(i, "font", e.target.value)}
                  className="h-8 w-12 rounded border border-slate-700 bg-transparent"
                />
                <span
                  className="px-4 py-1.5 rounded-lg font-bold text-sm"
                  style={{ backgroundColor: c.box, color: c.font, fontSize: settings.option_font_size }}
                >
                  Preview
                </span>
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={settings.sound_enabled}
            onChange={(e) => setSettings({ ...settings, sound_enabled: e.target.checked })}
          />
          🔊 Sound effects (question pops, timer ticks, correct/wrong tones)
        </label>

        {appearanceMessage && <div className="text-sm text-emerald-300">{appearanceMessage}</div>}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleSaveAppearance}
            disabled={appearanceSaving}
            className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2"
          >
            💾 {appearanceSaving ? "Saving…" : "Save Appearance"}
          </button>
          <button
            onClick={resetAppearance}
            className="rounded-lg border border-slate-700 text-slate-300 hover:text-white text-sm px-4 py-2"
          >
            ↩ Reset to Default
          </button>
        </div>
      </div>

      {/* Branding */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-white">🏢 Company Branding (White-Label)</h2>
          <p className="text-xs text-slate-500 mt-0.5">Customise the app name, logo and tagline shown to admins and trainees</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Company Name</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={settings.brand_name ?? ""}
              onChange={(e) => setSettings({ ...settings, brand_name: e.target.value })}
              placeholder="Uses your LMS company name if blank"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Tagline</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={settings.brand_tagline ?? ""}
              onChange={(e) => setSettings({ ...settings, brand_tagline: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Logo URL</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={settings.brand_logo_url ?? ""}
              onChange={(e) => setSettings({ ...settings, brand_logo_url: e.target.value })}
              placeholder="https://…"
            />
          </div>
        </div>
        {brandingMessage && <div className="text-sm text-emerald-300">{brandingMessage}</div>}
        <button
          onClick={handleSaveBranding}
          disabled={brandingSaving}
          className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2"
        >
          💾 {brandingSaving ? "Saving…" : "Save Branding"}
        </button>
      </div>
    </div>
  );
}
