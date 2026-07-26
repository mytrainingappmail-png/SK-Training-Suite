import type { CertEligibility, QuizGrade } from "../../types/quiz";

/** Marks-based rank — deliberately independent of the gamified "score" the live leaderboard sidebar uses (that one stays purely for fun). Ties broken by whoever answered faster overall. */
export function rankByMarks<T extends { correct_count: number; total_response_time_ms: number }>(participants: T[]): T[] {
  return participants
    .slice()
    .sort((a, b) => b.correct_count - a.correct_count || a.total_response_time_ms - b.total_response_time_ms);
}

/** 1-based rank of one participant within the same marks-based ordering. */
export function findRank<T extends { correct_count: number; total_response_time_ms: number }>(
  participants: T[],
  target: T
): number {
  return rankByMarks(participants).findIndex((p) => p === target) + 1;
}

/** A quiz can be set up as a competition (top 1 / top 3) instead of "everyone who passes gets a certificate." */
export function isCertEligible(rank: number, grade: QuizGrade, certEligibility: CertEligibility): boolean {
  if (grade !== "PASS") return false;
  if (certEligibility === "top1") return rank === 1;
  if (certEligibility === "top3") return rank <= 3;
  return true;
}

export const MEDALS = ["🥇", "🥈", "🥉"];
