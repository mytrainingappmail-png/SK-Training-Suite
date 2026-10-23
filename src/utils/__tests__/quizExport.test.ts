import { describe, it, expect } from "vitest";
import { buildQuizCsv, correctAnswerText, safeFileName, type ExportQuiz } from "../../services/quiz/quizExportService";
import { csvRowsToQuestions, parseCsv } from "../../services/quiz/quizCsvService";

const base = {
  explanation: "",
  is_hidden: false,
  image_url: null,
  hotspot_zones: null,
  target_x: null,
  target_y: null,
  target_radius: null,
};

const quiz: ExportQuiz = {
  title: "RERA Basics — Test #1",
  description: "",
  mode: "live",
  difficulty: "Medium",
  default_timer_seconds: 20,
  passing_score_pct: 60,
  exam_duration_minutes: null,
  questions: [
    { ...base, question_text: "What does RERA stand for?", type: "mcq", timer_seconds: null, marks: 1, explanation: "Set up in 2016, \"important\" law.",
      options: [{ option_text: "Real Estate Regulatory Authority", is_correct: true }, { option_text: "Real Estate Registration Act", is_correct: false }, { option_text: "Residential, Estate Reform Agency", is_correct: false }, { option_text: "None", is_correct: false }] },
    { ...base, question_text: "Registration is mandatory.", type: "truefalse", timer_seconds: 15, marks: 2,
      options: [{ option_text: "True", is_correct: true }, { option_text: "False", is_correct: false }] },
    { ...base, question_text: "Six options question", type: "mcq", timer_seconds: null, marks: 1,
      options: ["a", "b", "c", "d", "e", "f"].map((t, i) => ({ option_text: t, is_correct: i === 5 })) },
    { ...base, question_text: "Hidden one", type: "mcq", timer_seconds: null, marks: 1, is_hidden: true,
      options: [{ option_text: "x", is_correct: true }, { option_text: "y", is_correct: false }] },
    { ...base, question_text: "Tap the gate", type: "hotspot", timer_seconds: null, marks: 1, image_url: "https://x/y.png", target_x: 50, target_y: 50, target_radius: 10, options: [] },
  ],
};

describe("quiz CSV download", () => {
  const csv = buildQuizCsv(quiz);
  const rows = parseCsv(csv);

  it("has every visible question, with options, correct answer, timer, marks and explanation", () => {
    expect(rows[0]).toEqual(["Question", "Type", "Option1", "Option2", "Option3", "Option4", "Option5", "Option6", "CorrectAnswer", "Timer", "Marks", "Explanation", "ImageURL"]);
    expect(rows.length).toBe(1 + 4); // hidden question left out
    const first = rows[1];
    expect(first[0]).toBe("What does RERA stand for?");
    expect(first[8]).toBe("Real Estate Regulatory Authority");
    expect(first[9]).toBe("20"); // follows the quiz timer -> the seconds it really gets
    expect(first[11]).toBe('Set up in 2016, "important" law.');
    expect(rows[2][9]).toBe("15");
    expect(rows[2][10]).toBe("2");
  });

  it("survives commas and quotes", () => {
    expect(rows[1][11]).toContain('"important"');
  });

  it("an exam has no per-question timer column value", () => {
    const exam = parseCsv(buildQuizCsv({ ...quiz, mode: "exam" }));
    expect(exam[1][9]).toBe("");
  });

  it("describes a tap-on-image answer in words", () => {
    expect(correctAnswerText(quiz.questions[4])).toMatch(/marked area/i);
    expect(rows[4][12]).toBe("https://x/y.png");
  });

  it("can be uploaded again with Import from CSV (text questions)", () => {
    const { questions, errors } = csvRowsToQuestions(rows);
    // the tap-on-image question has no options, so import skips it and says so
    expect(questions.map((q) => q.question_text)).toEqual(["What does RERA stand for?", "Registration is mandatory.", "Six options question"]);
    expect(errors.length).toBe(1);
    expect(questions[0].options.find((o) => o.is_correct)?.option_text).toBe("Real Estate Regulatory Authority");
    expect(questions[2].options.length).toBe(6);
    expect(questions[2].options[5].is_correct).toBe(true);
    expect(questions[1].marks).toBe(2);
  });
});

describe("file names", () => {
  it("are safe for any computer", () => {
    expect(safeFileName("RERA Basics — Test #1")).toBe("RERA-Basics-Test-1");
    expect(safeFileName("???")).toBe("test");
  });
});
