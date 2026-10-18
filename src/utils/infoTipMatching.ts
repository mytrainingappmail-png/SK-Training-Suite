// How an "i" tip finds its control. A tip is tied to (screen, visible text of the control), so it works on any
// screen without touching that screen's code — and never changes the screen's own elements.

/** Anything a tip can be attached to: buttons, links, headings, labels, table headings. */
export const TIP_CANDIDATE_SELECTOR =
  'button, a[href], [role="button"], summary, h1, h2, h3, h4, label, th, legend, [data-tip-label]';

/** Controls get the "i" on their top-right corner; text (headings, labels) gets it right after the words. */
export const TIP_BUTTON_LIKE_SELECTOR = 'button, a[href], [role="button"], summary';

const TIP_LABEL_MAX_CHARS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "/quiz-admin/host/3f2a…" -> "/quiz-admin/host/:id" so one tip covers every session. */
export function routePattern(pathname: string): string {
  const segs = pathname
    .split("/")
    .filter(Boolean)
    .map((s) => (UUID.test(s) || /^\d+$/.test(s) ? ":id" : s));
  return "/" + segs.join("/");
}

/** Visible text -> stable label: no emoji/arrows around it, no trailing "(3)" counter, single spaces. */
export function normalizeLabel(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/^[^\p{L}\p{N}]+/u, "");
  s = s.replace(/[^\p{L}\p{N})\]?!]+$/u, "");
  s = s.replace(/\s*\(\d+\)$/, "");
  return s.trim();
}

export function labelKey(label: string): string {
  return label.trim().toLowerCase();
}

/** The label a tip would attach to for this element ("" = not tippable). */
export function labelOfElement(el: Element): string {
  const explicit = el.getAttribute("data-tip-label");
  let n = normalizeLabel(explicit ?? el.textContent ?? "");
  if (!n) n = normalizeLabel(el.getAttribute("aria-label") ?? el.getAttribute("title") ?? "");
  if (n.length < 2 || n.length > TIP_LABEL_MAX_CHARS || !/\p{L}/u.test(n)) return "";
  return n;
}
