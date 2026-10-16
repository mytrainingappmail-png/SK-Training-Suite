// Final Result — reading ANY Excel / CSV file the trainer already has. No template, no fixed columns.
//
// A real results file is untidy: several sheets, several tables stacked on one sheet, a title above each table, attempts
// written as extra columns ("Second Attempt", "Third Attempt"), percent written as 0.96 in one column and 91 in another,
// notes under a row, and a "Trainee | Feedback" list at the bottom. This module finds all of that by itself:
//
//   1. every sheet is split into tables — a table starts at a header row (a row where at least two cells read like
//      "Name", "Marks", "Total", "Percent", "Attempt", "Remarks", "Feedback"…) and ends at the next header or a blank row;
//   2. the columns of each table are recognised from their headers (and, for the name, from the data itself);
//   3. a results table becomes ONE ROUND per test name found in it, plus one extra round per attempt column;
//   4. a table of names + comments becomes feedback for those candidates;
//   5. whatever is not recognised is reported back as "skipped" — nothing is guessed silently.
//
// Everything is read from the file. No test, trainee, company or column name is built in — only the common words people
// use for headers (see HINTS), which only ever SUGGEST; the trainer confirms every round before it is saved.

import type { FinalUploadRow } from "../../types/quiz";
import { candidateKey, type ColumnMapping } from "./quizFinalReportService";

export interface RawSheet {
  name: string;
  data: unknown[][];
}

export type ValueMode = "percent" | "marks" | "fraction";

export interface DetectedRound {
  id: string;
  label: string;
  /** yyyy-mm-dd or "" */
  date: string;
  /** where it was found, e.g. "Sheet2 · PROJECT TEST" */
  source: string;
  kind: "main" | "attempt";
  rows: FinalUploadRow[];
  /** attempt rounds only: the numbers as written in the file, so "how to read them" can be changed */
  attempt?: { values: { name: string; value: number; total: number | null }[]; mode: ValueMode };
}

export interface DetectedFeedback {
  name: string;
  text: string;
}

export interface DetectionResult {
  rounds: DetectedRound[];
  feedback: DetectedFeedback[];
  skipped: { where: string; reason: string }[];
}

// ── reading the file ─────────────────────────────────────────────────────────────────────────────────────────────

/** Reads every sheet of an .xlsx, or the single table of a .csv. Loaded on demand so the main bundle stays small. */
export async function readWorkbook(file: File): Promise<RawSheet[]> {
  if (/\.csv$/i.test(file.name)) {
    return [{ name: file.name.replace(/\.csv$/i, ""), data: parseCsv(await file.text()) }];
  }
  const { default: readExcelFile } = await import("read-excel-file/browser");
  const sheets = (await readExcelFile(file)) as { sheet: string; data: unknown[][] }[];
  return sheets.map((s) => ({ name: s.sheet, data: s.data }));
}

/** Small CSV reader: quotes, commas and line breaks inside quotes. */
export function parseCsv(input: string): unknown[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input; // drop a byte-order mark
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ── small helpers ────────────────────────────────────────────────────────────────────────────────────────────────

const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, " ").trim();
};

/** A number from a cell: 91, "91", "91%", "1,050.5" — anything else (NA, Pending, blank) is no number. */
export function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return null;
  const s = cellText(v).replace(/%/g, "").replace(/,/g, "");
  if (s === "" || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** yyyy-mm-dd from a date cell, "10-10-2026", "10/10/26" or "2026-10-10"; "" when it is not a date. */
export function toIsoDate(v: unknown): string {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  const s = cellText(v);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
}

/** "ALL FINAL PROJECTS TEST" -> "All Final Projects Test"; mixed-case names are left alone. */
export function tidyLabel(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length > 3 && t === t.toUpperCase() && /[A-Z]/.test(t)) {
    return t.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());
  }
  return t;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ── recognising headers ──────────────────────────────────────────────────────────────────────────────────────────

type Field = "name" | "testName" | "date" | "score" | "total" | "percent" | "attempt" | "feedback" | "remarks";

