// Settings → Background behind the questions: a faded logo / the trainer's own image (and optionally each trainee's own name) behind
// the question on the trainee's screen. The strength can only be set inside a range that keeps the text readable, and the phone
// preview below shows exactly what a trainee will see. A single quiz or exam can follow this, switch it off or use its own image.

import { useEffect, useState } from "react";
import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { getSettings, saveSettings } from "../../repositories/quiz/quizSettingsRepository";
import { backgroundStyle } from "../../utils/quizBackground";
import QuizBrandingImageField from "./QuizBrandingImageField";
import {
  QUIZ_BG_NAME_OPACITY_MAX,
  QUIZ_BG_NAME_OPACITY_MIN,
  QUIZ_BG_OPACITY_MAX,
  QUIZ_BG_OPACITY_MIN,
  type QuizBackgroundKind,
  type QuizBackgroundLayout,
} from "../../types/quiz";

const KINDS: { value: QuizBackgroundKind; label: string; hint: string }[] = [
  { value: "none", label: "Plain", hint: "No background (as it is today)" },
  { value: "logo", label: "Company logo", hint: "The logo from Company Branding, faded (looks best on a transparent PNG)" },
  { value: "image", label: "My own image", hint: "Any picture you upload" },
];

const LAYOUTS: { value: QuizBackgroundLayout; label: string }[] = [
  { value: "center", label: "Centre, one big" },
  { value: "tile", label: "Repeated small" },
  { value: "corner", label: "Bottom corner" },
  { value: "fill", label: "Fill the screen" },
];

const PREVIEW_WIDTH = 210;
const OPTION_SAMPLE = ["#DC2626", "#2563EB", "#16A34A", "#78350F"];

export default function QuizBackgroundCard() {
  const admin = getCurrentQuizAdmin();
  const canEdit = canEditQuizContent();
  const [loaded, setLoaded] = useState(false);
  const [kind, setKind] = useState<QuizBackgroundKind>("none");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(10);
  const [layout, setLayout] = useState<QuizBackgroundLayout>("center");
  const [nameOn, setNameOn] = useState(false);
  const [nameOpacity, setNameOpacity] = useState(6);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    getSettings(admin.company_id)
      .then((s) => {
        if (cancelled) return;
        setKind(s.bg_kind ?? "none");
        setImageUrl(s.bg_image_url ?? null);
        setLogoUrl(s.brand_logo_url ?? null);
        setOpacity(s.bg_opacity ?? 10);
        setLayout(s.bg_layout ?? "center");
        setNameOn(s.bg_name_watermark ?? false);
        setNameOpacity(s.bg_name_opacity ?? 6);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the background settings."); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!admin) return;
    if (kind === "image" && !imageUrl) { setError("Upload the image first, or choose Plain / Company logo."); return; }
    if (kind === "logo" && !logoUrl) { setError("There is no company logo yet. Upload one under Company Branding first, or choose another option."); return; }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveSettings(admin.company_id, {
        bg_kind: kind,
        bg_image_url: imageUrl,
        bg_opacity: opacity,
        bg_layout: layout,
        bg_name_watermark: nameOn,
        bg_name_opacity: nameOpacity,
      });
      setMessage("Background saved. Trainees see it from their next question.");
      setTimeout(() => setMessage(""), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  const url = kind === "logo" ? logoUrl : kind === "image" ? imageUrl : null;
  // the preview sits inside the page, so the background must scroll with it (a "fixed" one would follow the browser window)
  const previewStyle = backgroundStyle(
    { kind, url, opacity, layout, name_watermark: nameOn, name_opacity: nameOpacity },
    "Rahul Sharma",
    PREVIEW_WIDTH
  );

  return (
    <fieldset disabled={!canEdit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
      <div>
        <h2 className="font-semibold text-white">🖼️ Background behind the Questions</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          A soft logo or picture behind the question on the trainee's phone. It is always kept faint and under a dark layer, so the question and options stay easy to read.
          Any single quiz or exam can follow this, use none, or have its own image (in its own settings).
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4 min-w-0">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">What to show</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={`text-left rounded-xl border px-3 py-2 ${kind === k.value ? "border-violet-500 bg-violet-500/10" : "border-slate-700 hover:border-slate-500"}`}
                >
                  <div className="text-sm font-semibold text-white">{k.label}</div>
                  <div className="text-[11px] text-slate-400">{k.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {kind === "image" && admin && (
            <QuizBrandingImageField
              label="Background image"
              hint="PNG, JPG or WebP, up to 5 MB. A logo on a transparent background (PNG) or a soft picture works best - a logo on a white box shows as a faint box."
              value={imageUrl}
              kind="screen-background"
              companyId={admin.company_id}
              onChange={setImageUrl}
            />
          )}

          {kind !== "none" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Where it sits</label>
                <div className="flex flex-wrap gap-2">
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setLayout(l.value)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${layout === l.value ? "border-violet-500 bg-violet-500/10 text-white" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  How strong: {opacity}% <span className="font-normal normal-case text-slate-500">(allowed {QUIZ_BG_OPACITY_MIN}–{QUIZ_BG_OPACITY_MAX}% so the text stays readable)</span>
                </label>
                <input type="range" min={QUIZ_BG_OPACITY_MIN} max={QUIZ_BG_OPACITY_MAX} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-violet-500" />
              </div>
            </>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
            <label className="flex items-start gap-2 text-sm text-slate-300">
              <input type="checkbox" className="mt-0.5" checked={nameOn} onChange={(e) => setNameOn(e.target.checked)} />
              <span>
                🔒 Show each trainee's own name faintly across the screen
                <span className="block text-xs text-slate-500 mt-0.5">
                  If a screenshot of a question is shared, it shows whose phone it came from. Works with or without a picture.
                </span>
              </span>
            </label>
            {nameOn && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Name strength: {nameOpacity}% <span className="font-normal text-slate-500">(allowed {QUIZ_BG_NAME_OPACITY_MIN}–{QUIZ_BG_NAME_OPACITY_MAX}%)</span>
                </label>
                <input type="range" min={QUIZ_BG_NAME_OPACITY_MIN} max={QUIZ_BG_NAME_OPACITY_MAX} value={nameOpacity} onChange={(e) => setNameOpacity(Number(e.target.value))} className="w-full accent-violet-500" />
              </div>
            )}
          </div>
        </div>

        {/* what a trainee sees */}
        <div className="mx-auto lg:mx-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5 text-center">Trainee's phone</div>
          <div
            className="w-[210px] rounded-[26px] border-4 border-slate-700 bg-slate-950 px-3 py-4 flex flex-col gap-2.5 overflow-hidden"
            style={{ ...previewStyle, backgroundAttachment: "scroll", minHeight: 330 }}
          >
            <div className="text-[10px] text-slate-400 font-semibold">Question 3 of 10 · 18s</div>
            <div className="text-sm font-semibold text-white leading-snug">Which document confirms the builder's right to sell?</div>
            <div className="mt-1 grid gap-1.5">
              {["Registry", "RERA registration", "Sale agreement", "Allotment letter"].map((t, i) => (
                <div key={t} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-white" style={{ background: OPTION_SAMPLE[i] }}>{t}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-red-300">{error}</div>}
      {message && <div className="text-sm text-emerald-300">{message}</div>}
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2"
      >
        💾 {saving ? "Saving…" : "Save Background"}
      </button>
    </fieldset>
  );
}
