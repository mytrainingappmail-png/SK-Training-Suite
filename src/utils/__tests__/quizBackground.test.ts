import { describe, expect, it } from "vitest";
import { backgroundStyle } from "../quizBackground";
import type { QuizBackground } from "../../types/quiz";

const base: QuizBackground = { kind: "image", url: "https://x.test/logo.png", opacity: 10, layout: "center", name_watermark: false, name_opacity: 6 };

describe("backgroundStyle", () => {
  it("leaves the page alone when there is nothing to show", () => {
    expect(backgroundStyle(null)).toBeUndefined();
    expect(backgroundStyle({ ...base, kind: "none" })).toBeUndefined();
    expect(backgroundStyle({ ...base, url: null })).toBeUndefined();
    expect(backgroundStyle({ ...base, kind: "none", name_watermark: true }, "   ")).toBeUndefined();
  });

  it("puts the image under a dark veil, so a 10% background leaves 90% veil", () => {
    const s = backgroundStyle(base)!;
    expect(s.backgroundImage).toContain("rgba(2, 6, 23, 0.90)");
    expect(s.backgroundImage).toContain('url("https://x.test/logo.png")');
  });

  it("keeps the strength inside the readable range even if the data says otherwise", () => {
    expect(backgroundStyle({ ...base, opacity: 90 })!.backgroundImage).toContain("rgba(2, 6, 23, 0.75)"); // never stronger than 25%
    expect(backgroundStyle({ ...base, opacity: 0 })!.backgroundImage).toContain("rgba(2, 6, 23, 0.97)"); // never fainter than 3%
  });

  it("can show only the trainee's own name, escaped", () => {
    const s = backgroundStyle({ ...base, kind: "none", name_watermark: true }, "A <b> & \"C\"")!;
    expect(decodeURIComponent(s.backgroundImage as string)).toContain("A &lt;b&gt; &amp; &quot;C&quot;");
    expect(s.backgroundImage).not.toContain("linear-gradient");
  });

  it("scales the sizes for the small phone preview", () => {
    const real = backgroundStyle(base)!;
    const preview = backgroundStyle(base, null, 187.5)!; // half of a 375px phone
    expect(real.backgroundSize).toContain("min(80vmin, 560px)");
    expect(preview.backgroundSize).toContain("150px");
  });
});
