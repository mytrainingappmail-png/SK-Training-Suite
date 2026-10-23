import type { CertEligibility, QuizGrade } from "../../types/quiz";

/** Marks a participant earned: the marks of the questions they got right (an older result without saved answers falls back to its right-answer count). */
export function marksOf(p: { correct_count: number; marks_earned?: number | null }): number {
  return p.marks_earned ?? p.correct_count;
}

/** Percentage of the quiz's total marks (an older result without marks is by question count, as it always was). */
export function percentOfMarks(
  p: { correct_count: number; marks_earned?: number | null },
  totalQuestions: number,
  totalMarks: number
): number {
  const den = p.marks_earned == null ? totalQuestions : totalMarks;
  return den === 0 ? 0 : Math.round((marksOf(p) / den) * 100);
}

/** Marks-based rank — deliberately independent of the gamified "score" the live leaderboard sidebar uses (that one stays purely for fun). Ties broken by whoever answered faster overall. */
export function rankByMarks<T extends { correct_count: number; marks_earned?: number | null; total_response_time_ms: number }>(participants: T[]): T[] {
  return participants
    .slice()
    .sort((a, b) => marksOf(b) - marksOf(a) || a.total_response_time_ms - b.total_response_time_ms);
}

/** 1-based rank of one participant within the same marks-based ordering. */
export function findRank<T extends { correct_count: number; marks_earned?: number | null; total_response_time_ms: number }>(
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
