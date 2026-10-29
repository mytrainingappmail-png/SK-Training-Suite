// The optional Hindi version of one question in the builder: question, options and explanation, in Devanagari with the common
// English words kept in English. "Auto-fill" asks the AI for a first draft; the trainer reads and edits it.
// Trainees get a language switch only for questions that have a Hindi version.

import { useState } from "react";
import { hasHindi, translateQuestionToHindi } from "../../services/quiz/quizHindiService";

interface HindiOption {
  option_text: string;
  option_text_hi?: string | null;
}

interface HindiQuestion<O extends HindiOption> {
  question_text: string;
  question_text_hi?: string | null;
  explanation: string;
  explanation_hi?: string | null;
  type: string;
  options: O[];
}

interface Props<O extends HindiOption> {
  question: HindiQuestion<O>;
  onChange: (patch: { question_text_hi?: string; explanation_hi?: string; options?: O[] }) => void;
}

const FIELD = "w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500";

export default function QuestionHindiPanel<O extends HindiOption>({ question, onChange }: Props<O>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const done = hasHindi(question);
  const hasOptions = question.type !== "hotspot" && question.type !== "written" && question.options.length > 0;
  const nothingToTranslate = !question.question_text.trim();

  async function autoFill() {
    if (nothingToTranslate) { setError("Write the English question first."); return; }
    if (done && !confirm("This question already has some Hindi. Replace it with a fresh auto-filled version?")) return;
    setBusy(true);
    setError("");
    try {
      const out = await translateQuestionToHindi(question);
      onChange({ question_text_hi: out.question_text_hi ?? "", explanation_hi: out.explanation_hi ?? "", options: out.options });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not auto-fill Hindi.");
    } finally {
      setBusy(false);
    }
  }

  /** Takes the Hindi version away: the question goes back to "not added" and trainees get no language switch for it. */
  function removeHindi() {
    if (!confirm("Remove the Hindi version of this question? The English question stays as it is.")) return;
    setError("");
    onChange({ question_text_hi: "", explanation_hi: "", options: question.options.map((o) => ({ ...o, option_text_hi: null })) });
  }

  function setOptionHi(index: number, text: string) {
    onChange({ options: question.options.map((o, i) => (i === index ? { ...o, option_text_hi: text } : o)) });
  }

  return (
    <details className="group rounded-lg border border-slate-800 bg-slate-950/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-slate-300">
        <span>🇮🇳 हिंदी version <span className="font-normal text-slate-500">(optional - trainees get a language switch)</span></span>
        <span className={done ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300" : "text-[10px] text-slate-500"}>
          {done ? "✓ added" : "not added"}
        </span>
      </summary>
      <div className="space-y-2 border-t border-slate-800 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void autoFill()}
            disabled={busy}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {busy ? "Writing Hindi…" : done ? "↻ Auto-fill again" : "✨ Auto-fill from English"}
          </button>
          {done && (
            <button
              type="button"
              onClick={removeHindi}
              disabled={busy}
              className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              🗑 Remove Hindi
            </button>
          )}
          <span className="text-[11px] text-slate-500">Devanagari with the usual English words (project, booking, loan…) kept in English. Check it, then Save.</span>
        </div>
        {error && <div className="text-xs text-red-300">{error}</div>}

        <textarea
          rows={2}
          className={FIELD}
          placeholder="प्रश्न (Hindi question)"
          value={question.question_text_hi ?? ""}
          onChange={(e) => onChange({ question_text_hi: e.target.value })}
        />
        {hasOptions && (
          <div className="space-y-1.5">
            {question.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-[11px] text-slate-500" title={o.option_text}>{o.option_text || `Option ${i + 1}`}</span>
                <input
                  className={FIELD}
                  placeholder={`विकल्प ${i + 1}`}
                  value={o.option_text_hi ?? ""}
                  onChange={(e) => setOptionHi(i, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
        <input
          className={FIELD}
          placeholder="स्पष्टीकरण (Hindi explanation, optional)"
          value={question.explanation_hi ?? ""}
          onChange={(e) => onChange({ explanation_hi: e.target.value })}
        />
      </div>
    </details>
  );
}
