// Settings → Top Rank Titles: the words for the 1st / 2nd / 3rd best result. Everything is the trainer's own text.

import { useEffect, useState } from "react";
import { getCurrentQuizAdmin, canEditQuizContent } from "../../services/quiz/quizAdminSession";
import { getSettings, saveSettings, getDefaultRankTitles } from "../../repositories/quiz/quizSettingsRepository";
import { clearRankTitleCache } from "../../hooks/quiz/useRankTitleConfig";
import { parseRankTitles, RANK_BADGE_CLASS, RANK_TITLE_FIELDS, type RankTitle } from "../../utils/rankTitles";

const RANK_LABEL = ["🥇 Rank 1", "🥈 Rank 2", "🥉 Rank 3"];
const RANK_ACCENT = ["text-amber-300", "text-slate-200", "text-orange-300"];

function blank(): RankTitle {
  return { badge: "", title: "", message: "", cert_title: "", cert_line: "", cert_score: "" };
}

export default function QuizRankTitlesCard() {
  const admin = getCurrentQuizAdmin();
  const canEdit = canEditQuizContent();
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [titles, setTitles] = useState<RankTitle[]>([blank(), blank(), blank()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    getSettings(admin.company_id)
      .then((s) => {
        if (cancelled) return;
        const t = parseRankTitles(s.rank_titles);
        setEnabled(s.rank_titles_enabled !== false);
        setTitles([0, 1, 2].map((i) => t[i] ?? blank()));
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the rank titles."); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField(rank: number, key: keyof RankTitle, value: string) {
    setTitles((prev) => prev.map((t, i) => (i === rank ? { ...t, [key]: value } : t)));
  }

  async function handleSave() {
    if (!admin) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveSettings(admin.company_id, { rank_titles_enabled: enabled, rank_titles: titles });
      clearRankTitleCache();
      setMessage("Top rank titles saved.");
      setTimeout(() => setMessage(""), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Bring back the suggested wording? Your own text in these boxes is replaced (nothing is saved until you press Save).")) return;
    try {
      const t = await getDefaultRankTitles();
      setTitles([0, 1, 2].map((i) => t[i] ?? blank()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get the suggested wording.");
    }
  }

  if (!loaded) return null;

  return (
    <fieldset disabled={!canEdit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
      <div>
        <h2 className="font-semibold text-white">🏅 Top Rank Titles</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          The three best results of a quiz or exam get their own title instead of plain PASS — on the results, on the trainee's own screen and on the certificate.
          Everyone else who passed is still PASS. Only a pass can be a top rank. Change any word below.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Give the top 3 results their own title
      </label>

      <div className={`grid gap-4 lg:grid-cols-3 ${enabled ? "" : "opacity-50"}`}>
        {titles.map((t, rank) => (
          <div key={rank} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className={`text-xs font-bold uppercase tracking-wide ${RANK_ACCENT[rank]}`}>{RANK_LABEL[rank]}</div>
              {t.badge.trim() && (
                <span className={`inline-flex items-center whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${RANK_BADGE_CLASS[rank + 1]}`}>{t.badge}</span>
              )}
            </div>
            {RANK_TITLE_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">{f.label}</label>
                {f.multiline ? (
                  <textarea
                    rows={2}
                    maxLength={200}
                    value={t[f.key]}
                    onChange={(e) => setField(rank, f.key, e.target.value)}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-sm text-white outline-none focus:border-violet-500"
                  />
                ) : (
                  <input
                    maxLength={f.key === "cert_title" || f.key === "badge" ? 40 : 80}
                    value={t[f.key]}
                    onChange={(e) => setField(rank, f.key, e.target.value)}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-sm text-white outline-none focus:border-violet-500"
                  />
                )}
                <p className="mt-0.5 text-[10px] text-slate-600">{f.hint}</p>
              </div>
            ))}
            <div className="rounded-lg border border-amber-500/20 bg-slate-900 p-2 text-center">
              <div className="text-[9px] uppercase tracking-widest text-slate-500">Certificate preview</div>
              <div className="mt-0.5 font-serif text-sm font-bold text-amber-200">{t.cert_title || "—"}</div>
              <div className="text-[11px] text-slate-400">Asha Verma</div>
              <div className="text-[11px] text-slate-400">{t.cert_line || "—"}</div>
              <div className="text-[11px] font-semibold text-slate-300">RERA Basics Test</div>
              <div className="mt-0.5 text-[10px] font-semibold text-amber-300">92% — {t.cert_score || "PASS"}</div>
            </div>
          </div>
        ))}
      </div>

      {error && <div className="text-sm text-red-300">{error}</div>}
      {message && <div className="text-sm text-emerald-300">{message}</div>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2">
          💾 {saving ? "Saving…" : "Save Top Rank Titles"}
        </button>
        <button type="button" onClick={handleReset} className="rounded-lg border border-slate-700 text-slate-300 hover:text-white text-sm font-semibold px-4 py-2">
          ↺ Suggested wording
        </button>
      </div>
    </fieldset>
  );
}
