// "Practice my mistakes": a trainee goes through only the questions they got wrong, one at a time, with right / wrong shown
// straight away. Nothing is sent to the server or saved - it is only for learning. Used after a Live Quiz and after an Exam.

import { useMemo, useState } from "react";

export interface RetryQuestion {
  /** Stable key for this question. */
  key: string;
  text: string;
  explanation?: string;
  options: { id: string; text: string; correct: boolean }[];
}

interface Props {
  questions: RetryQuestion[];
  onClose: () => void;
}

function shuffled<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function RetryMistakes({ questions, onClose }: Props) {
  // each round only holds the questions still to be fixed; options are mixed up so positions cannot be memorised
  const [round, setRound] = useState<RetryQuestion[]>(() => questions.map((q) => ({ ...q, options: shuffled(q.options) })));
  const [roundNo, setRoundNo] = useState(1);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [stillWrong, setStillWrong] = useState<RetryQuestion[]>([]);
  const [fixedCount, setFixedCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = round[index];
  const correctOption = useMemo(() => question?.options.find((o) => o.correct) ?? null, [question]);
  const pickedOption = question?.options.find((o) => o.id === picked) ?? null;

  function pick(optionId: string) {
    if (picked || !question) return;
    setPicked(optionId);
    const ok = question.options.find((o) => o.id === optionId)?.correct === true;
    if (ok) setFixedCount((n) => n + 1);
    else setStillWrong((prev) => [...prev, question]);
  }

  function next() {
    if (index + 1 < round.length) {
      setIndex(index + 1);
      setPicked(null);
    } else {
      setFinished(true);
    }
  }

  function tryRemaining() {
    setRound(stillWrong.map((q) => ({ ...q, options: shuffled(q.options) })));
    setStillWrong([]);
    setFixedCount(0);
    setIndex(0);
    setPicked(null);
    setRoundNo((n) => n + 1);
    setFinished(false);
  }

  const total = round.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 text-white">
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-4 py-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-violet-300">🔁 Practice my mistakes</div>
            <div className="text-[11px] text-slate-500">Nothing here is saved or counted - it is only to learn.</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">
            ✕ Close
          </button>
        </div>

        {!finished && question && (
          <>
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-[11px] font-semibold text-slate-400">
                <span>Question {index + 1} of {total}{roundNo > 1 ? ` · round ${roundNo}` : ""}</span>
                <span>{fixedCount} fixed</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${(index / total) * 100}%` }} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-4 text-base font-semibold leading-snug">{question.text}</div>
              <div className="flex flex-col gap-2.5">
                {question.options.map((o) => {
                  const isPicked = picked === o.id;
                  const reveal = picked !== null;
                  const style = !reveal
                    ? "border-slate-700 bg-slate-800 hover:border-violet-400"
                    : o.correct
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
                      : isPicked
                        ? "border-red-500 bg-red-500/15 text-red-200"
                        : "border-slate-800 bg-slate-900 text-slate-500";
                  return (
                    <button
                      key={o.id}
                      type="button"
                      disabled={reveal}
                      onClick={() => pick(o.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${style}`}
                    >
                      {o.text}
                      {reveal && o.correct && "  ✓"}
                      {reveal && isPicked && !o.correct && "  ✗"}
                    </button>
                  );
                })}
              </div>

              {picked && (
                <div className="mt-4">
                  <div className={`text-sm font-bold ${pickedOption?.correct ? "text-emerald-300" : "text-red-300"}`}>
                    {pickedOption?.correct ? "✓ Correct - well done" : "✗ Not this time"}
                  </div>
                  {!pickedOption?.correct && correctOption && <div className="mt-1 text-xs text-slate-300">Right answer: {correctOption.text}</div>}
                  {question.explanation && <div className="mt-2 text-xs italic text-slate-400">{question.explanation}</div>}
                  <button type="button" onClick={next} className="mt-4 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-500">
                    {index + 1 < total ? "Next question →" : "See how I did"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {finished && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
            <div className="text-5xl">{stillWrong.length === 0 ? "🌟" : "💪"}</div>
            <div className="mt-2 text-lg font-extrabold">
              {stillWrong.length === 0 ? "All fixed!" : `${fixedCount} of ${total} fixed`}
            </div>
            <div className="mt-1 text-sm text-slate-400">
              {stillWrong.length === 0
                ? "You now know every question you missed."
                : `${stillWrong.length} still to learn - go through just those once more.`}
            </div>
            <div className="mt-5 flex flex-col gap-2">
              {stillWrong.length > 0 && (
                <button type="button" onClick={tryRemaining} className="rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-500">
                  🔁 Try the {stillWrong.length} remaining again
                </button>
              )}
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 py-3 text-sm font-semibold text-slate-200 hover:text-white">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
