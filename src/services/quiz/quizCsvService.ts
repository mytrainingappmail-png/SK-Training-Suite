// CSV import/export for bulk quiz question authoring. Deliberately does
// NOT replicate the reference app's silent "no exact match → assume
// option 1 is correct" bug — a row whose CorrectAnswer doesn't exactly
// match one of its own options is rejected and reported, never guessed.

import type { QuestionForm } from "../../repositories/quiz/quizRepository";

export const CSV_HEADERS = ["Question", "Type", "Option1", "Option2", "Option3", "Option4", "CorrectAnswer", "Timer", "Marks", "Explanation"];

export const SAMPLE_ROWS: string[][] = [
  ["What does RERA stand for?", "mcq", "Real Estate Regulatory Authority", "Real Estate Registration Act", "Residential Estate Reform Agency", "Real Estate Reform Act", "Real Estate Regulatory Authority", "20", "1", "RERA was established in 2016."],
  ["Registration under RERA is mandatory for all agents.", "truefalse", "True", "False", "", "", "True", "15", "1", "All agents must register before any transaction."],
];

function csvEscape(value: string): string {
  const v = String(value ?? "");
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function buildSampleCsv(): string {
  const lines = [CSV_HEADERS, ...SAMPLE_ROWS].map((row) => row.map(csvEscape).join(","));
  return lines.join("\r\n");
}

/** Minimal RFC-4180-ish CSV parser — handles quoted fields, escaped quotes, commas/newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
  }

  return rows;
}

export interface CsvImportResult {
  questions: QuestionForm[];
  errors: string[];
}

/** Header row is matched case-insensitively by name, not by position, so column order in the uploaded file doesn't matter. */
export function csvRowsToQuestions(rows: string[][]): CsvImportResult {
  const errors: string[] = [];
  if (rows.length < 2) {
    return { questions: [], errors: ["The file has no data rows (only a header, or is empty)."] };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());

  const idx = {
    question: col("question"),
    type: col("type"),
    opt1: col("option1"),
    opt2: col("option2"),
    opt3: col("option3"),
    opt4: col("option4"),
    correct: col("correctanswer"),
    timer: col("timer"),
    marks: col("marks"),
    explanation: col("explanation"),
  };

  if (idx.question === -1 || idx.correct === -1) {
    return { questions: [], errors: ['The file must have at least a "Question" and a "CorrectAnswer" column.'] };
  }

  const questions: QuestionForm[] = [];

  rows.slice(1).forEach((r, i) => {
    const rowNum = i + 2; // 1-indexed + header row
    const questionText = (r[idx.question] ?? "").trim();
    if (!questionText) {
      errors.push(`Row ${rowNum}: no question text — skipped.`);
      return;
    }

    const rawType = (idx.type >= 0 ? r[idx.type] : "").trim().toLowerCase();
    const type: QuestionForm["type"] = rawType === "truefalse" || rawType === "true/false" ? "truefalse" : "mcq";

    const optionTexts =
      type === "truefalse"
        ? ["True", "False"]
        : [idx.opt1, idx.opt2, idx.opt3, idx.opt4]
            .map((oi) => (oi >= 0 ? (r[oi] ?? "").trim() : ""))
            .filter((t) => t !== "");

    if (optionTexts.length < 2) {
      errors.push(`Row ${rowNum} ("${questionText.slice(0, 40)}…"): needs at least 2 options — skipped.`);
      return;
    }

    const correctAnswer = (r[idx.correct] ?? "").trim();
    const correctIndex = optionTexts.findIndex((t) => t.toLowerCase() === correctAnswer.toLowerCase());
    if (correctIndex === -1) {
      errors.push(`Row ${rowNum} ("${questionText.slice(0, 40)}…"): CorrectAnswer "${correctAnswer}" doesn't exactly match any option — skipped.`);
      return;
    }

    const timer = idx.timer >= 0 ? parseInt(r[idx.timer], 10) : NaN;
    const marks = idx.marks >= 0 ? parseInt(r[idx.marks], 10) : NaN;

    questions.push({
      question_text: questionText,
      type,
      timer_seconds: Number.isFinite(timer) && timer > 0 ? timer : null,
      marks: Number.isFinite(marks) && marks > 0 ? marks : 1,
      explanation: idx.explanation >= 0 ? (r[idx.explanation] ?? "").trim() : "",
      options: optionTexts.map((option_text, oi) => ({ option_text, is_correct: oi === correctIndex })),
    });
  });

  return { questions, errors };
}

export function downloadCsvFile(filename: string, csvText: string): void {
  const blob = new Blob(["﻿" + csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
