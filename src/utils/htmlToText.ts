/** Visible text of an HTML string (lists and paragraphs kept on separate lines) — used to feed page content to the AI Quiz Maker. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style").forEach((n) => n.remove());
  doc.querySelectorAll("br").forEach((n) => n.replaceWith("\n"));
  doc.querySelectorAll("p,div,li,h1,h2,h3,h4,h5,h6,tr,blockquote").forEach((n) => n.append("\n"));
  return (doc.body.textContent ?? "").replace(/[ \t\u00a0]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