// Common words people put in a header. Checked in this order, so "Total Marks" is a total and "Test Name" is a test name.
const HINTS: [Field, RegExp][] = [
  ["attempt", /\b(attempts?|tries|try|chance|re-?test|re-?exam|re-?attempt)\b/i],
  ["percent", /%|\bpercent\w*|\bpct\b/i],
  ["total", /\b(total|out of|max|maximum|full marks?)\b/i],
  ["score", /\b(achiev\w*|obtain\w*|marks?|scores?|scored|points?|got|secured)\b/i],
  ["feedback", /\b(feedback|comments?|review|opinion|suggestions?)\b/i],
  ["testName", /\b(test|exam|quiz|assessment|paper|subject|module|topic|course)\b/i],
  ["date", /\b(date|day)\b/i],
  ["remarks", /\b(remarks?|result|status|outcome|grade|notes?)\b/i],
  ["name", /\b(name|trainee|candidate|employee|student|participant|agent|member)\b/i],
];

function classifyHeader(h: string): Field | null {
  const s = h.trim();
  if (!s || s.length > 40) return null;
  for (const [field, re] of HINTS) if (re.test(s)) return field;
  return null;
}

/** A row is a header when at least two of its cells read like headers and most of its cells are words, not numbers. */
function isHeaderRow(cells: unknown[]): boolean {
  const texts = cells.map(cellText).filter((t) => t !== "");
  if (texts.length < 2) return false;
  const words = texts.filter((t) => toNum(t) === null).length;
  if (words < texts.length * 0.7) return false;
  const found = new Set<Field>();
  for (const t of texts) { const f = classifyHeader(t); if (f) found.add(f); }
  return found.size >= 2;
}

function ordinalFor(header: string, index: number): string {
  const h = header.toLowerCase();
  if (/\b(first|1st|1)\b/.test(h)) return "1st attempt";
  if (/\b(second|2nd|2)\b/.test(h)) return "2nd attempt";
  if (/\b(third|3rd|3)\b/.test(h)) return "3rd attempt";
  if (/\b(fourth|4th|4)\b/.test(h)) return "4th attempt";
  return header.trim() || `Attempt ${index + 2}`;
}

// ── finding the tables of a sheet ────────────────────────────────────────────────────────────────────────────────

interface RawTable {
  sheet: string;
  title: string;
  header: string[];
  /** original values (numbers stay numbers) */
  body: unknown[][];
}

function findTables(sheet: RawSheet): RawTable[] {
  const rows = sheet.data;
  const blank = (r: unknown[]) => r.every((c) => cellText(c) === "");
  const headerIdx: number[] = [];
  rows.forEach((r, i) => { if (isHeaderRow(r)) headerIdx.push(i); });

  return headerIdx.map((h, k) => {
    const nextHeader = headerIdx[k + 1] ?? rows.length;
    let end = h + 1;
    while (end < nextHeader && !blank(rows[end])) end++;
    // a title is the lone cell on one of the two rows just above the header
    let title = "";
    for (const up of [1, 2]) {
      const r = rows[h - up];
      if (!r) break;
      const filled = r.map(cellText).filter((t) => t !== "");
      if (filled.length === 1) { title = filled[0]; break; }
      if (filled.length > 1) break;
    }
    const width = Math.max(rows[h].length, ...rows.slice(h + 1, end).map((r) => r.length));
    const header = Array.from({ length: width }, (_, j) => cellText(rows[h][j]));
    return { sheet: sheet.name, title, header, body: rows.slice(h + 1, end) };
  });
}

// ── turning a table into rounds / feedback ───────────────────────────────────────────────────────────────────────

interface Columns {
  name: number | null;
  testName: number | null;
  date: number | null;
  score: number | null;
  total: number | null;
  percent: number | null;
  attempts: { col: number; label: string }[];
  feedback: number | null;
  remarks: number[];
}

function mapColumns(t: RawTable): Columns {
  const c: Columns = { name: null, testName: null, date: null, score: null, total: null, percent: null, attempts: [], feedback: null, remarks: [] };
  t.header.forEach((h, j) => {
    const f = classifyHeader(h);
    if (f === "name" && c.name === null) c.name = j;
    else if (f === "testName" && c.testName === null) c.testName = j;
    else if (f === "date" && c.date === null) c.date = j;
    else if (f === "score" && c.score === null) c.score = j;
    else if (f === "total" && c.total === null) c.total = j;
    else if (f === "percent" && c.percent === null) c.percent = j;
    else if (f === "attempt") c.attempts.push({ col: j, label: ordinalFor(h, c.attempts.length) });
    else if (f === "feedback" && c.feedback === null) c.feedback = j;
    else if (f === "remarks") c.remarks.push(j);
  });
  // no column called "name"? take the column that holds the most different short words
  if (c.name === null) {
    const taken = new Set<number>([c.testName, c.date, c.score, c.total, c.percent, c.feedback, ...c.attempts.map((a) => a.col), ...c.remarks].filter((x): x is number => x !== null));
    let best = -1, bestCount = 0;
    t.header.forEach((_h, j) => {
      if (taken.has(j)) return;
      const words = new Set(t.body.map((r) => cellText(r[j])).filter((x) => x !== "" && toNum(x) === null && x.length <= 40));
      if (words.size > bestCount) { best = j; bestCount = words.size; }
    });
    if (best >= 0 && bestCount >= 2) c.name = best;
  }
  return c;
}

