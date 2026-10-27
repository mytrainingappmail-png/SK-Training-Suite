// Shown when a question that is also used in other tests is deleted: remove it only from this test, or from all of them.

import type { QuestionLink } from "../../services/quiz/quizLinkService";

interface Props {
  /** "Q3 - What does RERA stand for?" */
  label: string;
  thisTitle: string;
  links: QuestionLink[];
  onCancel: () => void;
  onChoose: (everywhere: boolean) => void;
}

export default function DeleteChoiceModal({ label, thisTitle, links, onCancel, onChoose }: Props) {
  const live = links.filter((l) => l.in_use);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onCancel}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 p-5 text-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold">🗑 Delete this question from where?</h2>
        <p className="mt-1 truncate text-sm font-semibold text-slate-200">{label}</p>
        <p className="mt-2 text-xs text-slate-400">This question is also used in {links.length === 1 ? "another test" : `${links.length} other tests`}:</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {links.map((l) => (
            <span key={l.question_id} title={l.title} className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px]">
              <span className="font-mono font-bold text-amber-300">{l.code}</span>
              <span className="max-w-[9rem] truncate text-slate-300">{l.title}</span>
              {l.in_use && <span className="text-[9px] font-bold uppercase text-red-300">running</span>}
            </span>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          <button type="button" onClick={() => onChoose(false)} className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-left hover:border-violet-500">
            <div className="text-sm font-semibold">Only from “{thisTitle || "this test"}”</div>
            <div className="text-[11px] text-slate-400">The other tests keep the question. It is removed here when you press Save.</div>
          </button>
          <button type="button" onClick={() => onChoose(true)} className="w-full rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-left hover:border-red-400">
            <div className="text-sm font-semibold text-red-200">From here and from all {links.length} other test{links.length === 1 ? "" : "s"}</div>
            <div className="text-[11px] text-red-200/70">
              Removed everywhere when you press Save. A test that already has results loses this question from its old answer sheets.
            </div>
          </button>
        </div>
        {live.length > 0 && (
          <p className="mt-3 text-[11px] text-amber-300">
            {live.map((l) => l.code).join(", ")} {live.length === 1 ? "is" : "are"} running or scheduled right now, so the question stays {live.length === 1 ? "there" : "in them"} even if you choose “everywhere”.
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white">Cancel</button>
        </div>
      </div>
    </div>
  );
}
