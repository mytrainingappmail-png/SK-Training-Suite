// The background behind the questions on a trainee's screen: a faded logo / the trainer's own image, and optionally the
// trainee's own name tiled faintly over the page. It is painted as extra CSS background layers on the page itself, under a
// dark veil of the page colour, so the question text and options always sit on top and stay readable - however the image looks.
// The strength is clamped to the same range the database enforces (QUIZ_BG_OPACITY_MIN..MAX).

import type { CSSProperties } from "react";
import {
  QUIZ_BG_NAME_OPACITY_MAX,
  QUIZ_BG_NAME_OPACITY_MIN,
  QUIZ_BG_OPACITY_MAX,
  QUIZ_BG_OPACITY_MIN,
  type QuizBackground,
} from "../types/quiz";

/** The page colour the veil is made of (Tailwind slate-950, the colour of every trainee screen). */
const PAGE_RGB = "2, 6, 23";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** A small tile with the name written slantwise, faint enough not to disturb reading. */
function nameTile(name: string, opacityPercent: number): string {
  const alpha = (clamp(opacityPercent, QUIZ_BG_NAME_OPACITY_MIN, QUIZ_BG_NAME_OPACITY_MAX) / 100).toFixed(2);
  const text = xmlEscape(name.trim().slice(0, 40));
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='150'>` +
    `<text x='130' y='75' text-anchor='middle' transform='rotate(-25 130 75)' font-family='sans-serif' font-size='16' font-weight='600' fill='rgba(148,163,184,${alpha})'>${text}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Inline style to put on a trainee screen's root element (undefined = nothing to show, leave the page as it is).
 * previewWidth: when the style is for a small phone mock-up (Settings preview) instead of a real screen, the sizes are
 * scaled to what they would be on a 375px-wide phone, so the preview looks like the real thing.
 */
export function backgroundStyle(bg: QuizBackground | null | undefined, viewerName?: string | null, previewWidth?: number): CSSProperties | undefined {
  const k = previewWidth ? previewWidth / 375 : null;
  const px = (n: number) => `${Math.round(n * (k ?? 1) * 10) / 10}px`;
  if (!bg) return undefined;
  const showImage = bg.kind !== "none" && !!bg.url;
  const showName = bg.name_watermark && !!viewerName?.trim();
  if (!showImage && !showName) return undefined;

  const images: string[] = [];
  const sizes: string[] = [];
  const repeats: string[] = [];
  const positions: string[] = [];

  if (showName) {
    images.push(nameTile(viewerName as string, bg.name_opacity));
    sizes.push(`${px(260)} ${px(150)}`);
    repeats.push("repeat");
    positions.push("0 0");
  }

  if (showImage) {
    const strength = clamp(bg.opacity, QUIZ_BG_OPACITY_MIN, QUIZ_BG_OPACITY_MAX) / 100;
    const veil = `rgba(${PAGE_RGB}, ${(1 - strength).toFixed(2)})`;
    images.push(`linear-gradient(${veil}, ${veil})`);
    sizes.push("auto");
    repeats.push("no-repeat");
    positions.push("0 0");

    images.push(`url("${String(bg.url).replace(/"/g, "%22")}")`);
    switch (bg.layout) {
      case "tile":
        sizes.push(px(140));
        repeats.push("repeat");
        positions.push("0 0");
        break;
      case "corner":
        sizes.push(k ? px(150) : "min(40vw, 180px)");
        repeats.push("no-repeat");
        positions.push(`right ${px(16)} bottom ${px(16)}`);
        break;
      case "fill":
        sizes.push("cover");
        repeats.push("no-repeat");
        positions.push("center");
        break;
      default:
        sizes.push(k ? px(300) : "min(80vmin, 560px)");
        repeats.push("no-repeat");
        positions.push("center");
    }
  }

  return {
    backgroundImage: images.join(", "),
    backgroundSize: sizes.join(", "),
    backgroundRepeat: repeats.join(", "),
    backgroundPosition: positions.join(", "),
    backgroundAttachment: "fixed",
  };
}
