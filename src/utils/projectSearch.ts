// Search for projects by what people actually type: a name, an area ("Dwarka Expressway") or a sector ("Sector 53").
//
//  * every typed word must be found (in any order), each as the START of a word — "dwar exp" finds "Dwarka Expressway";
//  * a number must match a whole number — "53" finds Sector 53, never Sector 530;
//  * "sector 53" must be the pair Sector + 53 side by side, so a project that merely mentions "53 acres" is not returned;
//  * "sec 53", "sec-53", "sector53" and "Sector No. 53" are all understood as "sector 53";
//  * words listed in SEARCH_ALIASES are treated as one and the same word (both in what is typed and in what is saved).
// Nothing else here knows any city, area or project — it only reads the words saved on the project.

/** Different spellings that mean the same place. The left word is read as the right word. Add a line to teach the search more. */
export const SEARCH_ALIASES: Record<string, string> = {
  gurgaon: 'gurugram',
};

/** Lower-case, punctuation removed, "sec 53" style spellings made uniform. */
export function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bsec(?:tor)?\.?[\s-]*(?:no\.?|number)?[\s.-]*(\d)/g, 'sector $1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => SEARCH_ALIASES[w] ?? w)
    .join(' ');
}

const joinClean = (fields: Array<string | null | undefined>) => normalizeSearchText(fields.filter((f): f is string => !!f).join(' '));

/**
 * True when the project's words satisfy everything typed in `query`. An empty query matches all.
 * `nameFields` are the words that identify the project (its name); `otherFields` are extra words (short description,
 * category) that may complete a text search but are never used to match a bare number.
 */
export function matchesProjectSearch(
  query: string,
  nameFields: Array<string | null | undefined>,
  otherFields: Array<string | null | undefined> = [],
): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  const nameText = joinClean(nameFields);
  const allText = joinClean([...nameFields, ...otherFields]);
  const padded = ` ${allText} `;

  for (const m of q.matchAll(/\bsector (\d+)\b/g)) {
    if (!padded.includes(` sector ${m[1]} `)) return false;
  }
  const rest = q.replace(/\bsector \d+\b/g, ' ').split(' ').filter(Boolean);
  if (rest.length === 0) return true;

  const nameWords = nameText.split(' ');
  const allWords = allText.split(' ');
  return rest.every((tok) => (/^\d+$/.test(tok) ? nameWords.includes(tok) : allWords.some((w) => w.startsWith(tok))));
}
