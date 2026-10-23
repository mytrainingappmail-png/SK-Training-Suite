// Download a whole test (quiz or exam) as a spreadsheet: every question, its options, the correct answer, marks,
// timer and explanation. The columns match the "Import from CSV" file, so a downloaded test can be uploaded again
// (for example into another quiz). The PDF version lives in components/quiz/quizPdfExport.tsx.

import { csvEscape, downloadCsvFile } from "./quizCsvService";
import { getQuiz } from "./quizService";
import { effectiveZones } from "../../components/quiz/hotspotZones";
import type { HotspotZone, QuizQuestionType, QuizWithQuestions } from "../../types/quiz";

export interface ExportQuestion {
  question_text: string;
  type: QuizQuestionType;
  /** The question's own timer (null = follows the quiz timer). */
  timer_seconds: number | null;
  marks: number;
  explanation: string;
  is_hidden: boolean;
  options: { option_text: string; is_correct: boolean }[];
  image_url: string | null;
  hotspot_zones: HotspotZone[] | null;
  target_x: number | null;
  target_y: number | null;
  target_radius: number | null;
}

export interface ExportQuiz {
  title: string;
  description: string;
  mode: "live" | "exam";
  difficulty: string;
  default_timer_seconds: number;
  passing_score_pct: number;
  exam_duration_minutes: number | null;
  questions: ExportQuestion[];
}

/** Hidden questions are not part of the test trainees see, so they are not part of the download either. */
export function visibleQuestions(quiz: ExportQuiz): ExportQuestion[] {
  return quiz.questions.filter((q) => !q.is_hidden);
}

export function safeFileName(title: string): string {
  const clean = title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return clean || "test";
}

export function fromQuizWithQuestions(quiz: QuizWithQuestions): ExportQuiz {
  return {
    title: quiz.title,
    description: quiz.description,
    mode: quiz.mode,
    difficulty: quiz.difficulty,
    default_timer_seconds: quiz.default_timer_seconds,
    passing_score_pct: quiz.passing_score_pct,
    exam_duration_minutes: quiz.exam_duration_minutes,
    questions: quiz.questions.map((q) => ({
      question_text: q.question_text,
      type: q.type,
      timer_seconds: q.timer_seconds,
      marks: q.marks,
      explanation: q.explanation,
      is_hidden: q.is_hidden,
      options: q.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
      image_url: q.image_url,
      hotspot_zones: q.hotspot_zones,
      target_x: q.target_x,
      target_y: q.target_y,
      target_radius: q.target_radius,
    })),
  };
}

/** Loads a saved quiz / exam straight from the database (used by the Download buttons on the lists). */
export async function loadExportQuiz(quizId: string): Promise<ExportQuiz | null> {
  const quiz = await getQuiz(quizId);
  return quiz ? fromQuizWithQuestions(quiz) : null;
}

/** What the correct answer is, in words — for the CSV and the PDF answer key. */
export function correctAnswerText(q: ExportQuestion): string {
  if (q.type === "hotspot") return effectiveZones(q).length > 0 ? "Tap inside the marked area of the image" : "";
  if (q.type === "written") return "";
  return q.options.filter((o) => o.is_correct).map((o) => o.option_text).join(" | ");
}

const MAX_CSV_OPTIONS = 6;

export function buildQuizCsv(quiz: ExportQuiz): string {
  const qs = visibleQuestions(quiz);
  const optionCount = Math.min(MAX_CSV_OPTIONS, Math.max(4, ...qs.map((q) => q.options.length)));
  const header = [
    "Question", "Type",
    ...Array.from({ length: optionCount }, (_, i) => `Option${i + 1}`),
    "CorrectAnswer", "Timer", "Marks", "Explanation", "ImageURL",
  ];
  const rows = qs.map((q) => [
    q.question_text,
    q.type,
    ...Array.from({ length: optionCount }, (_, i) => (q.type === "hotspot" || q.type === "written" ? "" : q.options[i]?.option_text ?? "")),
    correctAnswerText(q),
    // live quiz: the seconds this question really gets; an exam has one paper time instead
    quiz.mode === "live" ? String(q.timer_seconds ?? quiz.default_timer_seconds) : "",
    String(q.marks),
    q.explanation ?? "",
    q.image_url ?? "",
  ]);
  return [header, ...rows].map((line) => line.map((v) => csvEscape(String(v))).join(",")).join("\r\n");
}

export function downloadQuizCsv(quiz: ExportQuiz): void {
  downloadCsvFile(`${safeFileName(quiz.title)}-questions.csv`, buildQuizCsv(quiz));
}
