// AI Quiz Maker dialog: pick (or paste) the training content, say how many questions and how hard, and the AI drafts
// multiple-choice questions. They are shown here to tick and untick; "Add" puts the ticked ones into the test editor as
// NEW, UNSAVED questions — the trainer still reads and edits them there and presses Save all changes.

import { useState } from "react";
import { generateQuizQuestions } from "../../services/aiQuiz/aiQuizService";
import type { AiQuestion, AiDifficulty, AiLanguage } from "../../services/aiQuiz/aiQuizService";

const COUNTS = [5, 10, 15, 20];
const DIFFS: { v: AiDifficulty; l: string }[] = [
  { v: "easy", l: "Easy" }, { v: "medium", l: "Medium" }, { v: "hard", l: "Hard (situations)" }, { v: "mixed", l: "Mixed" },
];

export default function AiQuizMakerModal({ sourceText, onAdd, onClose }: {
  /** Content to start from (the page / project text) — the trainer can change it. */
  sourceText: string;
  onAdd: (questions: AiQuestion[]) => void;
  onClose: () => void;
}) {
  const [content, setContent] = useState(sourceText.slice(0, 14000));
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<AiDifficulty>("mixed");
  const [language, setLanguage] = useState<AiLanguage>("english");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AiQuestion[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [runsLeft, setRunsLeft] = useState<number | null>(null);

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const tooLong = content.length > 14000;

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const r = await generateQuizQuestions({ content, count, difficulty, language, extra: extra.trim() || undefined });
      setResult(r.questions);
      setPicked(new Set(r.questions.map((_, i) => i)));
      setRunsLeft(r.runsLeft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not make questions right now.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(i: number) {
    setPicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">✨ Make questions with AI</h3>
            <p className="text-xs text-slate-500">{result ? "Tick the ones you want, then add them to your test." : "The AI reads your content and drafts the questions. You review them before anything is saved."}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2.5 py-1.5 text-lg text-slate-400 hover:bg-slate-100" aria-label="Close">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!result ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Training content</span>
                  <span className={tooLong ? "text-rose-600" : "text-slate-400"}>{words} words{tooLong ? " — too long, trim it" : ""}</span>
                </label>
                <textarea
                  value={content} onChange={(e) => setContent(e.target.value)} rows={9}
                  placeholder="Paste the lesson, brochure text or notes the questions should come from…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30"
                />
                <p className="mt-1 text-[11px] text-slate-400">{sourceText ? "Filled from this page. Edit it freely — one topic at a time gives the best questions." : "Paste the content here (about 2,500 words at most)."}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="text-xs font-semibold text-slate-600">How many
                  <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm">{COUNTS.map((c) => <option key={c} value={c}>{c} questions</option>)}</select>
                </label>
                <label className="text-xs font-semibold text-slate-600">How hard
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as AiDifficulty)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm">{DIFFS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}</select>
                </label>
                <label className="col-span-2 text-xs font-semibold text-slate-600">Language
                  <select value={language} onChange={(e) => setLanguage(e.target.value as AiLanguage)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm">
                    <option value="english">English</option><option value="hinglish">Hinglish (Hindi in English letters)</option>
                  </select>
                </label>
              </div>

              <label className="block text-xs font-semibold text-slate-600">Anything special? (optional)
                <input value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={300} placeholder="e.g. focus on payment plans and possession dates" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal" />
              </label>

              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
              <p className="text-[11px] text-slate-400">The AI can make mistakes, so read each question and its green answer before you save. Your content is sent to Google's free AI to make the questions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">⚠️ Made by AI — please check each question and the green correct answer before you save.</p>
              {result.map((q, i) => (
                <label key={i} className={`block cursor-pointer rounded-xl border p-3.5 transition ${picked.has(i) ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200 bg-white opacity-60"}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} className="mt-1 h-4 w-4" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{i + 1}. {q.text}</p>
                      <ul className="mt-2 space-y-1">
                        {q.options.map((o, oi) => (
                          <li key={oi} className={`flex gap-2 rounded-lg px-2.5 py-1.5 text-xs ${oi === q.correct_index ? "bg-emerald-100 font-semibold text-emerald-900" : "bg-slate-50 text-slate-700"}`}>
                            <span className="font-bold">{String.fromCharCode(65 + oi)}.</span><span>{o}</span>{oi === q.correct_index && <span className="ml-auto">✓</span>}
                          </li>
                        ))}
                      </ul>
                      {q.explanation && <p className="mt-2 text-[11px] italic text-slate-500">💡 {q.explanation}</p>}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          {!result ? (
            <>
              <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white">Cancel</button>
              <button onClick={generate} disabled={busy || words < 30 || tooLong} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                {busy ? "AI sawal bana raha hai…" : `✨ Make ${count} questions`}
              </button>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <button onClick={() => { setResult(null); setError(""); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">← Change & redo</button>
                {runsLeft !== null && <span className="self-center text-[11px] text-slate-400">{runsLeft} AI runs left today</span>}
              </div>
              <button onClick={() => onAdd(result.filter((_, i) => picked.has(i)))} disabled={picked.size === 0} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                Add {picked.size} to my test
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
