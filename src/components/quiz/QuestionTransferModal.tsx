// "Make a new test from these questions" / "Copy them to another test" / "Move them to another test".
// The questions can stay linked to the originals: a question changed later in one test is then updated in the others too.

import { useEffect, useMemo, useState } from "react";
import { listQuizzes } from "../../services/quiz/quizService";
import type { Quiz } from "../../types/quiz";

export type TransferRequest =
  | { kind: "new"; title: string; code: string; linked: boolean }
  | { kind: "copy" | "move"; target: Quiz; linked: boolean };

export interface TransferOutcome {
  message: string;
  /** Where to open the test that was made / changed. */
  openUrl?: string;
}

interface Props {
  companyId: string;
  count: number;
  currentQuizId: string | null;
  currentTitle: string;
  onClose: () => void;
  /** Does the work; resolves with what to tell the trainer, or throws a plain-words Error. */
  onConfirm: (req: TransferRequest) => Promise<TransferOutcome>;
}

type Tab = "new" | "copy" | "move";

const TAB_LABEL: Record<Tab, string> = { new: "✨ New test", copy: "📋 Copy to a test", move: "➡ Move to a test" };

export default function QuestionTransferModal({ companyId, count: countNow, currentQuizId, currentTitle, onClose, onConfirm }: Props) {
  const [count] = useState(countNow); // the number at the moment it was opened (the page clears its ticks once done)
  const [tab, setTab] = useState<Tab>("new");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [linked, setLinked] = useState(true);
  const [tests, setTests] = useState<Quiz[]>([]);
  const [search, setSearch] = useState("");
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<TransferOutcome | null>(null);

  useEffect(() => {
    listQuizzes(companyId).then((all) => setTests(all.filter((q) => q.id !== currentQuizId))).catch(() => {});
  }, [companyId, currentQuizId]);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tests.filter((q) => !needle || q.title.toLowerCase().includes(needle) || q.code.toLowerCase().includes(needle));
  }, [tests, search]);

  const target = tests.find((q) => q.id === targetId) ?? null;
  const canGo = tab === "new" ? title.trim().length > 0 : target !== null;

  async function go() {
    setBusy(true);
    setError("");
    try {
      const res = await onConfirm(
        tab === "new" ? { kind: "new", title, code, linked } : { kind: tab, target: target as Quiz, linked }
      );
      setOutcome(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const noun = `${count} question${count === 1 ? "" : "s"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 p-5 text-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">{noun} selected</h2>
            <p className="text-xs text-slate-400">From “{currentTitle || "this test"}”. What you see on screen right now is what gets copied.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:text-white">✕</button>
        </div>

        {outcome ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{outcome.message}</div>
            <div className="flex flex-wrap gap-2">
              {outcome.openUrl && (
                <a href={outcome.openUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">Open that test ↗</a>
              )}
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:text-white">Done</button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-800 p-1">
              {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTab(t); setError(""); }}
                  className={`rounded-lg px-2 py-2 text-xs font-bold ${tab === t ? "bg-violet-600 text-white" : "text-slate-300 hover:text-white"}`}
                >
                  {TAB_LABEL[t]}
                </button>
              ))}
            </div>

            {tab === "new" ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Name of the new test</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Vatika - RERA basics"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Test code (optional)</label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Leave empty - made from the name, like V004"
                    maxLength={16}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white outline-none focus:border-violet-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500">The new test is a draft with the same settings as this one. Publish it when it is ready.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or code"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
                />
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-800 p-1">
                  {shown.length === 0 && <div className="px-3 py-4 text-center text-xs text-slate-500">No other test found.</div>}
                  {shown.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setTargetId(q.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${targetId === q.id ? "bg-violet-600/30 ring-1 ring-violet-500" : "hover:bg-slate-800"}`}
                    >
                      <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-300">{q.code}</span>
                      <span className="min-w-0 flex-1 truncate">{q.title}</span>
                      <span className="shrink-0 text-[10px] uppercase text-slate-500">{q.mode === "exam" ? "Exam" : "Quiz"}</span>
                    </button>
                  ))}
                </div>
                {tab === "move" && (
                  <p className="text-[11px] text-amber-300">The questions are removed from this test on screen - press Save here to keep that.</p>
                )}
                <p className="text-[11px] text-slate-500">They are added at the end of the other test. Its own questions are not touched.</p>
              </div>
            )}

            <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
              <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} className="mt-0.5" />
              <span>
                <span className="font-semibold text-white">Keep them linked (recommended)</span>
                <br />
                Change a question later in either test and it can be updated in both - so a question you take from here is never an old, unupdated one.
                Untick for a separate copy that lives on its own.
              </span>
            </label>

            {error && <div className="mt-3 text-sm text-red-300">{error}</div>}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white">Cancel</button>
              <button
                type="button"
                onClick={() => void go()}
                disabled={busy || !canGo}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {busy ? "Working…" : tab === "new" ? `Create test with ${noun}` : tab === "copy" ? `Copy ${noun}` : `Move ${noun}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
