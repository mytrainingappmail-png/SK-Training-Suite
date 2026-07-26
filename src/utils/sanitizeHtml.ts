import DOMPurify from "dompurify";

/**
 * Every place in the app that renders trainer/admin-authored rich text via
 * dangerouslySetInnerHTML must run it through this first — the shared
 * ContentEditor (a hand-rolled contentEditable surface with raw clipboard
 * paste) never sanitizes on save, so an unsanitized render is a stored XSS
 * reachable by any Trainer/Admin account. DOMPurify's default profile keeps
 * ordinary formatting (tables, images, inline color/style, links) intact —
 * it only strips scripts, event handlers, and dangerous URL schemes.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
}
