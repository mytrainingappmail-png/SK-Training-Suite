import { describe, expect, it } from "vitest";

import { generateTemporaryPassword } from "../passwordGenerator";
import { resolveForBranch } from "../branchScoping";
import { computeDeadline, formatDuration } from "../deadline";

describe("generateTemporaryPassword", () => {
  it("is 10 characters with no look-alike characters", () => {
    for (let i = 0; i < 200; i++) {
      const p = generateTemporaryPassword();
      expect(p).toHaveLength(10);
      expect(p).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/); // no I, O, 0, 1, l
    }
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateTemporaryPassword()));
    expect(seen.size).toBeGreaterThan(190);
  });
});

describe("resolveForBranch", () => {
  const generic = { id: "g1", branch_id: null, source_id: null };
  const mumbaiCopy = { id: "m1", branch_id: "mumbai", source_id: "g1" };
  const delhiOnly = { id: "d1", branch_id: "delhi", source_id: null };
  const rows = [generic, mumbaiCopy, delhiOnly];

  it("shows a branch its own override instead of the generic row", () => {
    expect(resolveForBranch(rows, "mumbai").map((r) => r.id)).toEqual(["m1"]);
  });

  it("shows other branches the generic row and never another branch's content", () => {
    expect(resolveForBranch(rows, "pune").map((r) => r.id)).toEqual(["g1"]);
    expect(resolveForBranch(rows, "delhi").map((r) => r.id)).toEqual(["g1", "d1"]);
  });

  it("shows only generic content when the employee has no branch", () => {
    expect(resolveForBranch(rows, null).map((r) => r.id)).toEqual(["g1"]);
  });
});

describe("deadline helpers", () => {
  const from = new Date("2026-01-01T00:00:00.000Z");

  it("adds hours and days exactly", () => {
    expect(computeDeadline(5, "hours", from)).toBe("2026-01-01T05:00:00.000Z");
    expect(computeDeadline(2, "days", from)).toBe("2026-01-03T00:00:00.000Z");
  });

  it("words durations sensibly", () => {
    expect(formatDuration(1, "hours")).toBe("1 hour");
    expect(formatDuration(3, "days")).toBe("3 days");
    expect(formatDuration(0, "days")).toBe("No deadline");
  });
});
