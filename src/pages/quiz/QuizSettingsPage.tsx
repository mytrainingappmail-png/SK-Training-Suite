import { useEffect, useRef, useState } from "react";

import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { getSettings, saveSettings } from "../../repositories/quiz/quizSettingsRepository";
import { renderCertificateToCanvas, CERT_TEMPLATE_LABELS } from "../../services/quiz/quizCertificateRenderer";
import { exportBackup, downloadBackupFile, parseBackupFile, importBackup } from "../../services/quiz/quizBackupService";
import type { QuizSettings, OptionColor, CertTemplate } from "../../types/quiz";

const OPTION_LABELS = ["A", "B", "C", "D"];
const CERT_TEMPLATES = Object.keys(CERT_TEMPLATE_LABELS) as CertTemplate[];

export default function QuizSettingsPage() {
  const me = getCurrentQuizAdmin();
  const [settings, setSettings] = useState<QuizSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceMessage, setAppearanceMessage] = useState("");
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingMessage, setBrandingMessage] = useState("");
  const [certSaving, setCertSaving] = useState(false);
  const [certMessage, setCertMessage] = useState("");
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const canEdit = canEditQuizContent();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [restoreSettings, setRestoreSettings] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [backupError, setBackupError] = useState("");

  useEffect(() => {
    if (!me) return;
    getSettings(me.company_id).then(setSettings).finally(() => setLoading(false));
  }, [me]);

  useEffect(() => {
    if (!settings || !previewCanvasRef.current) return;
    renderCertificateToCanvas(previewCanvasRef.current, settings.cert_template, {
      candidateName: "Jane Trainee",
      quizTitle: "Sample Quiz Title",
      scoreLine: "92% — PASS",
      certNumber: "CERT-PREVIEW01",
      issuedDate: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
      companyName: settings.cert_company_name || "Your Company",
      title: settings.cert_title,
      achievementLine: settings.cert_achievement_line,
      signatory1Name: settings.cert_signatory1_name,
      signatory1Title: settings.cert_signatory1_title,
      signatory2Name: settings.cert_signatory2_name,
      signatory2Title: settings.cert_signatory2_title,
    });
  }, [
    settings?.cert_template,
    settings?.cert_company_name,
    settings?.cert_title,
    settings?.cert_achievement_line,
    settings?.cert_signatory1_name,
    settings?.cert_signatory1_title,
    settings?.cert_signatory2_name,
    settings?.cert_signatory2_title,
  ]);

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

  async function handleSaveCert() {
    if (!me || !settings) return;
    setCertSaving(true);
    setCertMessage("");
    try {
      await saveSettings(me.company_id, {
        cert_template: settings.cert_template,
        cert_company_name: settings.cert_company_name,
        cert_title: settings.cert_title,
        cert_achievement_line: settings.cert_achievement_line,
        cert_signatory1_name: settings.cert_signatory1_name,
        cert_signatory1_title: settings.cert_signatory1_title,
        cert_signatory2_name: settings.cert_signatory2_name,
        cert_signatory2_title: settings.cert_signatory2_title,
      });
      setCertMessage("Certificate settings saved.");
    } finally {
      setCertSaving(false);
    }
  }

  async function handleExportBackup() {
    if (!me) return;
    setExporting(true);
    setBackupError("");
    setBackupMessage("");
    try {
      const backup = await exportBackup(me.company_id);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBackupFile(`live-quiz-backup-${stamp}.json`, backup);
      setBackupMessage(`Exported ${backup.quizzes.length} quiz(zes), ${backup.categories.length} categor(ies), ${backup.roster.length} roster entries.`);
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : "Could not export backup.");
    } finally {
      setExporting(false);
    }
  }

  function handleImportFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !me) return;

    setImporting(true);
    setBackupError("");
    setBackupMessage("");

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const backup = parseBackupFile(String(reader.result ?? ""));
        const result = await importBackup(me.company_id, me.id, backup, { restoreSettings });
        setBackupMessage(
          `Restored ${result.quizzesAdded} quiz(zes) (as drafts), ${result.categoriesAdded} new categor(ies), ${result.rosterAdded} new roster entries.`
        );
      } catch (e) {
        setBackupError(e instanceof Error ? e.message : "Could not restore this backup.");
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  }

  if (loading || !settings) return <div className="text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Appearance, branding and sound for the player view</p>
        {!canEdit && (
          <p className="text-xs text-amber-400 mt-1">👁 View only — you don't have permission to change these settings.</p>
        )}
      </div>

      {/* Appearance */}
      <fieldset disabled={!canEdit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
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
      </fieldset>

      {/* Branding */}
      <fieldset disabled={!canEdit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
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
      </fieldset>

      {/* Certificates */}
      <fieldset disabled={!canEdit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
        <div>
          <h2 className="font-semibold text-white">🏆 Certificate of Achievement</h2>
          <p className="text-xs text-slate-500 mt-0.5">Trainees who pass a quiz can download this as a PNG certificate</p>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Template</div>
          <div className="flex flex-wrap gap-2">
            {CERT_TEMPLATES.map((t) => (
              <button
                key={t}
                onClick={() => setSettings({ ...settings, cert_template: t })}
                className={`text-sm font-semibold rounded-lg px-3 py-2 border-2 transition-colors ${
                  settings.cert_template === t
                    ? "border-amber-400 bg-amber-400/10 text-amber-300"
                    : "border-slate-700 text-slate-300 hover:border-slate-600"
                }`}
              >
                {CERT_TEMPLATE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Company Name on Certificate</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={settings.cert_company_name ?? ""}
              onChange={(e) => setSettings({ ...settings, cert_company_name: e.target.value })}
              placeholder="Uses your LMS company name if blank"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Certificate Title</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={settings.cert_title}
              onChange={(e) => setSettings({ ...settings, cert_title: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Achievement Line</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={settings.cert_achievement_line}
              onChange={(e) => setSettings({ ...settings, cert_achievement_line: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Signatory 1 Name</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={settings.cert_signatory1_name ?? ""}
              onChange={(e) => setSettings({ ...settings, cert_signatory1_name: e.target.value })}
              placeholder="e.g. Siddharth Sharma"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Signatory 1 Title</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={settings.cert_signatory1_title ?? ""}
              onChange={(e) => setSettings({ ...settings, cert_signatory1_title: e.target.value })}
              placeholder="e.g. Founder & CEO"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Signatory 2 Name</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={settings.cert_signatory2_name ?? ""}
              onChange={(e) => setSettings({ ...settings, cert_signatory2_name: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Signatory 2 Title</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              value={settings.cert_signatory2_title ?? ""}
              onChange={(e) => setSettings({ ...settings, cert_signatory2_title: e.target.value })}
              placeholder="Optional"
            />
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Live Preview</div>
          <canvas ref={previewCanvasRef} className="w-full max-w-xl rounded-lg border border-slate-700" />
        </div>

        {certMessage && <div className="text-sm text-emerald-300">{certMessage}</div>}
        <button
          onClick={handleSaveCert}
          disabled={certSaving}
          className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2"
        >
          💾 {certSaving ? "Saving…" : "Save Certificate Settings"}
        </button>
      </fieldset>

      {/* Backup & Restore */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-white">💾 Backup & Restore</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Export everything you've built here — categories, trainee roster, quizzes with all their questions, and
            these settings — as one JSON file. Restoring never deletes or overwrites anything already here; quizzes
            come back in as drafts so you can review before publishing.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportBackup}
            disabled={exporting}
            className="text-sm font-semibold text-slate-200 border border-slate-700 bg-slate-800 hover:bg-slate-700 rounded-lg px-4 py-2 disabled:opacity-50"
          >
            ⬇ {exporting ? "Exporting…" : "Export Backup"}
          </button>

          {canEdit && (
            <label
              className={`text-sm font-semibold rounded-lg px-4 py-2 cursor-pointer ${
                importing ? "opacity-50 pointer-events-none" : ""
              } bg-amber-400 hover:bg-amber-300 text-amber-950`}
            >
              ⬆ {importing ? "Restoring…" : "Restore from Backup"}
              <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportFileSelected} />
            </label>
          )}
        </div>

        {canEdit && (
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={restoreSettings} onChange={(e) => setRestoreSettings(e.target.checked)} />
            Also overwrite current appearance/branding/certificate settings with the ones in the backup file
          </label>
        )}

        {backupMessage && <div className="text-sm text-emerald-300">{backupMessage}</div>}
        {backupError && (
          <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{backupError}</div>
        )}
      </div>
    </div>
  );
}