/** Best guess of which column is which, from the titles — used by "pick a table yourself". The trainer can change every one. */
export function suggestMapping(headers: string[]): ColumnMapping {
  const m: ColumnMapping = { name: null, score: null, total: null, percent: null, correct: null, wrong: null, remarks: null };
  headers.forEach((h, j) => {
    const f = classifyHeader(h);
    if (f === "name" && m.name === null) m.name = j;
    else if (f === "score" && m.score === null) m.score = j;
    else if (f === "total" && m.total === null) m.total = j;
    else if (f === "percent" && m.percent === null) m.percent = j;
    else if ((f === "remarks" || f === "feedback") && m.remarks === null) m.remarks = j;
  });
  return m;
}

const SUMMARY_ROW = /^(total|totals|average|avg|grand total|sum|overall|pass|fail|name|sr\.?|s\.? ?no\.?)$/i;

function detectMode(values: number[], totals: (number | null)[]): ValueMode {
  if (values.length === 0) return "percent";
  const max = Math.max(...values);
  if (max <= 1) return "fraction";
  const knownTotals = totals.filter((x): x is number => x !== null && x > 0);
  const usual = knownTotals.length > 0 && knownTotals.every((x) => x !== 100) && max <= Math.max(...knownTotals);
  if (usual) return "marks";
  return max <= 100 ? "percent" : "marks";
}

export function attemptPercent(value: number, total: number | null, mode: ValueMode): number | null {
  if (mode === "fraction") return round1(value * 100);
  if (mode === "percent") return round1(value);
  return total !== null && total > 0 ? round1((value / total) * 100) : null;
}

export function rebuildAttemptRows(attempt: NonNullable<DetectedRound["attempt"]>, mode: ValueMode, remarksByName: Map<string, string>): FinalUploadRow[] {
  return attempt.values.map((v) => ({
    name: v.name,
    score: mode === "marks" ? v.value : null,
    total: mode === "marks" ? v.total : null,
    percent: attemptPercent(v.value, v.total, mode),
    correct: null,
    wrong: null,
    remarks: remarksByName.get(candidateKey(v.name)) ?? "",
  }));
}

