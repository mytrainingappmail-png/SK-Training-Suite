import { describe, it, expect } from "vitest";
import { buildQuizCsv, type ExportQuiz } from "../../services/quiz/quizExportService";
import { csvRowsToQuestions, parseCsv } from "../../services/quiz/quizCsvService";
import { hasHindi } from "../../services/quiz/quizHindiService";

const base = { is_hidden: false, image_url: null, hotspot_zones: null, target_x: null, target_y: null, target_radius: null };

function quizWith(hindi: boolean): ExportQuiz {
  return {
    title: "T", description: "", mode: "live", difficulty: "Medium", default_timer_seconds: 20, passing_score_pct: 60, exam_duration_minutes: null,
    questions: [
      {
        ...base, question_text: "What is RERA?", type: "mcq", timer_seconds: null, marks: 1, explanation: "A law.",
        ...(hindi ? { question_text_hi: "RERA kya hai?".replace("RERA kya hai?", "RERA क्या है?"), explanation_hi: "एक law है।" } : {}),
        options: [
          { option_text: "A law", option_text_hi: hindi ? "एक law" : null, is_correct: true },
          { option_text: "A bank", option_text_hi: hindi ? "एक bank" : null, is_correct: false },
        ],
      },
    ],
  };
}

describe("Hindi columns in the test CSV", () => {
  it("are left out when no question has Hindi", () => {
    const header = parseCsv(buildQuizCsv(quizWith(false)))[0];
    expect(header.some((h) => h.toLowerCase().includes("hindi"))).toBe(false);
  });

  it("are written and read back when a question has Hindi", () => {
    const rows = parseCsv(buildQuizCsv(quizWith(true)));
    expect(rows[0]).toContain("Question_Hindi");
    const { questions, errors } = csvRowsToQuestions(rows);
    expect(errors).toEqual([]);
    expect(questions[0].question_text_hi).toBe("RERA क्या है?");
    expect(questions[0].explanation_hi).toBe("एक law है।");
    expect(questions[0].options.map((o) => o.option_text_hi)).toEqual(["एक law", "एक bank"]);
  });

  it("keeps working for an old CSV without Hindi columns", () => {
    const { questions } = csvRowsToQuestions(parseCsv("Question,Option1,Option2,CorrectAnswer\nWhat?,a,b,a"));
    expect(questions[0].question_text_hi).toBeNull();
    expect(questions[0].options[0].option_text_hi).toBeNull();
  });
});

describe("hasHindi", () => {
  it("is true when any part has Hindi and false when none does", () => {
    expect(hasHindi({ question_text: "q", explanation: "", options: [{ option_text: "a" }] })).toBe(false);
    expect(hasHindi({ question_text: "q", explanation: "", options: [{ option_text: "a", option_text_hi: "अ" }] })).toBe(true);
    expect(hasHindi({ question_text: "q", question_text_hi: "  ", explanation: "", options: [] })).toBe(false);
  });
});
