// Results & Analytics exports and Champions computation — pure functions
// over already-fetched QuizSessionResultRow[], no extra DB round-trips.

import { csvEscape } from "./quizCsvService";
import { rankTitleFor, type RankTitleConfig } from "../../utils/rankTitles";
import type { QuizSessionResultRow, ChampionRow } from "../../types/quiz";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
}

/** The trainer's rank wording is written for screens ("🏆 TOPPER"); in a spreadsheet only the words are wanted. */
function plainWords(text: string): string {
  const cleaned = text.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").replace(/\s+/g, " ").trim();
  return cleaned || text;
}

/** What the Result column says: the top three passing results get the trainer's own rank word (TOPPER, 2nd RANK, 3rd RANK), everyone else PASS / NEED IMPROVEMENT / FAIL. */
export function resultLabel(r: Pick<QuizSessionResultRow, "rank" | "grade" | "open_link_id">, config: RankTitleConfig | null | undefined): string {
  const title = rankTitleFor(r.rank, r.grade, config, !!r.open_link_id);
  return title ? plainWords(title.badge) : r.grade.replace("_", " ");
}

/** One test after the other (oldest first), and inside each test the best result first - rank 1 at the top, then 2, 3 ... */
export function sortResultsForReport(rows: QuizSessionResultRow[]): QuizSessionResultRow[] {
  const sessionTime = new Map<string, string>();
  for (const r of rows) {
    const t = r.ended_at ?? "";
    const known = sessionTime.get(r.session_id);
    if (known === undefined || t < known) sessionTime.set(r.session_id, t);
  }
  const rankKey = (r: QuizSessionResultRow) => (r.open_link_id ? Number.MAX_SAFE_INTEGER : r.rank);
  return rows.slice().sort(
    (a, b) =>
      (sessionTime.get(a.session_id) ?? "").localeCompare(sessionTime.get(b.session_id) ?? "") ||
      a.session_id.localeCompare(b.session_id) ||
      rankKey(a) - rankKey(b) ||
      b.percent_correct - a.percent_correct ||
      a.display_name.localeCompare(b.display_name)
  );
}

/** One row per participant per session — the "Detailed Report" / Performance table shape. Best result first inside each test. */
export function buildDetailedReportCsv(rows: QuizSessionResultRow[], rankTitles?: RankTitleConfig | null): string {
  const header = ["Date", "Time", "Test Name", "Trainee", "Score", "Correct", "Total", "Marks", "Total Marks", "Percent", "Rank", "Result"];
  const lines = [header, ...sortResultsForReport(rows).map((r) => [
    formatDate(r.ended_at),
    formatTime(r.ended_at),
    r.quiz_title,
    r.display_name,
    String(r.score),
    String(r.correct_count),
    String(r.total_questions),
    r.marks_obtained != null ? String(r.marks_obtained) : "",
    r.marks_obtained != null && r.total_marks != null ? String(r.total_marks) : "",
    `${r.percent_correct}%`,
    r.open_link_id ? "" : String(r.rank),
    resultLabel(r, rankTitles),
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
