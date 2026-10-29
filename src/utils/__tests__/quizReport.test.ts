import { describe, it, expect } from "vitest";
import { buildDetailedReportCsv, resultLabel, sortResultsForReport } from "../../services/quiz/quizReportService";
import { parseCsv } from "../../services/quiz/quizCsvService";
import type { QuizSessionResultRow } from "../../types/quiz";
import type { RankTitleConfig } from "../rankTitles";

const t = (badge: string) => ({ badge, title: "", message: "", cert_title: "", cert_line: "", cert_score: "" });
const config: RankTitleConfig = { enabled: true, titles: [t("🏆 TOPPER"), t("🥈 2nd RANK"), t("🥉 3rd RANK")] };

function row(over: Partial<QuizSessionResultRow>): QuizSessionResultRow {
  return {
    session_id: "s1", quiz_title: "Spiti Test", ended_at: "2026-10-29T10:00:00.000Z", display_name: "X", rank: 1, percent_correct: 100, grade: "PASS",
    score: 0, correct_count: 1, total_questions: 1, marks_obtained: 1, total_marks: 1, participant_id: "p", ...over,
  } as QuizSessionResultRow;
}

describe("resultLabel", () => {
  it("gives the top three passing results the rank words without the emoji", () => {
    expect(resultLabel(row({ rank: 1 }), config)).toBe("TOPPER");
    expect(resultLabel(row({ rank: 2 }), config)).toBe("2nd RANK");
    expect(resultLabel(row({ rank: 3 }), config)).toBe("3rd RANK");
    expect(resultLabel(row({ rank: 4 }), config)).toBe("PASS");
  });

  it("keeps FAIL and NEED IMPROVEMENT even for a top rank, and PASS when titles are off", () => {
    expect(resultLabel(row({ rank: 1, grade: "FAIL" }), config)).toBe("FAIL");
    expect(resultLabel(row({ rank: 2, grade: "NEED_IMPROVEMENT" }), config)).toBe("NEED IMPROVEMENT");
    expect(resultLabel(row({ rank: 1 }), { ...config, enabled: false })).toBe("PASS");
    expect(resultLabel(row({ rank: 1 }), null)).toBe("PASS");
  });
});

describe("sortResultsForReport", () => {
  it("puts the best result first inside each test and keeps tests apart, oldest first", () => {
    const rows = [
      row({ session_id: "b", ended_at: "2026-10-29T12:00:00.000Z", display_name: "B2", rank: 2 }),
      row({ session_id: "a", ended_at: "2026-10-29T10:00:00.000Z", display_name: "A3", rank: 3 }),
      row({ session_id: "b", ended_at: "2026-10-29T12:00:00.000Z", display_name: "B1", rank: 1 }),
      row({ session_id: "a", ended_at: "2026-10-29T10:00:00.000Z", display_name: "A1", rank: 1 }),
      row({ session_id: "a", ended_at: "2026-10-29T10:00:00.000Z", display_name: "A2", rank: 2 }),
    ];
    expect(sortResultsForReport(rows).map((r) => r.display_name)).toEqual(["A1", "A2", "A3", "B1", "B2"]);
  });
});

describe("buildDetailedReportCsv", () => {
  it("writes a Time column, rank order and the rank words", () => {
    const rows = [
      row({ display_name: "Third", rank: 3, percent_correct: 98 }),
      row({ display_name: "First", rank: 1 }),
      row({ display_name: "Fifth", rank: 5, percent_correct: 90 }),
      row({ display_name: "Second", rank: 2 }),
    ];
    const parsed = parseCsv(buildDetailedReportCsv(rows, config));
    expect(parsed[0]).toContain("Time");
    const nameCol = parsed[0].indexOf("Trainee");
    const resultCol = parsed[0].indexOf("Result");
    expect(parsed.slice(1).map((r) => [r[nameCol], r[resultCol]])).toEqual([
      ["First", "TOPPER"], ["Second", "2nd RANK"], ["Third", "3rd RANK"], ["Fifth", "PASS"],
    ]);
  });
});
