import { describe, it, expect } from "vitest";
import { normalizeLabel, routePattern, labelKey } from "../infoTipMatching";

describe("routePattern", () => {
  it("replaces ids so one tip covers every session", () => {
    expect(routePattern("/quiz-admin/host/3f2a9c1e-1b2c-4d5e-8f90-1234567890ab")).toBe("/quiz-admin/host/:id");
    expect(routePattern("/quiz-admin/exams/session/3F2A9C1E-1B2C-4D5E-8F90-1234567890AB/")).toBe("/quiz-admin/exams/session/:id");
    expect(routePattern("/quiz-admin/results")).toBe("/quiz-admin/results");
    expect(routePattern("/")).toBe("/");
  });
});

describe("normalizeLabel", () => {
  it("drops emoji and arrows around the words", () => {
    expect(normalizeLabel("⏹ End exam & show results")).toBe("End exam & show results");
    expect(normalizeLabel("▶ Resume")).toBe("Resume");
    expect(normalizeLabel("← Back to Exams")).toBe("Back to Exams");
    expect(normalizeLabel("Next Question →")).toBe("Next Question");
    expect(normalizeLabel("+ Extend time for everyone")).toBe("Extend time for everyone");
  });
  it("keeps closing brackets and removes a trailing counter", () => {
    expect(normalizeLabel("🙈 Hide marks (projector)")).toBe("Hide marks (projector)");
    expect(normalizeLabel("Employees (12)")).toBe("Employees");
  });
  it("collapses whitespace", () => {
    expect(normalizeLabel("  Start \n  over ")).toBe("Start over");
  });
  it("matches regardless of case", () => {
    expect(labelKey("Start over")).toBe(labelKey(" START OVER "));
  });
});
