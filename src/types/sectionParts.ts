// A long reading section split into PARTS that the employee reads one at a time (Induction card, Project section, Course
// lesson). The section's own text is the OVERVIEW (headline + intro) and the numbered Parts 1, 2, 3 ... come after it. The stored
// list holds them in order: the FIRST entry only stands for the overview (it carries its optional heading, its html is ignored - the
// main text stays where it always was), the others carry their own title + text.
// An empty list (or a single entry) means an ordinary one-page section, exactly like before.

export interface SectionPart { id: string; title: string; html: string; /** The picture on this part's card (optional). */ thumbnail?: string }

/** A part as the employee sees it: every part has a title and its text. */
export interface ReadablePart { id: string; title: string; html: string; thumbnail?: string }

export function newPartId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const MAIN_ID = 'main';

const isBlankHtml = (html: string) => !/<(img|video|iframe|table)\b/i.test(html) && html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim() === '';

/** Reads whatever was stored (null, a bad value...) as a list of parts. */
export function readParts(value: unknown): SectionPart[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map((p) => ({ id: typeof p.id === 'string' && p.id ? p.id : newPartId(), title: typeof p.title === 'string' ? p.title : '', html: typeof p.html === 'string' ? p.html : '', ...(typeof p.thumbnail === 'string' && p.thumbnail ? { thumbnail: p.thumbnail } : {}) }));
}

/** Adds one more part; the first time, the section's own text becomes Part 1. */
export function addPart(parts: SectionPart[]): SectionPart[] {
  const base = parts.length >= 1 ? parts : [{ id: MAIN_ID, title: '', html: '' }];
  return [...base, { id: newPartId(), title: '', html: '' }];
}

/** What gets saved: the first entry keeps only its title, extra parts without any text are dropped, and fewer than two parts means "no parts". */
export function cleanParts(parts: SectionPart[] | undefined | null): SectionPart[] {
  const list = readParts(parts);
  if (list.length < 2) return [];
  const [main, ...rest] = list;
  const kept = rest.filter((p) => !isBlankHtml(p.html));
  if (kept.length === 0) return [];
  return [
    { id: main.id || MAIN_ID, title: main.title.trim(), html: '' },
    ...kept.map((p) => ({ id: p.id, title: p.title.trim(), html: p.html, ...(p.thumbnail ? { thumbnail: p.thumbnail } : {}) })),
  ];
}

/** The parts as the employee reads them (empty = show the section as a single page). */
export function resolveParts(mainHtml: string, parts: unknown): ReadablePart[] {
  const list = cleanParts(readParts(parts));
  if (list.length < 2) return [];
  // the first entry is the section's own text = the OVERVIEW; the extra parts are Part 1, Part 2 ...
  return list.map((p, i) => ({ id: p.id, title: p.title || (i === 0 ? 'Overview' : `Part ${i}`), html: i === 0 ? mainHtml : p.html, ...(i > 0 && p.thumbnail ? { thumbnail: p.thumbnail } : {}) }));
}

/** Plain text of the extra parts (for the AI question maker, searches...). */
export function partsText(parts: unknown, stripHtml: (html: string) => string): string {
  return cleanParts(readParts(parts)).slice(1).map((p) => `${p.title}\n${stripHtml(p.html)}`).join('\n\n');
}
