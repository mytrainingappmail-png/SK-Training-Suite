// "Import from a Live Quiz / Exam": pick one of your quizzes or exams, tick the questions, and they go into the test
// editor as NEW, UNSAVED questions (same as the AI Quiz Maker) - read them, change anything, then Save all changes.
// Quiz content is protected by the Live Quiz login, so this needs that login to be open in this browser (it stays
// logged in once you have logged in there); otherwise the window explains it and links to that login.

import { useEffect, useMemo, useState } from "react";
import { loadCurrentQuizAdmin } from "../../services/quiz/quizAdminSession";
import { listQuizzes, getQuiz } from "../../services/quiz/quizService";
import { ROUTES } from "../../constants/routes";
import type { Quiz, QuizQuestion } from "../../types/quiz";

export interface ImportedQuestion {
  text: string;
  type: "mcq" | "multiple_select" | "true_false";
  options: { option_text: string; is_correct: boolean }[];
  marks: number;
  explanation: string;
  image_url: string;
}

interface Item {
  q: QuizQuestion;
  converted: ImportedQuestion | null;
  /** Why it cannot be imported (shown in grey), or a note for a question that can. */
  note: string;
}

/** Turns a quiz question into one the induction / project / course test editor can hold. Exported for the tests. */
export function convertQuizQuestion(q: QuizQuestion): { converted: ImportedQuestion | null; note: string } {
  if (q.type === "hotspot") return { converted: null, note: "Picture-tap question - cannot be used in this kind of test" };
  if (q.type === "written") return { converted: null, note: "Written question - cannot be used in this kind of test" };
  const options = [...(q.options ?? [])]
    .sort((a, b) => a.display_order - b.display_order)
    .filter((o) => o.option_text.trim())
    .map((o) => ({ option_text: o.option_text.trim(), is_correct: !!o.is_correct }));
  if (options.length < 2) return { converted: null, note: "Fewer than 2 options" };
  const rights = options.filter((o) => o.is_correct).length;
  if (rights === 0) return { converted: null, note: "No correct answer is marked" };
  const type: ImportedQuestion["type"] = q.type === "truefalse" ? "true_false" : rights > 1 ? "multiple_select" : "mcq";
  return {
    converted: {
      text: q.question_text.trim(), type, options, marks: Math.max(1, Math.floor(Number(q.marks) || 1)),
      explanation: (q.explanation ?? "").trim(), image_url: (q.image_url ?? "").trim(),
    },
    note: type === "multiple_select" ? "More than one correct answer" : "",
  };
}

