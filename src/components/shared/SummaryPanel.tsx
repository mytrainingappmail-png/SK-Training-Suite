// "⚡ Summarise" for long reading content: one button above the text; the summary opens right there and can be hidden again. The
// length follows the article (decided on the server). Hidden for short texts. Follows the reader's language choice (English /
// Hinglish). The summary is a quick look - the full text stays the reference.

import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { htmlToText } from '../../utils/htmlToText';
import { useContentLang } from '../../services/translate/hinglishService';
import { summarizeText, SummaryError } from '../../services/summary/summaryService';
import type { SummaryResult } from '../../services/summary/summaryService';

const MIN_WORDS = 150;

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="font-bold text-slate-900">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
}

/** Headings (## ...), bullets (- ...) and **bold** - nothing else is interpreted, so nothing can inject markup. */
function SummaryBody({ text }: { text: string }) {
  const blocks: ReactElement[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length === 0) return;
    blocks.push(<ul key={`u${blocks.length}`} className="ml-5 list-disc space-y-1 text-sm leading-relaxed text-slate-700">{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>);
    bullets = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#{1,4}\s/.test(line)) { flush(); blocks.push(<h4 key={`h${blocks.length}`} className="mt-4 text-sm font-bold text-indigo-900 first:mt-0">{inline(line.replace(/^#{1,4}\s+/, ''))}</h4>); }
    else if (/^[-*•]\s+/.test(line)) bullets.push(line.replace(/^[-*•]\s+/, ''));
    else { flush(); blocks.push(<p key={`p${blocks.length}`} className="text-sm leading-relaxed text-slate-700">{inline(line)}</p>); }
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

export default function SummaryPanel({ html, label = '⚡ Summarise' }: { html: string; label?: string }) {
  const text = useMemo(() => htmlToText(html), [html]);
  const words = useMemo(() => (text.match(/\S+/g) ?? []).length, [text]);
  const lang = useContentLang() === 'hinglish' ? 'hinglish' : 'english';
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notInPlan, setNotInPlan] = useState(false);
  const [results, setResults] = useState<Record<string, SummaryResult>>({});

  if (words < MIN_WORDS || notInPlan) return null;
  const current = results[lang];

  async function ask() {
    setError('');
    if (current) { setOpen(true); return; }
    setOpen(true); setBusy(true);
    try { const r = await summarizeText(text, lang); setResults((prev) => ({ ...prev, [lang]: r })); }
    catch (e) {
      if (e instanceof SummaryError && e.notInPlan) { setNotInPlan(true); return; }
      setError(e instanceof Error ? e.message : 'Could not make the summary.'); setOpen(false);
    } finally { setBusy(false); }
  }

  return (
    <div className="mb-4">
      {!open ? (
        <button type="button" onClick={() => void ask()} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2 text-sm font-bold text-slate-900 shadow-sm transition hover:shadow-md active:scale-95">
          {label} <span className="rounded-full bg-white/60 px-2 py-0.5 text-[11px] font-semibold">{words.toLocaleString('en-IN')} words</span>
        </button>
      ) : (
        <div className="overflow-hidden rounded-2xl border-2 border-amber-200 bg-amber-50/60 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-amber-100 to-orange-100 px-4 py-2.5">
            <p className="text-sm font-bold text-amber-950">⚡ Quick summary{current ? <span className="ml-2 text-xs font-semibold text-amber-800">about {current.summaryWords.toLocaleString('en-IN')} words from {current.sourceWords.toLocaleString('en-IN')}</span> : null}</p>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-white/60">Hide</button>
          </div>
          <div className="p-4">
            {busy && (
              <div className="space-y-2" aria-live="polite">
                <p className="text-sm font-semibold text-amber-900">Reading it for you… this takes a few seconds.</p>
                {[80, 95, 60, 88].map((w, i) => <div key={i} className="h-3 animate-pulse rounded bg-amber-200/70" style={{ width: `${w}%` }} />)}
              </div>
            )}
            {!busy && current && <SummaryBody text={current.summary} />}
            {!busy && current && <p className="mt-4 border-t border-amber-200 pt-3 text-[11px] text-amber-900/80">Made by AI for a quick look. The full text is the reference — read it for every detail.</p>}
          </div>
        </div>
      )}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
