import { HELP_CATEGORIES } from "../types/helpArticle";
import type { HelpArticle } from "../types/helpArticle";
import { sanitizeHtml } from "./sanitizeHtml";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function categoryLabel(value: string): string {
  return HELP_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

const STYLE = `
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; background: #f8fafc; line-height: 1.6; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 32px 20px 64px; }
  header { border-bottom: 3px solid #d4a017; padding-bottom: 16px; margin-bottom: 24px; }
  header h1 { margin: 0; font-size: 28px; color: #0f1f3d; }
  header p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
  nav { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 32px; }
  nav h2 { margin: 0 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; }
  nav .cat { font-weight: 700; margin-top: 10px; color: #0f1f3d; }
  nav a { display: block; color: #4338ca; text-decoration: none; padding: 1px 0 1px 12px; font-size: 14px; }
  article { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; }
  article .cat { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #4338ca; }
  article h2.title { margin: 4px 0 12px; font-size: 21px; color: #0f1f3d; }
  article h2 { font-size: 16px; margin: 18px 0 6px; }
  article ul, article ol { padding-left: 22px; }
  @media print { body { background: #fff; } article, nav { border: none; box-shadow: none; page-break-inside: avoid; } article { page-break-inside: auto; } }
`;

function orderedByCategory(articles: HelpArticle[]): HelpArticle[] {
  const rank = (v: string) => {
    const i = HELP_CATEGORIES.findIndex((c) => c.value === v);
    return i === -1 ? 999 : i;
  };
  return [...articles].sort((a, b) => rank(a.category) - rank(b.category) || a.display_order - b.display_order || a.title.localeCompare(b.title));
}

/** One self-contained HTML file: contents list + every article. Opens anywhere; Ctrl+P saves it as a PDF. */
export function buildHelpGuideHtml(articles: HelpArticle[], title = "User Guide", subtitle = ""): string {
  const sorted = orderedByCategory(articles);
  let lastCat = "";
  const toc = sorted.map((a) => {
    const head = a.category !== lastCat ? `<div class="cat">${esc(categoryLabel(a.category))}</div>` : "";
    lastCat = a.category;
    return `${head}<a href="#a-${esc(a.id)}">${esc(a.title)}</a>`;
  }).join("");

  const body = sorted.map((a) => `
    <article id="a-${esc(a.id)}">
      <div class="cat">${esc(categoryLabel(a.category))}</div>
      <h2 class="title">${esc(a.title)}</h2>
      ${sanitizeHtml(a.content_html)}
    </article>`).join("");

  const stamp = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${STYLE}</style></head><body><div class="wrap">
    <header><h1>${esc(title)}</h1><p>${esc(subtitle ? subtitle + " · " : "")}${sorted.length} guides · downloaded ${esc(stamp)}</p></header>
    <nav><h2>Contents</h2>${toc}</nav>
    ${body}
  </div></body></html>`;
}

export function downloadHtmlFile(filename: string, html: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens the guide in a new window and triggers the browser's print dialog ("Save as PDF"). */
export function printHtml(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
  return true;
}
