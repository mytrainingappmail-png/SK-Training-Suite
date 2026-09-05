import type { ReactNode } from "react";

import { isCertEligible, MEDALS } from "../../services/quiz/quizRankingService";
import QuizAnswerDistributionBars from "./QuizAnswerDistributionBars";
import QuizAdminCertificateButton from "./QuizAdminCertificateButton";
import type { QuizSession, QuizSessionResultRow, AnswerDistributionQuestion, CertEligibility } from "../../types/quiz";

export const GRADE_STYLE: Record<string, string> = {
  PASS: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  NEED_IMPROVEMENT: "text-amber-300 bg-amber-500/15 border-amber-500/30",
  FAIL: "text-red-300 bg-red-500/15 border-red-500/30",
};

/** One ended session's card — rank list + answer breakdown on expand.
 * Shared by the everyday Results session list and the Final Result
 * folder's drilled-in view, which differ only in what `actions` renders
 * (Delete + Move vs. Delete + Remove-from-folder). */
export default function SessionResultCard({
  session,
  rows,
  isOpen,
  onToggle,
  distribution,
  certEligibility,
  companyId,
  actions,
}: {
  session: QuizSession;
  rows: QuizSessionResultRow[];
  isOpen: boolean;
  onToggle: () => void;
  distribution: AnswerDistributionQuestion[] | undefined;
  certEligibility: CertEligibility;
  companyId: string | null;
  actions?: ReactNode;
}) {
  const nPass = rows.filter((r) => r.grade === "PASS").length;
  const nImp = rows.filter((r) => r.grade === "NEED_IMPROVEMENT").length;
  const nFail = rows.filter((r) => r.grade === "FAIL").length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <button className="flex-1 text-left flex items-center justify-between" onClick={onToggle}>
          <div>
            <div className="font-semibold text-sm text-white">{rows[0]?.quiz_title ?? "Quiz session"}</div>
            <div className="text-xs text-slate-500 mt-1">
              {session.ended_at ? new Date(session.ended_at).toLocaleString("en-IN") : ""} · {rows.length} participant{rows.length === 1 ? "" : "s"}
            </div>
            <div className="flex gap-2 mt-2">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">✅ {nPass} Pass</span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">⚠ {nImp} Improve</span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-500/15 text-red-300">✗ {nFail} Fail</span>
            </div>
          </div>
          <span className="text-slate-500 ml-3">{isOpen ? "▲" : "▼"}</span>
        </button>
        {actions}
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-5">
          {rows.length === 0 ? (
            <div className="text-xs text-slate-500">No participants.</div>
          ) : (
            rows
              .slice()
              .sort((a, b) => a.rank - b.rank)
              .map((r) => (
                <div key={r.participant_id} className="flex items-center gap-3 bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-slate-500 w-6 shrink-0">{MEDALS[r.rank - 1] ?? `#${r.rank}`}</span>
                  <span className="flex-1 truncate">{r.display_name}</span>
                  <span className="text-xs text-slate-400">
                    {r.correct_count}/{r.total_questions} · {r.percent_correct}%
                  </span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${GRADE_STYLE[r.grade]}`}>
                    {r.grade.replace("_", " ")}
                  </span>
                  {isCertEligible(r.rank, r.grade, certEligibility) && companyId && (
                    <QuizAdminCertificateButton participantId={r.participant_id} companyId={companyId} />
                  )}
                </div>
              ))
          )}

          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              📊 Answer Breakdown
            </div>
            {distribution ? (
              <QuizAnswerDistributionBars questions={distribution} />
            ) : (
              <div className="text-xs text-slate-500">Loading…</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