export default function ImportFromQuizModal({ existingTexts, onAdd, onClose }: {
  /** Question texts already in this test - the same question is left unticked so it is not added twice. */
  existingTexts: string[];
  onAdd: (questions: ImportedQuestion[]) => void;
  onClose: () => void;
}) {
  const admin = loadCurrentQuizAdmin();
  const [tests, setTests] = useState<Quiz[] | null>(null);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");
  const [opened, setOpened] = useState<Quiz | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!admin) return;
    listQuizzes(admin.company_id).then(setTests).catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load your quizzes."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (tests ?? []).filter((t) => !needle || t.title.toLowerCase().includes(needle) || t.code.toLowerCase().includes(needle));
  }, [tests, search]);

  const have = useMemo(() => new Set(existingTexts.map((t) => t.trim().toLowerCase())), [existingTexts]);

  async function open(t: Quiz) {
    setBusy(true);
    setLoadError("");
    try {
      const full = await getQuiz(t.id);
      if (!full) throw new Error("That test could not be found.");
      const list: Item[] = full.questions.map((q) => ({ q, ...convertQuizQuestion(q) }));
      const start = new Set<number>();
      list.forEach((it, i) => {
        if (!it.converted) return;
        if (it.q.is_hidden) { it.note = "Hidden in the quiz"; return; }
        if (have.has(it.converted.text.toLowerCase())) { it.note = "Already in this test"; return; }
        start.add(i);
      });
      setItems(list);
      setPicked(start);
      setOpened(t);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not open that test.");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (i: number) => setPicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const usable = items.map((it, i) => (it.converted ? i : -1)).filter((i) => i >= 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">📥 Import from a Quiz / Exam</h3>
            <p className="text-xs text-slate-500">{opened ? "Tick the questions you want, then add them to this test." : "Pick the quiz or exam the questions are in."}</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2.5 py-1.5 text-lg text-slate-400 hover:bg-slate-100" aria-label="Close">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!admin ? (
            <div className="space-y-3 rounded-xl bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <p className="font-semibold">Log in to the Live Quiz section once in this browser.</p>
              <p className="text-xs">Your quizzes are kept behind the Live Quiz login. Log in there (one time - it stays logged in), then come back here and open this window again.</p>
              <a href={ROUTES.QUIZ_ADMIN_LOGIN} target="_blank" rel="noreferrer" className="inline-block rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700">Open Live Quiz login ↗</a>
            </div>
          ) : !opened ? (
            <div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or code" className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
              {loadError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{loadError}</p>}
              {tests === null && !loadError && <p className="text-xs text-slate-400">Loading your quizzes…</p>}
              {tests !== null && shown.length === 0 && <p className="text-xs text-slate-400">No quiz or exam found.</p>}
              <ul className="space-y-2">
                {shown.map((t) => (
                  <li key={t.id}>
                    <button type="button" disabled={busy} onClick={() => open(t)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-60">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">{t.title}</span>
                        <span className="text-[11px] text-slate-400">{t.code}</span>
                      </span>
                      <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${t.mode === "exam" ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"}`}>{t.mode === "exam" ? "Exam" : "Live Quiz"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">{opened.title}</p>
                <span className="flex gap-3 text-xs font-semibold">
                  <button type="button" onClick={() => setPicked(new Set(usable.filter((i) => !items[i].q.is_hidden)))} className="text-indigo-600 hover:underline">Tick all</button>
                  <button type="button" onClick={() => setPicked(new Set())} className="text-slate-500 hover:underline">Untick all</button>
                </span>
              </div>
              {items.length === 0 && <p className="text-xs text-slate-400">This test has no questions.</p>}
              {items.map((it, i) => {
                const q = it.converted;
                return (
                  <label key={it.q.id} className={`block rounded-xl border p-3.5 transition ${!q ? "border-slate-200 bg-slate-50 opacity-60" : picked.has(i) ? "cursor-pointer border-indigo-300 bg-indigo-50/40" : "cursor-pointer border-slate-200 bg-white opacity-70"}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" disabled={!q} checked={picked.has(i)} onChange={() => toggle(i)} className="mt-1 h-4 w-4" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{i + 1}. {it.q.question_text}</p>
                        {q && (
                          <ul className="mt-2 space-y-1">
                            {q.options.map((o, oi) => (
                              <li key={oi} className={`flex gap-2 rounded-lg px-2.5 py-1.5 text-xs ${o.is_correct ? "bg-emerald-100 font-semibold text-emerald-900" : "bg-slate-50 text-slate-700"}`}>
                                <span className="font-bold">{String.fromCharCode(65 + oi)}.</span><span>{o.option_text}</span>{o.is_correct && <span className="ml-auto">✓</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                        {it.note && <p className={`mt-1.5 text-[11px] ${q ? "text-amber-700" : "text-slate-500"}`}>{q ? "ℹ️ " : "⛔ "}{it.note}</p>}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          {opened ? (
            <>
              <button onClick={() => { setOpened(null); setItems([]); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">← Other quiz</button>
              <button
                onClick={() => onAdd(items.filter((it, i) => picked.has(i) && it.converted).map((it) => it.converted as ImportedQuestion))}
                disabled={picked.size === 0}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >Add {picked.size} to my test</button>
            </>
          ) : (
            <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white">Close</button>
          )}
        </div>
      </div>
    </div>
  );
}
