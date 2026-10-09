// A drop-in for "render this admin-written HTML" on the employee side, with a small button that switches the text to
// Hinglish (Hindi in English letters) and back. The choice is remembered, so once someone prefers Hinglish every page
// they open follows it. The button only appears when translation has been switched on for the platform and the text has
// real words in it. The translated HTML is sanitised exactly like the original before it is shown.

import { useEffect, useState } from "react";
import { sanitizeHtml } from "../../utils/sanitizeHtml";
import { isTranslationAvailable, translateToHinglish, setContentLang, useContentLang } from "../../services/translate/hinglishService";

type Props = { html: string | null | undefined; className?: string } & Omit<React.HTMLAttributes<HTMLDivElement>, "dangerouslySetInnerHTML" | "children">;

const hasWords = (html: string) => /[A-Za-z]{3,}/.test(html.replace(/<[^>]*>/g, " "));

export default function TranslatableHtml({ html, className, ...rest }: Props) {
  const source = html ?? "";
  const lang = useContentLang();
  const [available, setAvailable] = useState(false);
  const [translated, setTranslated] = useState<{ for: string; html: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    isTranslationAvailable().then((ok) => alive && setAvailable(ok));
    return () => { alive = false; };
  }, []);

  const wantHinglish = lang === "hinglish" && available && hasWords(source);

  useEffect(() => {
    if (!wantHinglish) return;
    let alive = true;
    setBusy(true);
    setError("");
    translateToHinglish(source)
      .then((out) => alive && setTranslated({ for: source, html: out }))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Translation is not available right now."))
      .finally(() => alive && setBusy(false));
    return () => { alive = false; };
  }, [wantHinglish, source]);

  const showing = wantHinglish && translated && translated.for === source && !error ? translated.html : source;
  const canOffer = available && hasWords(source);

  return (
    <div>
      {canOffer && (
        <div className="mb-2 flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setContentLang(lang === "hinglish" ? "en" : "hinglish")}
            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 active:scale-95"
          >
            🌐 {lang === "hinglish" ? "English mein padhein" : "Hinglish mein padhein"}
          </button>
          {busy && <span className="text-xs text-slate-500">Hinglish mein badal raha hai…</span>}
          {error && <span className="text-xs text-amber-700">{error}</span>}
          {wantHinglish && !busy && !error && translated?.for === source && (
            <span className="text-[11px] text-slate-400">Auto-translated — kuch line thodi alag ho sakti hai</span>
          )}
        </div>
      )}
      <div className={className} dangerouslySetInnerHTML={{ __html: sanitizeHtml(showing) }} {...rest} />
    </div>
  );
}
