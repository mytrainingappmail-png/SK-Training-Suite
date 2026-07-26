import type { AnswerDistributionQuestion } from "../../types/quiz";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];
const BAR_COLORS = ["#e11d48", "#2563eb", "#f59e0b", "#16a34a", "#a855f7", "#0891b2"];

export default function QuizAnswerDistributionBars({ questions }: { questions: AnswerDistributionQuestion[] }) {
  if (questions.length === 0) {
    return <div className="text-xs text-slate-500">No answer data for this session yet.</div>;
  }

  return (
    <div className="space-y-5">
      {questions.map((q, qi) => {
        const max = Math.max(1, ...q.options.map((o) => o.count));
        return (
          <div key={q.question_id}>
            <div className="text-xs font-semibold text-slate-300 mb-2">
              Q{qi + 1}. {q.question_text}
              <span className="text-slate-500 font-normal ml-2">({q.totalAnswered} answered)</span>
            </div>
            <div className="space-y-1.5">
              {q.options.map((o, oi) => {
                const pct = q.totalAnswered === 0 ? 0 : Math.round((o.count / q.totalAnswered) * 100);
                const widthPct = Math.round((o.count / max) * 100);
                return (
                  <div key={o.option_id} className="flex items-center gap-2 text-xs">
                    <span
                      className={`w-5 shrink-0 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        o.is_correct ? "ring-2 ring-emerald-400" : ""
                      }`}
                      style={{ backgroundColor: BAR_COLORS[oi % BAR_COLORS.length], color: "#fff" }}
                    >
                      {OPTION_LABELS[oi % OPTION_LABELS.length]}
                    </span>
                    <span className="w-28 shrink-0 truncate text-slate-300">{o.option_text}</span>
                    <div className="flex-1 h-4 rounded bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{ width: `${widthPct}%`, backgroundColor: BAR_COLORS[oi % BAR_COLORS.length], opacity: 0.85 }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-slate-400">
                      {o.count} ({pct}%)
                    </span>
                    {o.is_correct && <span className="text-emerald-400 shrink-0">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
