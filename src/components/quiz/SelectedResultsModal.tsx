// "View" for the ticked tests on the Results page: each test's results on one screen, best result first
// (rank 1 at the top, with the trainer's TOPPER / 2nd RANK / 3rd RANK wording), the same order the downloaded file has.

import { sortResultsForReport } from "../../services/quiz/quizReportService";
import GradeBadge from "./GradeBadge";
import type { QuizSessionResultRow } from "../../types/quiz";

interface Props {
  rows: QuizSessionResultRow[];
  onDownload: () => void;
  onClose: () => void;
}

export default function SelectedResultsModal({ rows, onDownload, onClose }: Props) {
  const sorted = sortResultsForReport(rows);
  const bySession = new Map<string, QuizSessionResultRow[]>();
  for (const r of sorted) bySession.set(r.session_id, [...(bySession.get(r.session_id) ?? []), r]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 p-5 text-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">👁 Results of {bySession.size} test{bySession.size === 1 ? "" : "s"}</h2>
          <div className="flex gap-2">
            <button type="button" onClick={onDownload} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-300">⬇ Download</button>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">✕ Close</button>
          </div>
        </div>

        <div className="space-y-5">
          {[...bySession.entries()].map(([sessionId, list]) => (
            <div key={sessionId}>
              <div className="mb-1.5">
                <div className="text-sm font-semibold">{list[0].quiz_title}</div>
                <div className="text-[11px] text-slate-500">
                  {list[0].ended_at ? new Date(list[0].ended_at).toLocaleString("en-IN") : ""} · {list.length} trainee{list.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/60 text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Rank</th>
                      <th className="px-3 py-2">Trainee</th>
                      <th className="px-3 py-2">Correct</th>
                      <th className="px-3 py-2">Marks</th>
                      <th className="px-3 py-2">%</th>
                      <th className="px-3 py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.participant_id} className="border-t border-slate-800">
                        <td className="px-3 py-2 font-mono text-slate-300">{r.open_link_id ? "-" : r.rank}</td>
                        <td className="px-3 py-2 font-medium text-white">{r.display_name}</td>
                        <td className="px-3 py-2 text-slate-300">{r.correct_count}/{r.total_questions}</td>
                        <td className="px-3 py-2 text-slate-300">{r.marks_obtained != null ? `${r.marks_obtained}/${r.total_marks}` : "-"}</td>
                        <td className="px-3 py-2 font-mono text-slate-300">{r.percent_correct}%</td>
                        <td className="px-3 py-2"><GradeBadge grade={r.grade} rank={r.rank} isOpenLink={!!r.open_link_id} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
