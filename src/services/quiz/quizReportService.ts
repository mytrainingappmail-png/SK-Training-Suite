// Results & Analytics exports and Champions computation — pure functions
// over already-fetched QuizSessionResultRow[], no extra DB round-trips.

import { csvEscape } from "./quizCsvService";
import type { QuizSessionResultRow, ChampionRow } from "../../types/quiz";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/** One row per participant per session — the "Detailed Report" / Performance table shape. */
export function buildDetailedReportCsv(rows: QuizSessionResultRow[]): string {
  const header = ["Date", "Test Name", "Trainee", "Score", "Correct", "Total", "Percent", "Result"];
  const lines = [header, ...rows.map((r) => [
    formatDate(r.ended_at),
    r.quiz_title,
    r.display_name,
    String(r.score),
    String(r.correct_count),
    String(r.total_questions),
    `${r.percent_correct}%`,
    r.grade.replace("_", " "),
  ])];
  return lines.map((line) => line.map((v) => csvEscape(String(v))).join(",")).join("\r\n");
}

/** One row per unique trainee name — sessions taken, average %, best %, and a pass/improve/fail breakdown. */
export function buildTraineeSummaryCsv(rows: QuizSessionResultRow[]): string {
  const byName = new Map<string, QuizSessionResultRow[]>();
  for (const r of rows) {
    const key = r.display_name.trim();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(r);
  }

  const header = ["Trainee", "Sessions Taken", "Average %", "Best %", "Pass", "Need Improvement", "Fail"];
  const summary = [...byName.entries()].map(([name, entries]) => {
    const avg = Math.round(entries.reduce((s, e) => s + e.percent_correct, 0) / entries.length);
    const best = Math.max(...entries.map((e) => e.percent_correct));
    const pass = entries.filter((e) => e.grade === "PASS").length;
    const improve = entries.filter((e) => e.grade === "NEED_IMPROVEMENT").length;
    const fail = entries.filter((e) => e.grade === "FAIL").length;
    return [name, String(entries.length), `${avg}%`, `${best}%`, String(pass), String(improve), String(fail)];
  });

  return [header, ...summary].map((line) => line.map((v) => csvEscape(String(v))).join(",")).join("\r\n");
}

/** Best score per trainee name within the given rows, filtered to those meeting the qualifying percentage, ranked highest first. */
export function computeChampions(rows: QuizSessionResultRow[], qualifyPct: number): ChampionRow[] {
  const byName = new Map<string, { best: number; count: number; participantId: string }>();

  for (const r of rows) {
    const key = r.display_name.trim();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { best: r.percent_correct, count: 1, participantId: r.participant_id });
    } else {
      existing.count += 1;
      if (r.percent_correct > existing.best) {
        existing.best = r.percent_correct;
        existing.participantId = r.participant_id;
      }
    }
  }

  return [...byName.entries()]
    .filter(([, v]) => v.best >= qualifyPct)
    .map(([name, v]) => ({
      participant_id: v.participantId,
      display_name: name,
      best_percent: v.best,
      sessions_played: v.count,
    }))
    .sort((a, b) => b.best_percent - a.best_percent)
    .slice(0, 3);
}
