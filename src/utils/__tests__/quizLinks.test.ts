import { describe, it, expect } from "vitest";
import { questionContentKey, questionForOtherTest, fitsMode } from "../../services/quiz/quizLinkService";
import type { QuestionForm } from "../../repositories/quiz/quizRepository";

const q: QuestionForm = {
  origin_uid: "u1", home_quiz_id: "home", question_text: "What is RERA?", type: "mcq", timer_seconds: 20, marks: 2,
  explanation: "A law", is_hidden: false, source_label: null, source_question_id: null,
  options: [{ option_text: "A law", is_correct: true }, { option_text: "A bank", is_correct: false }],
  image_url: null, target_x: null, target_y: null, target_radius: null, hotspot_zones: null,
};

describe("questionContentKey", () => {
  it("ignores marks, timer, hidden flag and surrounding spaces", () => {
    const other = { ...q, marks: 5, timer_seconds: null, is_hidden: true, question_text: "  What is RERA?  " };
    expect(questionContentKey(other)).toBe(questionContentKey(q));
  });

  it("changes when the text, an option, the correct answer or the Hindi changes", () => {
    const base = questionContentKey(q);
    expect(questionContentKey({ ...q, question_text: "What is RERA now?" })).not.toBe(base);
    expect(questionContentKey({ ...q, options: [{ option_text: "A law", is_correct: false }, { option_text: "A bank", is_correct: true }] })).not.toBe(base);
    expect(questionContentKey({ ...q, options: [{ option_text: "A law!", is_correct: true }, q.options[1]] })).not.toBe(base);
    expect(questionContentKey({ ...q, question_text_hi: "RERA क्या है?" })).not.toBe(base);
  });

  it("treats an empty zone list like no zones", () => {
    expect(questionContentKey({ ...q, hotspot_zones: [] })).toBe(questionContentKey({ ...q, hotspot_zones: null }));
  });
});

describe("questionForOtherTest", () => {
  it("keeps the identity when linked, and drops it for a separate copy", () => {
    const linked = questionForOtherTest({ ...q, localId: "x" } as QuestionForm, true, "Vatika Basics");
    expect(linked.origin_uid).toBe("u1");
    expect(linked.home_quiz_id).toBe("home");
    expect(linked.source_label).toBe("Vatika Basics");
    expect("localId" in linked).toBe(false);
    const separate = questionForOtherTest(q, false, "Vatika Basics");
    expect(separate.origin_uid).toBeNull();
    expect(separate.home_quiz_id).toBeNull();
  });
});

describe("fitsMode", () => {
  it("keeps typed-answer questions out of live quizzes only", () => {
    expect(fitsMode({ type: "written" }, "live")).toBe(false);
    expect(fitsMode({ type: "written" }, "exam")).toBe(true);
    expect(fitsMode({ type: "mcq" }, "live")).toBe(true);
  });
});
