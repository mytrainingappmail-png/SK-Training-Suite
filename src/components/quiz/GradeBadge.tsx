// The result badge: PASS / NEED IMPROVEMENT / FAIL — or, for the three best passing results, the trainer's own top-rank title
// (gold / silver / bronze). Used on the Results screens, the host screen and the exam results.

import { GRADE_STYLE } from "./gradeStyles";
import { useRankTitleConfig } from "../../hooks/quiz/useRankTitleConfig";
import { rankTitleFor, RANK_BADGE_CLASS } from "../../utils/rankTitles";

interface Props {
  grade: string;
  /** 1-based rank of this result within its session. */
  rank?: number | null;
  /** A one-trainee attempt of an open link has no ranking. */
  isOpenLink?: boolean;
  /** The text for the normal badge (defaults to the grade with spaces). */
  label?: string;
  className?: string;
}

export default function GradeBadge({ grade, rank, isOpenLink = false, label, className = "" }: Props) {
  const config = useRankTitleConfig();
  const title = rankTitleFor(rank, grade, config, isOpenLink);
  if (title && rank) {
    return (
      <span
        title={`Rank ${rank}`}
        className={`inline-flex items-center whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${RANK_BADGE_CLASS[rank]} ${className}`}
      >
        {title.badge}
      </span>
    );
  }
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${GRADE_STYLE[grade] ?? ""} ${className}`}>
      {label ?? grade.replace("_", " ")}
    </span>
  );
}
