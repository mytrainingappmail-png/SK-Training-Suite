// CSV import / export / sample for Survey questions (Live Quiz → Surveys). Same spirit as the quiz CSV: the
// header row is matched by name (column order doesn't matter), a bad row is skipped and reported rather than
// guessed at, and an export can be edited and imported back.

import { csvEscape } from "../quiz/quizCsvService";
import type { SurveyQuestionForm } from "../../repositories/survey/surveyRepository";
import type { SurveyQuestionType, SurveySentiment } from "../../types/survey";

export { parseCsv, downloadCsvFile } from "../quiz/quizCsvService";

const MAX_OPTIONS = 8;

export const SURVEY_CSV_HEADERS = [
  "Question", "Type", "Required",
  "Option1", "Option2", "Option3", "Option4", "Option5", "Option6", "Option7", "Option8",
  "Sentiments", "ScaleMin", "ScaleMax", "TimeLimit",
];

export const SURVEY_SAMPLE_ROWS: string[][] = [
  ["How satisfied are you with your overall experience here?", "scale", "yes", "", "", "", "", "", "", "", "", "", "1", "5", ""],
  ["Do you feel your manager supports your growth?", "single_choice", "yes", "Yes, always", "Sometimes", "Rarely", "Not at all", "", "", "", "", "positive;neutral;negative;negative", "", "", ""],
  ["Which of these would you like more of? (pick all that apply)", "multi_choice", "no", "Product training", "Sales role-plays", "Leadership workshops", "Mock site visits", "Other", "", "", "", "neutral;neutral;neutral;neutral;neutral", "", "", ""],
  ["What is one thing we should change?", "open_text", "no", "", "", "", "", "", "", "", "", "", "", "", ""],
];

const TYPE_ALIASES: Record<string, SurveyQuestionType> = {
  single_choice: "single_choice", single: "single_choice", "single choice": "single_choice", radio: "single_choice", mcq: "single_choice",
  multi_choice: "multi_choice", multi: "multi_choice", multiple: "multi_choice", "multiple choice": "multi_choice", "multi choice": "multi_choice", checkbox: "multi_choice",
  scale: "scale", rating: "scale", "rating scale": "scale", stars: "scale",
  open_text: "open_text", text: "open_text", "open text": "open_text", open: "open_text", free_text: "open_text", "free text": "open_text",
};

const SENTIMENT_ALIASES: Record<string, SurveySentiment> = {
  positive: "positive", pos: "positive", good: "positive", "+": "positive",
  neutral: "neutral", neu: "neutral", ok: "neutral",
  negative: "negative", neg: "negative", bad: "negative", "-": "negative",
};

function yesNo(value: string, fallback: boolean): boolean {
  const v = value.trim().toLowerCase();
  if (["yes", "y", "true", "1", "required"].includes(v)) return true;
  if (["no", "n", "false", "0", "optional"].includes(v)) return false;
  return fallback;
}

/** When no sentiments are given: first option positive, last negative, anything between neutral. */
function defaultSentiments(count: number): SurveySentiment[] {
  return Array.from({ length: count }, (_, i) => (i === 0 ? "positive" : i === count - 1 ? "negative" : "neutral"));
}

