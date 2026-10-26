import { describe, it, expect } from "vitest";
import { rankTitleFor, parseRankTitles, type RankTitleConfig } from "../rankTitles";

const t = (badge: string) => ({ badge, title: "T", message: "M", cert_title: "C", cert_line: "L", cert_score: "S" });
const config: RankTitleConfig = { enabled: true, titles: [t("ONE"), t("TWO"), t("THREE")] };

describe("rankTitleFor", () => {
  it("gives the first three passing ranks their own title", () => {
    expect(rankTitleFor(1, "PASS", config)?.badge).toBe("ONE");
    expect(rankTitleFor(2, "PASS", config)?.badge).toBe("TWO");
    expect(rankTitleFor(3, "PASS", config)?.badge).toBe("THREE");
  });

  it("leaves everyone else on the normal badge", () => {
    expect(rankTitleFor(4, "PASS", config)).toBeNull();
    expect(rankTitleFor(null, "PASS", config)).toBeNull();
    expect(rankTitleFor(0, "PASS", config)).toBeNull();
  });

  it("never gives a title to a result that did not pass", () => {
    expect(rankTitleFor(1, "FAIL", config)).toBeNull();
    expect(rankTitleFor(2, "NEED_IMPROVEMENT", config)).toBeNull();
  });

  it("respects the switch, open-link attempts and an empty label", () => {
    expect(rankTitleFor(1, "PASS", { ...config, enabled: false })).toBeNull();
    expect(rankTitleFor(1, "PASS", config, true)).toBeNull();
    expect(rankTitleFor(1, "PASS", { enabled: true, titles: [t("  ")] })).toBeNull();
    expect(rankTitleFor(1, "PASS", null)).toBeNull();
  });
});

describe("parseRankTitles", () => {
  it("returns an empty list for anything that is not a list", () => {
    expect(parseRankTitles(null)).toEqual([]);
    expect(parseRankTitles("x")).toEqual([]);
  });

  it("fills missing fields with empty text", () => {
    const [first] = parseRankTitles([{ badge: "A" }]);
    expect(first.badge).toBe("A");
    expect(first.cert_line).toBe("");
  });
});
