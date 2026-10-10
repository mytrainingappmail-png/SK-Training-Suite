// Final Result — combined report. Pure functions: parsing an uploaded Excel sheet, merging every round of a folder
// (live quiz copies, exam sessions, uploaded Excel rounds) per candidate, and writing the single .xlsx report.
// Nothing here knows any company, test or column name — labels, pass marks and column titles all come from the data
// the trainer saved or mapped.

import type { FinalUploadRow } from "../../types/quiz";

// ── Reading an uploaded sheet ────────────────────────────────────────────────────────────────────────────────────

export type MappingField = "name" | "score" | "total" | "percent" | "correct" | "wrong" | "remarks";
export type ColumnMapping = Record<MappingField, number | null>;

export interface ParsedSheet {
  headers: string[];
  body: unknown[][];
}

const cellText = (v: unknown): string => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

/** The header row is the first row with at least two filled cells; everything under it is data. */
export function parseSheet(raw: unknown[][]): ParsedSheet {
  const at = raw.findIndex((r) => r.filter((c) => cellText(c) !== "").length >= 2);
  if (at < 0) return { headers: [], body: [] };
  const width = Math.max(...raw.slice(at).map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => cellText(raw[at][i]) || `Column ${i + 1}`);
  const body = raw.slice(at + 1).filter((r) => r.some((c) => cellText(c) !== ""));
  return { headers, body };
}

// Suggestions only — the trainer always confirms or changes each one in a dropdown that lists the file's own headers.
const HINTS: Record<MappingField, RegExp> = {
  name: /\b(name|candidate|trainee|employee|student|participant)\b/i,
  score: /\b(marks?|score|obtained|points?)\b/i,
  total: /\b(total|out of|max|maximum|full)\b/i,
  percent: /(%|percent|percentage|\bpct\b)/i,
  correct: /\b(correct|right)\b/i,
  wrong: /\b(wrong|incorrect)\b/i,
  remarks: /\b(remark|remarks|comment|comments|feedback|note|notes)\b/i,
};

export function guessMapping(headers: string[]): ColumnMapping {
  const used = new Set<number>();
  const out = {} as ColumnMapping;
  // most specific first, so "Total Marks" is not taken as the score column
  const order: MappingField[] = ["name", "percent", "total", "correct", "wrong", "remarks", "score"];
  for (const f of order) {
    let idx = headers.findIndex((h, i) => !used.has(i) && HINTS[f].test(h));
    if (f === "score" && idx < 0) idx = -1;
    out[f] = idx >= 0 ? idx : null;
    if (idx >= 0) used.add(idx);
  }
  return out;
}

const toNumber = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = cellText(v).replace(/%/g, "").replace(/,/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Turns the sheet body into round rows using the chosen columns. `defaultTotal` fills "out of" when the file has none. */
export function mapRows(body: unknown[][], m: ColumnMapping, defaultTotal: number | null): FinalUploadRow[] {
  const rows = body
    .map((r): FinalUploadRow | null => {
      const name = m.name === null ? "" : cellText(r[m.name]).replace(/\s+/g, " ");
      if (!name) return null;
      const score = m.score === null ? null : toNumber(r[m.score]);
      const total = (m.total === null ? null : toNumber(r[m.total])) ?? defaultTotal;
      const percent = m.percent === null ? null : toNumber(r[m.percent]);
      return {
        name,
        score,
        total,
        percent,
        correct: m.correct === null ? null : toNumber(r[m.correct]),
        wrong: m.wrong === null ? null : toNumber(r[m.wrong]),
        remarks: m.remarks === null ? "" : cellText(r[m.remarks]),
      };
    })
    .filter((r): r is FinalUploadRow => r !== null);

  // A percent column written as 0.85 (Excel's % format) means 85 — only when every filled value is a fraction.
  const pcts = rows.map((r) => r.percent).filter((p): p is number => p !== null);
  const fractions = pcts.length > 0 && pcts.every((p) => p >= 0 && p <= 1) && pcts.some((p) => !Number.isInteger(p));
  return rows.map((r) => {
    let percent = r.percent === null ? null : fractions ? r.percent * 100 : r.percent;
    if (percent === null && r.score !== null && r.total !== null && r.total > 0) percent = (r.score / r.total) * 100;
    return { ...r, percent: percent === null ? null : Math.round(percent * 10) / 10 };
  });
}

// ── Merging rounds ───────────────────────────────────────────────────────────────────────────────────────────────

export interface ReportRoundRow {
  name: string;
  score: number | null;
  total: number | null;
  percent: number | null;
  correct: number | null;
  wrong: number | null;
  remarks: string;
}

export interface ReportRound {
  key: string;
  label: string;
  kind: "quiz" | "exam" | "excel";
  date: string | null;
  passPct: number | null;
  rows: ReportRoundRow[];
}

export interface ReportCandidate {
  key: string;
  name: string;
  perRound: (number | null)[];
  attempts: number;
  best: number | null;
  average: number | null;
  /** latest attempt minus first attempt — only when there are at least two attempts */
  change: number | null;
  /** pass mark of the round the best result came from — used when no single pass mark is chosen */
  bestPassPct: number | null;
  rank: number | null;
}

export function candidateKey(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Oldest round first; rounds without a date go last in the order they were added. */
export function sortRounds(rounds: ReportRound[]): ReportRound[] {
  return rounds
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const da = a.r.date ?? "9999";
      const db = b.r.date ?? "9999";
      return da === db ? a.i - b.i : da < db ? -1 : 1;
    })
    .map((x) => x.r);
}

