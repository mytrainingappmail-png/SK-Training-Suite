// Shown on Save when a question that is also used in other tests was changed here: update it there too (so every test has the
// same, latest question) or keep this change only in this test (the question then becomes its own separate question).

import { useState } from "react";
import type { QuestionLink } from "../../services/quiz/quizLinkService";

export interface SyncItem {
  /** The question's shared id. */
  uid: string;
  /** "Q3 - What does RERA stand for?" */
  label: string;
  links: QuestionLink[];
}

interface Props {
  items: SyncItem[];
  thisTitle: string;
  onCancel: () => void;
  /** The ids of the questions to update everywhere; the rest stay only in this test. */
  onConfirm: (updateUids: string[]) => void;
}

export default function SyncChoiceModal({ items, thisTitle, onCancel, onConfirm }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set(items.map((i) => i.uid)));

  function toggle(uid: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 p-5 text-white sm:rounded-2xl">
        <h2 className="text-base font-bold">🔗 Update the other tests too?</h2>
        <p className="mt-1 text-xs text-slate-400">
          {items.length === 1 ? "A question you changed is" : `${items.length} questions you changed are`} also used in other tests. Tick the ones that should be updated everywhere, so
          nobody gets an old version later.
        </p>

        <div className="mt-4 space-y-2">
          {items.map((it) => {
            const live = it.links.filter((l) => l.in_use);
            return (
              <label key={it.uid} className={`block cursor-pointer rounded-xl border p-3 text-sm ${checked.has(it.uid) ? "border-violet-500/60 bg-violet-500/10" : "border-slate-800 bg-slate-950/40"}`}>
                <div className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={checked.has(it.uid)} onChange={() => toggle(it.uid)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{it.label}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {it.links.map((l) => (
                        <span key={l.question_id} title={l.title} className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px]">
                          <span className="font-mono font-bold text-amber-300">{l.code}</span>
                          <span className="max-w-[9rem] truncate text-slate-300">{l.title}</span>
                          {l.is_home && <span className="text-[9px] font-bold uppercase text-emerald-300">original</span>}
                          {l.in_use && <span className="text-[9px] font-bold uppercase text-red-300">running</span>}
                        </span>
                      ))}
                    </div>
                    {live.length > 0 && (
                      <div className="mt-1.5 text-[11px] text-amber-300">
                        {live.map((l) => l.code).join(", ")} {live.length === 1 ? "is" : "are"} running or scheduled right now, so {live.length === 1 ? "it is" : "they are"} left as {live.length === 1 ? "it is" : "they are"}.
                      </div>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          Not ticked = the change stays only in “{thisTitle || "this test"}” and that question stops following the others.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white">Cancel</button>
          <button type="button" onClick={() => onConfirm([...checked])} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
            Save{checked.size > 0 ? ` and update ${checked.size === items.length ? "everywhere" : `${checked.size} of ${items.length}`}` : " here only"}
          </button>
        </div>
      </div>
    </div>
  );
}
