// "⬇ Download test" — the whole test as CSV, or PDF with / without the answers. Used in the quiz / exam builder
// (what is on the screen right now) and on the Quizzes / Exams lists (the saved test).

import { useEffect, useRef, useState } from "react";
import { downloadQuizCsv, type ExportQuiz } from "../../services/quiz/quizExportService";

interface Props {
  /** Gives the test to download (fetched or built from the screen). */
  load: () => Promise<ExportQuiz | null>;
  /** Small version for list cards. */
  compact?: boolean;
}

export default function QuizDownloadMenu({ load, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function run(kind: "csv" | "pdf-key" | "pdf-paper") {
    setOpen(false);
    setError("");
    setBusy(kind === "csv" ? "Preparing CSV…" : "Preparing PDF…");
    try {
      const quiz = await load();
      if (!quiz) throw new Error("Could not find this test.");
      if (quiz.questions.filter((q) => !q.is_hidden).length === 0) throw new Error("This test has no questions yet.");
      if (kind === "csv") {
        downloadQuizCsv(quiz);
      } else {
        const { downloadQuizPdf } = await import("./quizPdfExport");
        await downloadQuizPdf(quiz, {
          withAnswers: kind === "pdf-key",
          onProgress: (done, total) => setBusy(`Making PDF… page ${done} of ${total}`),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not make the download.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => setOpen((v) => !v)}
        title="Download this whole test with the correct answers and explanations"
        className={compact
          ? "text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-lg px-2.5 py-1.5 disabled:opacity-60"
          : "text-sm font-semibold text-violet-200 hover:text-white border border-violet-500/50 hover:bg-violet-500/10 rounded-lg px-3 py-2 disabled:opacity-60"}
      >
        {busy || (compact ? "⬇ Download" : "⬇ Download this test")} {!busy && <span className="text-[10px]">▾</span>}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
          <button type="button" onClick={() => void run("pdf-key")} className="block w-full px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800">
            📕 <b>PDF — with answers &amp; explanations</b>
            <span className="block text-[11px] text-slate-500">Every question, options, the correct answer marked ✓, and the explanation</span>
          </button>
          <button type="button" onClick={() => void run("pdf-paper")} className="block w-full border-t border-slate-800 px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800">
            📄 <b>PDF — question paper</b>
            <span className="block text-[11px] text-slate-500">Questions and options only, to print and hand out</span>
          </button>
          <button type="button" onClick={() => void run("csv")} className="block w-full border-t border-slate-800 px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800">
            📊 <b>CSV — spreadsheet</b>
            <span className="block text-[11px] text-slate-500">Opens in Excel. Can be uploaded again with “Import from CSV”</span>
          </button>
          <div className="border-t border-slate-800 px-3 py-1.5 text-[10px] text-slate-500">Hidden questions are not included.</div>
        </div>
      )}

      {error && <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border border-red-500/40 bg-red-950 px-3 py-2 text-xs text-red-200">{error}</div>}
    </div>
  );
}