/** Finds every round and every feedback line in the sheets. */
export function detectAll(sheets: RawSheet[]): DetectionResult {
  const rounds: DetectedRound[] = [];
  const feedback = new Map<string, DetectedFeedback>();
  const skipped: { where: string; reason: string }[] = [];

  sheets.forEach((sheet, si) => {
    const tables = findTables(sheet);
    if (tables.length === 0) {
      skipped.push({ where: sheet.name, reason: "No results table found here (no row with names and marks / percent / attempts), so it was left out." });
      return;
    }
    tables.forEach((t, ti) => {
      const cols = mapColumns(t);
      const where = t.title ? `${sheet.name} · ${t.title}` : sheet.name;
      const hasNumbers = cols.score !== null || cols.percent !== null || cols.attempts.length > 0;

      // ── a list of names + comments ──
      if (cols.name !== null && !hasNumbers && (cols.feedback !== null || cols.remarks.length > 0)) {
        const textCol = cols.feedback ?? cols.remarks[0];
        let n = 0;
        for (const r of t.body) {
          const name = cellText(r[cols.name]);
          const text = cellText(r[textCol]);
          if (!name || !text || SUMMARY_ROW.test(name)) continue;
          const key = candidateKey(name);
          if (!feedback.has(key)) { feedback.set(key, { name, text }); n++; }
        }
        if (n === 0) skipped.push({ where, reason: "A names + comments list with nothing written in it." });
        return;
      }
      if (cols.name === null || !hasNumbers) {
        skipped.push({ where, reason: "Could not tell which column holds the names and which hold marks, so it was left out. You can pick the columns yourself below." });
        return;
      }

      // ── a results table ──
      const nameCol = cols.name;
      const known = new Set(t.body.map((r) => cellText(r[nameCol])).filter(Boolean).map(candidateKey));
      const notes = new Map<string, string>();
      const lines: { name: string; test: string; date: string; score: number | null; total: number | null; percent: number | null; remarks: string; raw: unknown[] }[] = [];

      const pctValues = cols.percent === null ? [] : t.body.map((r) => toNum(r[cols.percent as number])).filter((x): x is number => x !== null);
      const percentIsFraction = pctValues.length > 0 && Math.max(...pctValues) <= 1;

      for (const r of t.body) {
        const name = cellText(r[nameCol]);
        if (!name) {
          // a note under a row: "<name> | <comment>"
          const filled = r.map(cellText).filter((x) => x !== "");
          if (filled.length >= 2 && known.has(candidateKey(filled[0]))) notes.set(candidateKey(filled[0]), filled[1]);
          continue;
        }
        if (SUMMARY_ROW.test(name)) continue;
        const score = cols.score === null ? null : toNum(r[cols.score]);
        const total = cols.total === null ? null : toNum(r[cols.total]);
        let percent = cols.percent === null ? null : toNum(r[cols.percent]);
        if (percent !== null && percentIsFraction) percent *= 100;
        if (percent === null && score !== null && total !== null && total > 0) percent = (score / total) * 100;
        const remarks = [...new Set(cols.remarks.map((j) => cellText(r[j])).filter((x) => x !== ""))].join(" · ");
        const hasAny = score !== null || percent !== null || cols.attempts.some((a) => toNum(r[a.col]) !== null) || remarks !== "" || (cols.testName !== null && cellText(r[cols.testName]) !== "");
        if (!hasAny) continue;
        lines.push({
          name, test: cols.testName === null ? "" : cellText(r[cols.testName]),
          date: cols.date === null ? "" : toIsoDate(r[cols.date]),
          score, total, percent: percent === null ? null : round1(percent), remarks, raw: r,
        });
        if (cols.feedback !== null) {
          const text = cellText(r[cols.feedback]);
          const key = candidateKey(name);
          if (text && !feedback.has(key)) feedback.set(key, { name, text });
        }
      }
      if (lines.length === 0) {
        skipped.push({ where, reason: "A table with no candidate lines under its header." });
        return;
      }

      // one group (= one round) per test name; a table without a test-name column is one group named after its title
      const fallbackLabel = tidyLabel(t.title || sheet.name);
      const groups = new Map<string, typeof lines>();
      for (const l of lines) {
        const g = l.test || fallbackLabel;
        groups.set(g, [...(groups.get(g) ?? []), l]);
      }

      [...groups.entries()].forEach(([groupName, groupLines], gi) => {
        const label = tidyLabel(groupName);
        const date = groupLines.find((l) => l.date)?.date ?? "";
        const idBase = `${si}-${ti}-${gi}`;
        const remarksByName = new Map<string, string>();
        const mainRows: FinalUploadRow[] = groupLines.map((l) => {
          const note = notes.get(candidateKey(l.name));
          const remarks = [l.remarks, note].filter(Boolean).join(" · ");
          remarksByName.set(candidateKey(l.name), remarks);
          return { name: l.name, score: l.score, total: l.total, percent: l.percent, correct: null, wrong: null, remarks };
        });
        rounds.push({ id: `${idBase}-main`, label, date, source: where, kind: "main", rows: mainRows });

        cols.attempts.forEach((a, ai) => {
          const values = groupLines
            .map((l) => ({ name: l.name, value: toNum(l.raw[a.col]), total: l.total }))
            .filter((v): v is { name: string; value: number; total: number | null } => v.value !== null);
          if (values.length === 0) return;
          const mode = detectMode(values.map((v) => v.value), values.map((v) => v.total));
          const attempt = { values, mode };
          rounds.push({
            id: `${idBase}-a${ai}`, label: `${label} — ${a.label}`, date, source: where, kind: "attempt",
            rows: rebuildAttemptRows(attempt, mode, new Map()), attempt,
          });
        });
      });
    });
  });

  return { rounds, feedback: [...feedback.values()], skipped };
}