export function buildCandidates(rounds: ReportRound[]): ReportCandidate[] {
  const map = new Map<string, { name: string; per: (number | null)[]; passAt: (number | null)[] }>();
  rounds.forEach((round, ri) => {
    for (const row of round.rows) {
      const key = candidateKey(row.name);
      if (!key) continue;
      let c = map.get(key);
      if (!c) {
        c = { name: row.name.trim(), per: rounds.map(() => null), passAt: rounds.map(() => null) };
        map.set(key, c);
      }
      // the same person listed twice in one round — keep the better line
      if (row.percent !== null && (c.per[ri] === null || row.percent > (c.per[ri] as number))) {
        c.per[ri] = row.percent;
        c.passAt[ri] = round.passPct;
      }
    }
  });

  const out: ReportCandidate[] = [...map.entries()].map(([key, c]) => {
    const got = c.per.map((p, i) => ({ p, i })).filter((x): x is { p: number; i: number } => x.p !== null);
    const best = got.length ? Math.max(...got.map((g) => g.p)) : null;
    const bestAt = best === null ? null : got.find((g) => g.p === best)!.i;
    return {
      key,
      name: c.name,
      perRound: c.per,
      attempts: got.length,
      best,
      average: got.length ? round1(got.reduce((s, g) => s + g.p, 0) / got.length) : null,
      change: got.length >= 2 ? round1(got[got.length - 1].p - got[0].p) : null,
      bestPassPct: bestAt === null ? null : c.passAt[bestAt],
      rank: null,
    };
  });

  const ranked = out.filter((c) => c.best !== null).sort((a, b) => (b.best as number) - (a.best as number) || (b.average as number) - (a.average as number));
  let prev: ReportCandidate | null = null;
  ranked.forEach((c, i) => {
    c.rank = prev && prev.best === c.best && prev.average === c.average ? (prev.rank as number) : i + 1;
    prev = c;
  });
  return [...ranked, ...out.filter((c) => c.best === null).sort((a, b) => a.name.localeCompare(b.name))];
}

/** "Pass" / "Not passed" for one candidate, or null when no pass mark is known. */
export function resultOf(c: ReportCandidate, passPctOverride: number | null): "Pass" | "Not passed" | null {
  if (c.best === null) return null;
  const pass = passPctOverride ?? c.bestPassPct;
  if (pass === null) return null;
  return c.best >= pass ? "Pass" : "Not passed";
}

// ── Writing the Excel file ───────────────────────────────────────────────────────────────────────────────────────

export interface ReportExportInput {
  title: string;
  rounds: ReportRound[];
  candidates: ReportCandidate[];
  feedback: Record<string, string>;
  passPct: number | null;
}

const NAVY = "#1E3A5F";

