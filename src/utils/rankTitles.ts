// Top-rank titles: the three best results of a session get their own title ("🏆 TOPPER", "🥈 2nd RANK", "🥉 3rd RANK") instead of
// plain PASS — on the results, on the trainee's own screen and on the certificate. Every word is the trainer's own (Quiz Settings →
// Top Rank Titles); this file holds no wording, only the rule and the look of the badge.

export interface RankTitle {
  /** The label on the results badge, e.g. "🏆 TOPPER". */
  badge: string;
  /** The heading on the trainee's own result screen. */
  title: string;
  /** The message under it. */
  message: string;
  /** The certificate heading, e.g. "Certificate of Excellence". */
  cert_title: string;
  /** The certificate line, e.g. "has secured the 1st Rank (Topper) in". */
  cert_line: string;
  /** Said after the percentage on the certificate, e.g. "Rank 1 · TOPPER". */
  cert_score: string;
}

export interface RankTitleConfig {
  enabled: boolean;
  titles: RankTitle[];
}

export const RANK_TITLE_FIELDS: { key: keyof RankTitle; label: string; hint: string; multiline?: boolean }[] = [
  { key: "badge", label: "Result label", hint: "Shown instead of PASS on the results, e.g. 🏆 TOPPER" },
  { key: "title", label: "Trainee's heading", hint: "Big heading on the trainee's own result screen" },
  { key: "message", label: "Trainee's message", hint: "A line under the heading", multiline: true },
  { key: "cert_title", label: "Certificate heading", hint: "e.g. Certificate of Excellence" },
  { key: "cert_line", label: "Certificate line", hint: "e.g. has secured the 1st Rank in" },
  { key: "cert_score", label: "Certificate score line", hint: "Comes after the percentage, e.g. Rank 1 · TOPPER" },
];

/** The title for this result, or null (-> show the normal PASS / NEED IMPROVEMENT / FAIL). Only a pass can be a top rank, and a
 * one-trainee attempt of an open link has no ranking. */
export function rankTitleFor(
  rank: number | null | undefined,
  grade: string | null | undefined,
  config: RankTitleConfig | null | undefined,
  isOpenLink = false
): RankTitle | null {
  if (!config || !config.enabled || isOpenLink || grade !== "PASS") return null;
  if (!rank || rank < 1 || rank > 3) return null;
  const t = config.titles[rank - 1];
  return t && t.badge?.trim() ? t : null;
}

/** Gold, silver and bronze. */
export const RANK_BADGE_CLASS: Record<number, string> = {
  1: "text-amber-950 bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 border-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.55)]",
  2: "text-slate-900 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-300 border-slate-100 shadow-[0_0_8px_rgba(226,232,240,0.45)]",
  3: "text-orange-950 bg-gradient-to-r from-orange-300 via-amber-500 to-orange-400 border-orange-200 shadow-[0_0_8px_rgba(251,146,60,0.45)]",
};

export function parseRankTitles(raw: unknown): RankTitle[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
    return { badge: s("badge"), title: s("title"), message: s("message"), cert_title: s("cert_title"), cert_line: s("cert_line"), cert_score: s("cert_score") };
  });
}