export function buildSurveySampleCsv(): string {
  return [SURVEY_CSV_HEADERS, ...SURVEY_SAMPLE_ROWS].map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

/** Export an existing survey's questions in the same format the importer reads. */
export function buildSurveyQuestionsCsv(questions: SurveyQuestionForm[]): string {
  const rows = questions.map((q) => {
    const opts = q.type === "single_choice" || q.type === "multi_choice" ? q.options.filter((o) => o.option_text.trim()) : [];
    const cells: string[] = [
      q.question_text,
      q.type,
      q.required ? "yes" : "no",
      ...Array.from({ length: MAX_OPTIONS }, (_, i) => opts[i]?.option_text ?? ""),
      opts.map((o) => o.sentiment).join(";"),
      q.type === "scale" ? String(q.scale_min ?? 1) : "",
      q.type === "scale" ? String(q.scale_max ?? 5) : "",
      q.time_limit_seconds ? String(q.time_limit_seconds) : "",
    ];
    return cells.map(csvEscape).join(",");
  });
  return [SURVEY_CSV_HEADERS.join(","), ...rows].join("\r\n");
}

export interface SurveyCsvImportResult {
  questions: SurveyQuestionForm[];
  errors: string[];
}

export function csvRowsToSurveyQuestions(rows: string[][]): SurveyCsvImportResult {
  if (rows.length < 2) return { questions: [], errors: ["The file has no data rows (only a header, or it is empty)."] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const idx = {
    question: col("question"), type: col("type"), required: col("required"), sentiments: col("sentiments"),
    min: col("scalemin"), max: col("scalemax"), time: col("timelimit"),
    options: Array.from({ length: MAX_OPTIONS }, (_, i) => col(`option${i + 1}`)),
  };
  if (idx.question === -1) return { questions: [], errors: ['The file must have a "Question" column. Download the sample to see the format.'] };

  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const questions: SurveyQuestionForm[] = [];
  const errors: string[] = [];

  rows.slice(1).forEach((r, i) => {
    const rowNum = i + 2;
    const text = cell(r, idx.question);
    if (!text) { errors.push(`Row ${rowNum}: no question text — skipped.`); return; }
    const label = `Row ${rowNum} ("${text.slice(0, 40)}${text.length > 40 ? "…" : ""}")`;

    const rawType = cell(r, idx.type).toLowerCase();
    const optionTexts = idx.options.map((oi) => cell(r, oi)).filter(Boolean);
    // No Type given: infer — options present means a choice question, otherwise free text.
    const type: SurveyQuestionType | undefined = rawType ? TYPE_ALIASES[rawType] : optionTexts.length >= 2 ? "single_choice" : "open_text";
    if (!type) { errors.push(`${label}: Type "${cell(r, idx.type)}" is not recognised — use single_choice, multi_choice, scale or open_text. Skipped.`); return; }

    const timeRaw = cell(r, idx.time);
    let timeLimit: number | null = null;
    if (timeRaw) {
      const t = parseInt(timeRaw, 10);
      if (!Number.isFinite(t) || t < 5 || t > 3600) { errors.push(`${label}: TimeLimit must be 5–3600 seconds (or empty) — skipped.`); return; }
      timeLimit = t;
    }

    const base = { question_text: text, required: yesNo(cell(r, idx.required), true), time_limit_seconds: timeLimit };

    if (type === "single_choice" || type === "multi_choice") {
      if (optionTexts.length < 2) { errors.push(`${label}: a choice question needs at least 2 options — skipped.`); return; }
      const given = cell(r, idx.sentiments).split(/[;|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      const fallback = defaultSentiments(optionTexts.length);
      const bad = given.find((g) => !SENTIMENT_ALIASES[g]);
      if (bad) { errors.push(`${label}: Sentiments "${bad}" is not positive, neutral or negative — skipped.`); return; }
      questions.push({
        ...base, type, scale_min: null, scale_max: null,
        options: optionTexts.map((option_text, oi) => ({ option_text, sentiment: given[oi] ? SENTIMENT_ALIASES[given[oi]] : fallback[oi] })),
      });
      return;
    }

    if (type === "scale") {
      const min = cell(r, idx.min) ? parseInt(cell(r, idx.min), 10) : 1;
      const max = cell(r, idx.max) ? parseInt(cell(r, idx.max), 10) : 5;
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) { errors.push(`${label}: ScaleMax must be greater than ScaleMin — skipped.`); return; }
      questions.push({ ...base, type, scale_min: min, scale_max: max, options: [] });
      return;
    }

    questions.push({ ...base, type: "open_text", scale_min: null, scale_max: null, options: [] });
  });

  return { questions, errors };
}
