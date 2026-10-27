// Questions that are "the same question" in several tests, and moving questions between tests.
//
// Every question carries an origin_uid that survives re-saving a test and is shared by all its copies. So when a question is
// edited in one test, the copies in the other tests can be updated to match (the database does it, skipping any test that is
// running right now), and a trainer can see at a glance where a question is also used.

import { supabaseQuiz } from "../../lib/supabaseQuiz";
import * as quizRepo from "../../repositories/quiz/quizRepository";
import type { QuestionForm, QuizForm } from "../../repositories/quiz/quizRepository";
import type { Quiz } from "../../types/quiz";

export interface QuestionLink {
  origin_uid: string;
  question_id: string;
  quiz_id: string;
  title: string;
  code: string;
  mode: "live" | "exam";
  is_home: boolean;
  /** The test is running or scheduled right now - its copy is not changed. */
  in_use: boolean;
}

interface LinkRow {
  r_origin_uid: string;
  r_question_id: string;
  r_quiz_id: string;
  r_title: string;
  r_code: string;
  r_mode: "live" | "exam";
  r_is_home: boolean;
  r_in_use: boolean;
}

/** The other tests that hold a copy of these questions (this test itself is left out). */
export async function getQuestionLinks(originUids: string[], excludeQuizId: string | null): Promise<QuestionLink[]> {
  if (originUids.length === 0) return [];
  const { data, error } = await supabaseQuiz.rpc("get_question_links", { p_origin_uids: originUids, p_exclude_quiz: excludeQuizId });
  if (error) {
    console.error("[quizLinkService] getQuestionLinks:", error);
    throw new Error(error.message);
  }
  return ((data ?? []) as LinkRow[]).map((r) => ({
    origin_uid: r.r_origin_uid,
    question_id: r.r_question_id,
    quiz_id: r.r_quiz_id,
    title: r.r_title,
    code: r.r_code,
    mode: r.r_mode,
    is_home: r.r_is_home,
    in_use: r.r_in_use,
  }));
}

export interface SyncOutcome {
  /** Codes of the tests that now have the same version of the question. */
  updated: { code: string; title: string }[];
  /** Tests that were running or scheduled, so they were left as they were. */
  skipped: { code: string; title: string }[];
}

interface SyncRow {
  r_origin_uid: string;
  r_quiz_id: string;
  r_title: string;
  r_code: string;
  r_updated: boolean;
}

/** Makes every other copy of these questions the same as the version saved in this test. */
export async function syncQuestionCopies(quizId: string, originUids: string[]): Promise<SyncOutcome> {
  if (originUids.length === 0) return { updated: [], skipped: [] };
  const { data, error } = await supabaseQuiz.rpc("sync_question_copies", { p_quiz_id: quizId, p_origin_uids: originUids });
  if (error) {
    console.error("[quizLinkService] syncQuestionCopies:", error);
    throw new Error(error.message);
  }
  const outcome: SyncOutcome = { updated: [], skipped: [] };
  const seenUpdated = new Set<string>();
  const seenSkipped = new Set<string>();
  for (const r of (data ?? []) as SyncRow[]) {
    const entry = { code: r.r_code, title: r.r_title };
    if (r.r_updated) { if (!seenUpdated.has(r.r_quiz_id)) { seenUpdated.add(r.r_quiz_id); outcome.updated.push(entry); } }
    else if (!seenSkipped.has(r.r_quiz_id)) { seenSkipped.add(r.r_quiz_id); outcome.skipped.push(entry); }
  }
  return outcome;
}

type ContentLike = Pick<
  QuestionForm,
  "question_text" | "question_text_hi" | "explanation" | "explanation_hi" | "type" | "image_url" | "target_x" | "target_y" | "target_radius" | "hotspot_zones" | "options"
>;

/** Everything about a question that is shared between its copies (not marks, timer, hidden or position). Used to tell what was edited. */
export function questionContentKey(q: ContentLike): string {
  return JSON.stringify([
    q.question_text.trim(),
    q.question_text_hi?.trim() ?? "",
    q.explanation.trim(),
    q.explanation_hi?.trim() ?? "",
    q.type,
    q.image_url ?? null,
    q.target_x ?? null,
    q.target_y ?? null,
    q.target_radius ?? null,
    q.hotspot_zones && q.hotspot_zones.length > 0 ? q.hotspot_zones : null,
    q.options.map((o) => [o.option_text.trim(), o.option_text_hi?.trim() ?? "", o.is_correct]),
  ]);
}

/** A question as it is put into another test. `linked` keeps it the same question (edits can follow it everywhere). */
export function questionForOtherTest<T extends QuestionForm>(q: T, linked: boolean, sourceTitle: string): QuestionForm {
  const { localId: _localId, ...rest } = q as T & { localId?: string };
  return {
    ...rest,
    origin_uid: linked ? q.origin_uid ?? null : null,
    home_quiz_id: linked ? q.home_quiz_id ?? null : null,
    source_label: sourceTitle,
    source_question_id: null,
    options: q.options.map(quizRepo.optionWithHindi),
  };
}

/** The questions that cannot go into a live quiz (typed / photo answers are exam-only). */
export function fitsMode(q: Pick<QuestionForm, "type">, mode: Quiz["mode"]): boolean {
  return mode === "exam" || q.type !== "written";
}

export interface TransferResult {
  added: number;
  /** Questions left out because the destination is a live quiz and they need an exam. */
  skippedWritten: number;
}

/** Adds the questions to an existing test (after its own questions - those are not touched). */
export async function copyQuestionsToTest(target: Quiz, questions: QuestionForm[]): Promise<TransferResult> {
  const fitting = questions.filter((q) => fitsMode(q, target.mode));
  await quizRepo.appendQuestions(target.id, fitting);
  return { added: fitting.length, skippedWritten: questions.length - fitting.length };
}

/** Makes a new draft test holding the questions. Its settings start from the test they came from. */
export async function createTestFromQuestions(
  companyId: string,
  createdBy: string | null,
  base: QuizForm,
  title: string,
  code: string,
  questions: QuestionForm[]
): Promise<Quiz> {
  const cleanTitle = title.trim();
  if (!cleanTitle) throw new Error("Give the new test a name.");
  const created = await quizRepo.createQuiz(companyId, createdBy, { ...base, title: cleanTitle, code: code.trim() || undefined });
  await quizRepo.appendQuestions(created.id, questions.filter((q) => fitsMode(q, created.mode)));
  return created;
}

export interface DeleteOutcome {
  deleted: { code: string; title: string }[];
  /** Running or scheduled tests, left as they were. */
  skipped: { code: string; title: string }[];
}

interface DeleteRow {
  r_quiz_id: string;
  r_title: string;
  r_code: string;
  r_deleted: boolean;
}

/** Deletes these questions from every OTHER test that has a copy (not from the test named here). */
export async function deleteQuestionCopies(exceptQuizId: string, originUids: string[]): Promise<DeleteOutcome> {
  if (originUids.length === 0) return { deleted: [], skipped: [] };
  const { data, error } = await supabaseQuiz.rpc("delete_question_copies", { p_exclude_quiz: exceptQuizId, p_origin_uids: originUids });
  if (error) {
    console.error("[quizLinkService] deleteQuestionCopies:", error);
    throw new Error(error.message);
  }
  const out: DeleteOutcome = { deleted: [], skipped: [] };
  const seen = new Set<string>();
  for (const r of (data ?? []) as DeleteRow[]) {
    const key = `${r.r_deleted}:${r.r_quiz_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (r.r_deleted ? out.deleted : out.skipped).push({ code: r.r_code, title: r.r_title });
  }
  return out;
}
