// Makes the PDF of a test. The test is drawn as a normal web page (so Hindi / any script comes out right), whole
// questions are packed onto A4 pages (a question is never cut across two pages), and each page becomes one picture
// in the PDF. The PDF libraries are loaded only when somebody actually presses Download.

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

import QuizPrintView, { PRINT_WIDTH } from "./QuizPrintView";
import { safeFileName, type ExportQuiz } from "../../services/quiz/quizExportService";

const PAGE_W = 794; // A4 at 96 dpi
const PAGE_H = 1123;
const PAD = 40;
const FOOT = 28;
const CONTENT_H = PAGE_H - PAD * 2 - FOOT;
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Devanagari', 'Nirmala UI', sans-serif";

/** Waits for the pictures (hotspot images) to load; one that cannot be loaded is simply left out. */
async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.race([
    Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) return resolve();
            img.onload = () => resolve();
            img.onerror = () => { img.style.display = "none"; resolve(); };
          })
      )
    ),
    new Promise<void>((resolve) => setTimeout(resolve, 12000)),
  ]);
}

export async function downloadQuizPdf(
  quiz: ExportQuiz,
  opts: { withAnswers: boolean; onProgress?: (done: number, total: number) => void }
): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas-pro")]);

  const host = document.createElement("div");
  host.setAttribute("data-info-tip-ui", ""); // the info-tips layer must not look at this hidden page
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;background:#fff;pointer-events:none;`;
  document.body.appendChild(host);
  const measure = document.createElement("div");
  measure.style.width = `${PRINT_WIDTH}px`;
  host.appendChild(measure);
  const root = createRoot(measure);

  try {
    flushSync(() => root.render(<QuizPrintView quiz={quiz} withAnswers={opts.withAnswers} />));
    await waitForImages(measure);

    const blocks = Array.from(measure.querySelectorAll<HTMLElement>("[data-pdf-block]"));
    const heights = blocks.map((b) => b.offsetHeight);

    // whole blocks per page, in order
    const pages: number[][] = [];
    let current: number[] = [];
    let used = 0;
    blocks.forEach((_, i) => {
      if (current.length > 0 && used + heights[i] > CONTENT_H) {
        pages.push(current);
        current = [];
        used = 0;
      }
      current.push(i);
      used += heights[i];
    });
    if (current.length > 0) pages.push(current);

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();

    for (let p = 0; p < pages.length; p++) {
      const page = document.createElement("div");
      page.style.cssText = `width:${PAGE_W}px;height:${PAGE_H}px;box-sizing:border-box;padding:${PAD}px;background:#fff;position:relative;overflow:hidden;color:#111827;font-family:${FONT};`;
      const inner = document.createElement("div");
      inner.style.cssText = `width:${PRINT_WIDTH}px;`;
      pages[p].forEach((i) => inner.appendChild(blocks[i].cloneNode(true)));
      // a single question taller than a page (huge picture) is shrunk to fit rather than cut
      if (pages[p].length === 1 && heights[pages[p][0]] > CONTENT_H) {
        const k = CONTENT_H / heights[pages[p][0]];
        inner.style.transform = `scale(${k})`;
        inner.style.transformOrigin = "top left";
      }
      page.appendChild(inner);
      const foot = document.createElement("div");
      foot.textContent = `${quiz.title} · Page ${p + 1} of ${pages.length}`;
      foot.style.cssText = `position:absolute;left:${PAD}px;right:${PAD}px;bottom:16px;font-size:11px;color:#6b7280;text-align:center;border-top:1px solid #e5e7eb;padding-top:6px;`;
      page.appendChild(foot);
      host.appendChild(page);

      const canvas = await html2canvas(page, { scale: 1.6, useCORS: true, backgroundColor: "#ffffff", logging: false });
      host.removeChild(page);
      if (p > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, pw, ph);
      opts.onProgress?.(p + 1, pages.length);
    }

    pdf.save(`${safeFileName(quiz.title)}-${opts.withAnswers ? "answer-key" : "question-paper"}.pdf`);
  } finally {
    root.unmount();
    host.remove();
  }
}
