import { useEffect, useRef, useState } from "react";

import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { getSettings, saveSettings } from "../../repositories/quiz/quizSettingsRepository";
import {
  listCertTemplateDrafts,
  createCertTemplateDraft,
  updateCertTemplateDraft,
  deleteCertTemplateDraft,
  setActiveCertTemplateDraft,
} from "../../repositories/quiz/quizCertTemplatesRepository";
import { listQuizzes } from "../../repositories/quiz/quizRepository";
import { updateQuizMeta } from "../../services/quiz/quizService";
import { renderCertificateToCanvas, CERT_TEMPLATE_LABELS } from "../../services/quiz/quizCertificateRenderer";
import { exportBackup, downloadBackupFile, parseBackupFile, importBackup } from "../../services/quiz/quizBackupService";
import QuizBrandingImageField from "../../components/quiz/QuizBrandingImageField";
import type { QuizSettings, OptionColor, CertTemplate, CertTemplateDraft, Quiz } from "../../types/quiz";

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
  const [eligibilitySaving, setEligibilitySaving] = useState(false);
  const [eligibilityMessage, setEligibilityMessage] = useState("");
  const [drafts, setDrafts] = useState<CertTemplateDraft[]>([]);
  const [editingDraft, setEditingDraft] = useState<CertTemplateDraft | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [newDraftName, setNewDraftName] = useState("");
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [togglingQuizId, setTogglingQuizId] = useState<string | null>(null);
  const [messagesSaving, setMessagesSaving] = useState(false);
  const [messagesSavedMessage, setMessagesSavedMessage] = useState("");
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
    refreshDrafts();
    listQuizzes(me.company_id).then(setQuizzes);
  }, [me]);

  async function handleToggleQuizCertificate(quiz: Quiz, next: boolean) {
    setTogglingQuizId(quiz.id);
    try {
      const updated = await updateQuizMeta(quiz.id, { issue_certificate: next });
      setQuizzes((prev) => prev.map((q) => (q.id === quiz.id ? updated : q)));
    } finally {
      setTogglingQuizId(null);
    }
  }

  function refreshDrafts() {
    if (!me) return;
    listCertTemplateDrafts(me.company_id).then((rows) => {
      setDrafts(rows);
      setEditingDraft((current) => {
        if (current) {
          const stillThere = rows.find((r) => r.id === current.id);
          if (stillThere) return stillThere;
        }
        return rows.find((r) => r.is_active) ?? rows[0] ?? null;
      });
    });
  }

  useEffect(() => {
    if (!editingDraft || !previewCanvasRef.current) return;
    renderCertificateToCanvas(previewCanvasRef.current, editingDraft.template, {
      candidateName: "Jane Trainee",
      quizTitle: "Sample Quiz Title",
      scoreLine: "92% — PASS",
      certNumber: "CERT-PREVIEW01",
      issuedDate: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
      companyName: editingDraft.company_name || "Your Company",
      logoUrl: editingDraft.logo_url,
      logoPosition: editingDraft.logo_position,
      logoScale: editingDraft.logo_scale,
      title: editingDraft.title,
      achievementLine: editingDraft.achievement_line,
      signatory1Name: editingDraft.signatory1_name,
      signatory1Title: editingDraft.signatory1_title,
      signatory1ImageUrl: editingDraft.signatory1_image_url,
      signatory1Scale: editingDraft.signatory1_scale,
      signatory1NameScale: editingDraft.signatory1_name_scale,
      signatory2Name: editingDraft.signatory2_name,
      signatory2Title: editingDraft.signatory2_title,
      signatory2ImageUrl: editingDraft.signatory2_image_url,
      signatory2Scale: editingDraft.signatory2_scale,
      signatory2NameScale: editingDraft.signatory2_name_scale,
      signatureMode: editingDraft.signature_mode,
      signatureAlign: editingDraft.signature_align,
    }).catch(() => {
      // preview only — a failed render just leaves the canvas as-is
    });
  }, [editingDraft]);

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
        login_background_url: settings.login_background_url,
        login_banner_url: settings.login_banner_url,
        favicon_url: settings.favicon_url,
        footer_text: settings.footer_text,
      });
      setBrandingMessage("Branding saved.");
    } finally {
      setBrandingSaving(false);
    }
  }

  async function handleSaveEligibility() {
    if (!me || !settings) return;
    setEligibilitySaving(true);
    setEligibilityMessage("");
    try {
      await saveSettings(me.company_id, { cert_eligibility: settings.cert_eligibility });
      setEligibilityMessage("Saved.");
    } finally {
      setEligibilitySaving(false);
    }
  }

  async function handleSaveDraft() {
    if (!editingDraft) return;
    setDraftSaving(true);
    setDraftMessage("");
    try {
      const saved = await updateCertTemplateDraft(editingDraft.id, {
        name: editingDraft.name,
        template: editingDraft.template,
        company_name: editingDraft.company_name,
        logo_url: editingDraft.logo_url,
        logo_position: editingDraft.logo_position,
        logo_scale: editingDraft.logo_scale,
        title: editingDraft.title,
        achievement_line: editingDraft.achievement_line,
        signatory1_name: editingDraft.signatory1_name,
        signatory1_title: editingDraft.signatory1_title,
        signatory1_image_url: editingDraft.signatory1_image_url,
        signatory1_scale: editingDraft.signatory1_scale,
        signatory1_name_scale: editingDraft.signatory1_name_scale,
        signatory2_name: editingDraft.signatory2_name,
        signatory2_title: editingDraft.signatory2_title,
        signatory2_image_url: editingDraft.signatory2_image_url,
        signatory2_scale: editingDraft.signatory2_scale,
        signatory2_name_scale: editingDraft.signatory2_name_scale,
        signature_mode: editingDraft.signature_mode,
        signature_align: editingDraft.signature_align,
      });
      setEditingDraft(saved);
      setDrafts((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
      setDraftMessage("Draft saved.");
    } finally {
      setDraftSaving(false);
    }
  }

  async function handleCreateDraft() {
    if (!me || !newDraftName.trim()) return;
    setCreatingDraft(true);
    try {
      const created = await createCertTemplateDraft(me.company_id, newDraftName.trim(), editingDraft ?? undefined);
      if (drafts.length === 0) {
        await setActiveCertTemplateDraft(created.id);
      }
      setNewDraftName("");
      refreshDrafts();
      setEditingDraft(created);
    } finally {
      setCreatingDraft(false);
    }
  }

  async function handleSetActiveDraft(id: string) {
    await setActiveCertTemplateDraft(id);
    refreshDrafts();
  }

  async function handleDeleteDraft(draft: CertTemplateDraft) {
    if (draft.is_active) return;
    if (!window.confirm(`Delete the certificate draft "${draft.name}"? This can't be undone.`)) return;
    await deleteCertTemplateDraft(draft.id);
    refreshDrafts();
  }

  async function handleSaveMessages() {
    if (!me || !settings) return;
    setMessagesSaving(true);
    setMessagesSavedMessage("");
    try {
      await saveSettings(me.company_id, {
        result_pass_title: settings.result_pass_title,
        result_pass_message: settings.result_pass_message,
        result_improve_title: settings.result_improve_title,
        result_improve_message: settings.result_improve_message,
        result_fail_title: settings.result_fail_title,
        result_fail_message: settings.result_fail_message,
      });
      setMessagesSavedMessage("Result messages saved.");
    } finally {
      setMessagesSaving(false);
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

  if (loading || !settings || !me) return <div className="text-slate-500 text-sm">Loading…</div>;

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

        <QuizBrandingImageField
          label="Company Logo"
          hint="Upload an image instead of pasting a URL — this replaces the Logo URL above once uploaded."
          value={settings.brand_logo_url}
          kind="logo"
          companyId={me.company_id}
          onChange={(url) => setSettings({ ...settings, brand_logo_url: url })}
        />

        <div className="pt-2 border-t border-slate-800 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white">🖥️ Login Page Branding</h3>
            <p className="text-xs text-slate-500 mt-0.5">Shown on the Live Quiz admin login screen — leave blank to use the default look</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <QuizBrandingImageField
              label="Login Background Image"
              hint="Fills the page behind the login card"
              value={settings.login_background_url}
              kind="login-background"
              companyId={me.company_id}
              onChange={(url) => setSettings({ ...settings, login_background_url: url })}
              previewClassName="h-16 w-28 object-cover rounded-lg bg-slate-800 border border-slate-700"
            />
            <QuizBrandingImageField
              label="Login Banner Image"
              hint="Shown above the login form, inside the card — fitted to fill the width without cropping, whatever its shape"
              value={settings.login_banner_url}
              kind="login-banner"
              companyId={me.company_id}
              onChange={(url) => setSettings({ ...settings, login_banner_url: url })}
              previewClassName="h-16 w-28 object-contain rounded-lg bg-slate-800 border border-slate-700"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white">🔖 Favicon &amp; Footer</h3>
            <p className="text-xs text-slate-500 mt-0.5">Browser tab icon and a footer line shown across the Live Quiz app</p>
          </div>
          <QuizBrandingImageField
            label="Favicon"
            hint="Shown in the browser tab — a square image works best"
            value={settings.favicon_url}
            kind="favicon"
            companyId={me.company_id}
            onChange={(url) => setSettings({ ...settings, favicon_url: url })}
            previewClassName="h-10 w-10 object-contain rounded bg-slate-800 border border-slate-700"
          />
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Footer Text</label>
            <textarea
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              rows={2}
              value={settings.footer_text ?? ""}
              onChange={(e) => setSettings({ ...settings, footer_text: e.target.value })}
              placeholder="e.g. Siddharth & Kunal Enterprise, 123 Main Road, Gurugram — support@example.com"
            />
            <p className="text-[11px] text-slate-500 mt-1">Shown at the bottom of the admin panel and the trainee join screen — good for a company address or contact line.</p>
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
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Who gets a certificate</div>
          <p className="text-xs text-slate-500 mb-2">Make it a competition, or hand one to everyone who passes.</p>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { value: "all_pass", label: "Everyone who passes" },
                { value: "top1", label: "Only rank #1" },
                { value: "top3", label: "Top 3 ranks" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSettings({ ...settings, cert_eligibility: opt.value })}
                className={`text-sm font-semibold rounded-lg px-3 py-2 border-2 transition-colors ${
                  settings.cert_eligibility === opt.value
                    ? "border-amber-400 bg-amber-400/10 text-amber-300"
                    : "border-slate-700 text-slate-300 hover:border-slate-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={handleSaveEligibility}
              disabled={eligibilitySaving}
              className="text-xs font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800 disabled:opacity-50 rounded-lg px-3 py-2"
            >
              💾 {eligibilitySaving ? "Saving…" : "Save"}
            </button>
            {eligibilityMessage && <span className="text-xs text-emerald-300">{eligibilityMessage}</span>}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Certificate On/Off Per Quiz</div>
          <p className="text-xs text-slate-500 mb-3">Uncheck a quiz here to stop offering a certificate for it entirely — e.g. a practice quiz — regardless of score.</p>
          {quizzes.length === 0 ? (
            <p className="text-xs text-slate-500">No quizzes yet.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
              {quizzes.map((q) => (
                <label key={q.id} className="flex items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={q.issue_certificate}
                    disabled={togglingQuizId === q.id}
                    onChange={(e) => handleToggleQuizCertificate(q, e.target.checked)}
                    className="h-4 w-4 accent-violet-500"
                  />
                  <span className="flex-1 truncate">{q.title}</span>
                  <span className={`text-[11px] font-semibold ${q.issue_certificate ? "text-emerald-400" : "text-slate-500"}`}>
                    {q.issue_certificate ? "Issues certificate" : "No certificate"}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-800">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Certificate Designs</div>
          <p className="text-xs text-slate-500 mb-3">Tick the box next to a design to make it the one that downloads — logo, names, company name and everything else can differ per design.</p>

          <div className="space-y-1.5">
            {drafts.map((d) => (
              <div
                key={d.id}
                className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${
                  editingDraft?.id === d.id ? "border-violet-500 bg-violet-500/10" : "border-slate-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={d.is_active}
                  disabled={d.is_active}
                  onChange={() => handleSetActiveDraft(d.id)}
                  title={d.is_active ? "This design is active" : "Make this the active design"}
                  className="h-4 w-4 accent-emerald-500"
                />
                <button onClick={() => setEditingDraft(d)} className="flex-1 text-left text-sm font-semibold text-white">
                  {d.name}
                </button>
                {d.is_active && <span className="text-xs font-semibold text-emerald-400">● Active — this is what downloads</span>}
                <button onClick={() => setEditingDraft(d)} className="text-xs font-semibold text-slate-300 hover:underline">
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteDraft(d)}
                  disabled={d.is_active || drafts.length <= 1}
                  title={d.is_active ? "Make another design active first" : drafts.length <= 1 ? "You need at least one design" : "Delete this design"}
                  className="text-xs font-semibold text-red-300 hover:underline disabled:text-slate-600 disabled:no-underline disabled:cursor-not-allowed"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          {canEdit && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={newDraftName}
                onChange={(e) => setNewDraftName(e.target.value)}
                placeholder={drafts.length === 0 ? "e.g. Draft 1" : "e.g. Draft 2 — Gold Seal"}
                className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 flex-1 min-w-[180px]"
              />
              <button
                onClick={handleCreateDraft}
                disabled={creatingDraft || !newDraftName.trim()}
                className="text-sm font-semibold text-slate-200 border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg px-4 py-2"
              >
                + Add Draft{drafts.length > 0 ? " (copies the one you're viewing)" : ""}
              </button>
            </div>
          )}
        </div>

        {!editingDraft ? (
          <p className="text-sm text-slate-400 pt-2 border-t border-slate-800">No certificate design yet — create your first draft above.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <input
                value={editingDraft.name}
                onChange={(e) => setEditingDraft({ ...editingDraft, name: e.target.value })}
                className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-violet-500"
              />
              {editingDraft.is_active ? (
                <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                  ● Currently Active — this is what downloads
                </span>
              ) : (
                <span className="text-xs font-semibold text-slate-400 border border-slate-700 rounded-lg px-3 py-2">
                  Tick this design's checkbox above to make it active
                </span>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Template</div>
              <div className="flex flex-wrap gap-2">
                {CERT_TEMPLATES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setEditingDraft({ ...editingDraft, template: t })}
                    className={`text-sm font-semibold rounded-lg px-3 py-2 border-2 transition-colors ${
                      editingDraft.template === t
                        ? "border-amber-400 bg-amber-400/10 text-amber-300"
                        : "border-slate-700 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    {CERT_TEMPLATE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-3">
              <QuizBrandingImageField
                label="Certificate Logo"
                hint="Optional — your company logo or a seal/crest, shown on the certificate itself. Kept in its own colors (not recolored like signatures)."
                value={editingDraft.logo_url}
                kind="cert-logo"
                companyId={me.company_id}
                onChange={(url) => setEditingDraft({ ...editingDraft, logo_url: url })}
                previewClassName="h-16 w-32 object-contain rounded-lg bg-white border border-slate-700"
              />
              {editingDraft.logo_url && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Logo Placement</div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { value: "top_center", label: "Top Center" },
                        { value: "top_left", label: "Top Left" },
                        { value: "top_right", label: "Top Right" },
                        { value: "watermark", label: "Watermark" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setEditingDraft({ ...editingDraft, logo_position: opt.value })}
                        className={`text-sm font-semibold rounded-lg px-3 py-2 border-2 transition-colors ${
                          editingDraft.logo_position === opt.value
                            ? "border-amber-400 bg-amber-400/10 text-amber-300"
                            : "border-slate-700 text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {editingDraft.logo_url && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Logo size:</span>
                  <button
                    type="button"
                    onClick={() => setEditingDraft({ ...editingDraft, logo_scale: Math.max(50, editingDraft.logo_scale - 10) })}
                    className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                  >
                    −
                  </button>
                  <span className="font-mono text-xs text-white min-w-[2.5rem] text-center">{editingDraft.logo_scale}%</span>
                  <button
                    type="button"
                    onClick={() => setEditingDraft({ ...editingDraft, logo_scale: Math.min(200, editingDraft.logo_scale + 10) })}
                    className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Company Name on Certificate</label>
                <input
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  value={editingDraft.company_name ?? ""}
                  onChange={(e) => setEditingDraft({ ...editingDraft, company_name: e.target.value })}
                  placeholder="Uses your LMS company name if blank"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Certificate Title</label>
                <input
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  value={editingDraft.title}
                  onChange={(e) => setEditingDraft({ ...editingDraft, title: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Achievement Line</label>
                <input
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  value={editingDraft.achievement_line}
                  onChange={(e) => setEditingDraft({ ...editingDraft, achievement_line: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Signatory 1 Name</label>
                <input
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  value={editingDraft.signatory1_name ?? ""}
                  onChange={(e) => setEditingDraft({ ...editingDraft, signatory1_name: e.target.value })}
                  placeholder="e.g. Siddharth Sharma"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Signatory 1 Title</label>
                <input
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  value={editingDraft.signatory1_title ?? ""}
                  onChange={(e) => setEditingDraft({ ...editingDraft, signatory1_title: e.target.value })}
                  placeholder="e.g. Founder & CEO"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Signatory 2 Name</label>
                <input
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  value={editingDraft.signatory2_name ?? ""}
                  onChange={(e) => setEditingDraft({ ...editingDraft, signatory2_name: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Signatory 2 Title</label>
                <input
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  value={editingDraft.signatory2_title ?? ""}
                  onChange={(e) => setEditingDraft({ ...editingDraft, signatory2_title: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-3">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Signature Layout</div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { value: "both", label: "Both Signatures" },
                      { value: "single", label: "Single Signature Only" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditingDraft({ ...editingDraft, signature_mode: opt.value })}
                      className={`text-sm font-semibold rounded-lg px-3 py-2 border-2 transition-colors ${
                        editingDraft.signature_mode === opt.value
                          ? "border-amber-400 bg-amber-400/10 text-amber-300"
                          : "border-slate-700 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {editingDraft.signature_mode === "single"
                    ? "Only Signatory 1 is shown on the certificate — Signatory 2's details below are ignored."
                    : "Both signatories are shown side by side, as before."}
                </p>
              </div>

              {editingDraft.signature_mode === "single" && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Signature Alignment</div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { value: "left", label: "Left" },
                        { value: "center", label: "Center" },
                        { value: "right", label: "Right" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditingDraft({ ...editingDraft, signature_align: opt.value })}
                        className={`text-sm font-semibold rounded-lg px-3 py-2 border-2 transition-colors ${
                          editingDraft.signature_align === opt.value
                            ? "border-amber-400 bg-amber-400/10 text-amber-300"
                            : "border-slate-700 text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <div>
                <QuizBrandingImageField
                  label="Signatory 1 Signature"
                  hint="Upload a scanned/transparent signature image — shown above the name on the certificate. Preview below is on a white card since most scanned signatures are dark ink; on the certificate itself it's auto-recolored to match the template."
                  value={editingDraft.signatory1_image_url}
                  kind="signatory-1"
                  companyId={me.company_id}
                  onChange={(url) => setEditingDraft({ ...editingDraft, signatory1_image_url: url })}
                  previewClassName="h-20 w-48 object-contain rounded-lg bg-white border border-slate-700"
                />
                {editingDraft.signatory1_image_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Signature image size:</span>
                    <button
                      type="button"
                      onClick={() => setEditingDraft({ ...editingDraft, signatory1_scale: Math.max(50, editingDraft.signatory1_scale - 10) })}
                      className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                    >
                      −
                    </button>
                    <span className="font-mono text-xs text-white min-w-[2.5rem] text-center">{editingDraft.signatory1_scale}%</span>
                    <button
                      type="button"
                      onClick={() => setEditingDraft({ ...editingDraft, signatory1_scale: Math.min(150, editingDraft.signatory1_scale + 10) })}
                      className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                    >
                      +
                    </button>
                  </div>
                )}
                {editingDraft.signatory1_name && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Name text size:</span>
                    <button
                      type="button"
                      onClick={() => setEditingDraft({ ...editingDraft, signatory1_name_scale: Math.max(50, editingDraft.signatory1_name_scale - 10) })}
                      className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                    >
                      −
                    </button>
                    <span className="font-mono text-xs text-white min-w-[2.5rem] text-center">{editingDraft.signatory1_name_scale}%</span>
                    <button
                      type="button"
                      onClick={() => setEditingDraft({ ...editingDraft, signatory1_name_scale: Math.min(150, editingDraft.signatory1_name_scale + 10) })}
                      className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
              <div>
                {editingDraft.signature_mode === "single" && editingDraft.signatory1_name && (
                  <p className="mb-2 text-[11px] text-amber-400">
                    ⚠ Signature Layout is set to "Single Signature Only" and Signatory 1 has a name, so Signatory 2 is not drawn on the certificate — none of these fields (including size) will visibly change anything until you either switch to "Both Signatures" or clear Signatory 1's name.
                  </p>
                )}
                <QuizBrandingImageField
                  label="Signatory 2 Signature"
                  hint="Optional — same as above, for the second signatory"
                  value={editingDraft.signatory2_image_url}
                  kind="signatory-2"
                  companyId={me.company_id}
                  onChange={(url) => setEditingDraft({ ...editingDraft, signatory2_image_url: url })}
                  previewClassName="h-20 w-48 object-contain rounded-lg bg-white border border-slate-700"
                />
                {editingDraft.signatory2_image_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Signature image size:</span>
                    <button
                      type="button"
                      onClick={() => setEditingDraft({ ...editingDraft, signatory2_scale: Math.max(50, editingDraft.signatory2_scale - 10) })}
                      className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                    >
                      −
                    </button>
                    <span className="font-mono text-xs text-white min-w-[2.5rem] text-center">{editingDraft.signatory2_scale}%</span>
                    <button
                      type="button"
                      onClick={() => setEditingDraft({ ...editingDraft, signatory2_scale: Math.min(150, editingDraft.signatory2_scale + 10) })}
                      className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                    >
                      +
                    </button>
                  </div>
                )}
                {editingDraft.signatory2_name && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Name text size:</span>
                    <button
                      type="button"
                      onClick={() => setEditingDraft({ ...editingDraft, signatory2_name_scale: Math.max(50, editingDraft.signatory2_name_scale - 10) })}
                      className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                    >
                      −
                    </button>
                    <span className="font-mono text-xs text-white min-w-[2.5rem] text-center">{editingDraft.signatory2_name_scale}%</span>
                    <button
                      type="button"
                      onClick={() => setEditingDraft({ ...editingDraft, signatory2_name_scale: Math.min(150, editingDraft.signatory2_name_scale + 10) })}
                      className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-sm"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Live Preview</div>
              <canvas ref={previewCanvasRef} className="w-full max-w-xl rounded-lg border border-slate-700" />
            </div>

            {draftMessage && <div className="text-sm text-emerald-300">{draftMessage}</div>}
            <button
              onClick={handleSaveDraft}
              disabled={draftSaving}
              className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2"
            >
              💾 {draftSaving ? "Saving…" : "Save This Draft"}
            </button>
          </>
        )}
      </fieldset>

      {/* Result Messages */}
      <fieldset disabled={!canEdit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
        <div>
          <h2 className="font-semibold text-white">🎯 Result Messages</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            What a trainee sees at the end of a quiz, based on their own grade — write these however fits your team
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide text-emerald-300">🏆 Pass / Champion</div>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              value={settings.result_pass_title ?? ""}
              onChange={(e) => setSettings({ ...settings, result_pass_title: e.target.value })}
              placeholder="🏆 Champion!"
            />
            <textarea
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              rows={2}
              value={settings.result_pass_message ?? ""}
              onChange={(e) => setSettings({ ...settings, result_pass_message: e.target.value })}
              placeholder="Outstanding performance — you've mastered this!"
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide text-amber-300">📈 Need Improvement</div>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
              value={settings.result_improve_title ?? ""}
              onChange={(e) => setSettings({ ...settings, result_improve_title: e.target.value })}
              placeholder="📈 Need Improvement"
            />
            <textarea
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
              rows={2}
              value={settings.result_improve_message ?? ""}
              onChange={(e) => setSettings({ ...settings, result_improve_message: e.target.value })}
              placeholder="Good effort — review the material and try again!"
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide text-red-300">💪 Fail</div>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
              value={settings.result_fail_title ?? ""}
              onChange={(e) => setSettings({ ...settings, result_fail_title: e.target.value })}
              placeholder="💪 Keep Practicing"
            />
            <textarea
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-red-500"
              rows={2}
              value={settings.result_fail_message ?? ""}
              onChange={(e) => setSettings({ ...settings, result_fail_message: e.target.value })}
              placeholder="Don't worry — review the material and retake the quiz when ready."
            />
          </div>
        </div>

        {messagesSavedMessage && <div className="text-sm text-emerald-300">{messagesSavedMessage}</div>}
        <button
          onClick={handleSaveMessages}
          disabled={messagesSaving}
          className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2"
        >
          💾 {messagesSaving ? "Saving…" : "Save Result Messages"}
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