/** One .xlsx: sheet 1 is the final report (with feedback), sheet 2 lists every round line by line. */
export async function downloadFinalReportXlsx(input: ReportExportInput, fileName: string): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const head = (v: string) => ({ value: v, fontWeight: "bold" as const, backgroundColor: NAVY, color: "#FFFFFF", wrap: true, alignVertical: "center" as const });
  const num = (v: number | null) => (v === null ? { value: "" } : { value: v, type: Number, format: "0.0" });
  const text = (v: string) => ({ value: v, wrap: true, alignVertical: "top" as const });

  const reportHead = ["Rank", "Candidate", ...input.rounds.map((r) => `${r.label} (%)`), "Attempts", "Best %", "Average %", "Change (first → last)", "Result", "Feedback"];
  const reportData = [
    reportHead.map(head),
    ...input.candidates.map((c) => {
      const res = resultOf(c, input.passPct);
      return [
        c.rank === null ? { value: "" } : { value: c.rank, type: Number },
        { value: c.name, fontWeight: "bold" as const },
        ...c.perRound.map(num),
        { value: c.attempts, type: Number },
        num(c.best),
        num(c.average),
        c.change === null ? { value: "" } : { value: c.change, type: Number, format: "+0.0;-0.0;0.0" },
        { value: res ?? "", fontWeight: "bold" as const, color: res === "Pass" ? "#15803D" : res === "Not passed" ? "#B91C1C" : "#475569" },
        text(input.feedback[c.key] ?? ""),
      ];
    }),
  ];
  const reportCols = [{ width: 7 }, { width: 26 }, ...input.rounds.map(() => ({ width: 16 })), { width: 10 }, { width: 10 }, { width: 11 }, { width: 14 }, { width: 12 }, { width: 55 }];

  const detailHead = ["Candidate", "Round", "Date", "Marks", "Out of", "Percent", "Correct", "Wrong", "Remarks"];
  const detailData = [
    detailHead.map(head),
    ...input.rounds.flatMap((r) =>
      r.rows.map((row) => [
        { value: row.name },
        { value: r.label },
        { value: r.date ?? "" },
        num(row.score),
        num(row.total),
        num(row.percent),
        num(row.correct),
        num(row.wrong),
        text(row.remarks),
      ])
    ),
  ];
  const detailCols = [{ width: 26 }, { width: 24 }, { width: 12 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 40 }];

  const titleSheet = input.title.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "Final report";
  await writeXlsxFile(
    [
      { data: reportData, sheet: titleSheet, columns: reportCols, stickyRowsCount: 1, stickyColumnsCount: 2 },
      { data: detailData, sheet: "Round details", columns: detailCols, stickyRowsCount: 1 },
    ],
    {}
  ).toFile(fileName);
}

/** A tiny example file so the trainer sees which columns to bring. The example names are placeholders to overwrite. */
export async function downloadSampleXlsx(fileName: string): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const head = (v: string) => ({ value: v, fontWeight: "bold" as const, backgroundColor: NAVY, color: "#FFFFFF" });
  const data = [
    ["Name", "Marks", "Out of", "Percent", "Correct", "Wrong", "Remarks"].map(head),
    [{ value: "Example Person One" }, { value: 18, type: Number }, { value: 20, type: Number }, { value: 90, type: Number }, { value: 18, type: Number }, { value: 2, type: Number }, { value: "Replace these example rows with your own" }],
    [{ value: "Example Person Two" }, { value: 12, type: Number }, { value: 20, type: Number }, { value: 60, type: Number }, { value: 12, type: Number }, { value: 8, type: Number }, { value: "" }],
  ];
  await writeXlsxFile(data, { sheet: "Round", columns: [{ width: 26 }, { width: 9 }, { width: 9 }, { width: 10 }, { width: 9 }, { width: 9 }, { width: 40 }] }).toFile(fileName);
}

/** Reads the first sheet of an .xlsx the trainer picked. Loaded on demand so the app's main bundle stays small. */
export async function readXlsxFile(file: File): Promise<ParsedSheet> {
  const { readSheet } = await import("read-excel-file/browser");
  const raw = (await readSheet(file)) as unknown[][];
  return parseSheet(raw);
}
