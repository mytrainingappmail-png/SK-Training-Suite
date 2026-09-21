import * as quizRepo from "../../repositories/quiz/quizRepository";
import type { Quiz, QuizWithQuestions } from "../../types/quiz";
import type { QuizForm, QuestionForm } from "../../repositories/quiz/quizRepository";

export async function listQuizzes(companyId: string): Promise<Quiz[]> {
  return quizRepo.listQuizzes(companyId);
}

export async function getQuiz(quizId: string): Promise<QuizWithQuestions | null> {
  return quizRepo.getQuizWithQuestions(quizId);
}

export async function createQuiz(companyId: string, createdBy: string, form: QuizForm): Promise<Quiz> {
  if (!form.title.trim()) throw new Error("Quiz title is required.");
  return quizRepo.createQuiz(companyId, createdBy, form);
}

export async function updateQuizMeta(quizId: string, form: Partial<QuizForm>): Promise<Quiz> {
  return quizRepo.updateQuizMeta(quizId, form);
}

export async function deleteQuiz(quizId: string): Promise<void> {
  return quizRepo.deleteQuiz(quizId);
}

export async function deleteQuizzes(quizIds: string[]): Promise<void> {
  return quizRepo.deleteQuizzes(quizIds);
}

export interface SaveQuestionsResult {
  ok: boolean;
  error?: string;
}

/** True once a hotspot question has at least one correct area — either the newer multi-shape zones, or the older single circle. */
export function hotspotHasTarget(q: Pick<QuestionForm, "hotspot_zones" | "target_x" | "target_y">): boolean {
  if (q.hotspot_zones && q.hotspot_zones.length > 0) return true;
  return q.target_x !== null && q.target_y !== null;
}

/** Every reason this question set can't be PUBLISHED yet, one entry per problem (not just the first), so the whole to-do list is visible at once. */
export function findPublishProblems(questions: QuestionForm[]): string[] {
  if (questions.length === 0) return ["Add at least one question."];

  const problems: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const n = i + 1;
    if (!q.question_text.trim()) {
      problems.push(`Q${n} has no text.`);
      continue;
    }

    if (q.type === "written") continue; // typed/photo answer, marked by hand — nothing to validate

    if (q.type === "hotspot") {
      if (!q.image_url) problems.push(`Q${n} needs an image uploaded.`);
      else if (!hotspotHasTarget(q)) problems.push(`Q${n} needs the correct area marked on the image.`);
      continue;
    }

    const options = q.type === "truefalse" ? q.options.slice(0, 2) : q.options;
    if (options.length < 2) problems.push(`Q${n} needs at least 2 options.`);
    else if (options.some((o) => !o.option_text.trim())) problems.push(`Q${n} has an empty option.`);
    else if (options.filter((o) => o.is_correct).length !== 1) problems.push(`Q${n} must have exactly one correct answer.`);
  }
  return problems;
}

function summarizeProblems(problems: string[]): string {
  const shown = problems.slice(0, 6).join(" ");
  const more = problems.length > 6 ? ` (+${problems.length - 6} more)` : "";
  return `${problems.length} thing(s) to fix before publishing: ${shown}${more}`;
}

/**
 * Saving a DRAFT only insists there is something worth saving — a draft is
 * exactly where half-finished work lives (a map question whose spot isn't
 * marked yet, an option not typed yet). The strict rules run on Publish only.
 */
export function validateDraftQuestions(questions: QuestionForm[]): SaveQuestionsResult {
  if (questions.length === 0) return { ok: false, error: "Add at least one question." };
  const blank = questions.findIndex((q) => !q.question_text.trim());
  if (blank !== -1) return { ok: false, error: `Question ${blank + 1} has no text.` };
  return { ok: true };
}

export async function saveQuestions(quizId: string, questions: QuestionForm[]): Promise<SaveQuestionsResult> {
  const validation = validateDraftQuestions(questions);
  if (!validation.ok) return validation;

  await quizRepo.replaceQuestions(quizId, questions);
  return { ok: true };
}

export async function publishQuiz(quizId: string): Promise<void> {
  const quiz = await quizRepo.getQuizWithQuestions(quizId);
  if (!quiz) throw new Error("Quiz not found.");
  const problems = findPublishProblems(
    quiz.questions.map((q) => ({
      question_text: q.question_text,
      type: q.type,
      timer_seconds: q.timer_seconds,
      marks: q.marks,
      explanation: q.explanation,
      is_hidden: q.is_hidden,
      source_label: q.source_label,
      source_question_id: q.source_question_id,
      options: q.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
      image_url: q.image_url,
      target_x: q.target_x,
      target_y: q.target_y,
      target_radius: q.target_radius,
      hotspot_zones: q.hotspot_zones,
    }))
  );
  if (problems.length > 0) throw new Error(summarizeProblems(problems));

  await quizRepo.setQuizStatus(quizId, "published");
}

export async function unpublishQuiz(quizId: string): Promise<void> {
  await quizRepo.setQuizStatus(quizId, "draft");
}

/** Clones a quiz and all its questions/options as a new, unpublished draft. */
export async function duplicateQuiz(quizId: string, companyId: string, createdBy: string | null): Promise<Quiz> {
  const source = await quizRepo.getQuizWithQuestions(quizId);
  if (!source) throw new Error("Quiz not found.");

  const created = await quizRepo.createQuiz(companyId, createdBy, {
    title: `${source.title} (Copy)`,
    description: source.description,
    category_id: source.category_id,
    difficulty: source.difficulty,
    default_timer_seconds: source.default_timer_seconds,
    passing_score_pct: source.passing_score_pct,
    improve_threshold_pct: source.improve_threshold_pct,
    shuffle_options: source.shuffle_options,
    shuffle_questions: source.shuffle_questions,
    shuffle_questions_per_participant: source.shuffle_questions_per_participant,
    issue_certificate: source.issue_certificate,
    mode: source.mode,
    exam_duration_minutes: source.exam_duration_minutes,
  });

  if (source.questions.length > 0) {
    await quizRepo.replaceQuestions(
      created.id,
      source.questions.map((q) => ({
        question_text: q.question_text,
        type: q.type,
        timer_seconds: q.timer_seconds,
        marks: q.marks,
        explanation: q.explanation,
        is_hidden: q.is_hidden,
        source_label: q.source_label,
        source_question_id: q.source_question_id,
        options: q.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
        image_url: q.image_url,
        target_x: q.target_x,
        target_y: q.target_y,
        target_radius: q.target_radius,
        hotspot_zones: q.hotspot_zones,
      }))
    );
  }

  return created;
}

function toMergedQuestionForm(q: { title: string }, question: QuizWithQuestions["questions"][number]): QuestionForm {
  return {
    question_text: question.question_text,
    type: question.type,
    timer_seconds: question.timer_seconds,
    marks: question.marks,
    explanation: question.explanation,
    is_hidden: question.is_hidden,
    // Tags every question with the quiz it came FROM (not the merged
    // quiz being built) — this is what later lets "remove Project X's
    // questions" find them again inside the merged result.
    source_label: q.title,
    // The specific original row, for the "🔄 Sync from source" resync
    // feature — lets a later edit to the original be pulled into this copy.
    source_question_id: question.id,
    options: question.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
    image_url: question.image_url,
    target_x: question.target_x,
    target_y: question.target_y,
    target_radius: question.target_radius,
    hotspot_zones: question.hotspot_zones,
  };
}

/** Preserves an existing question exactly as-is when it's carried forward into a replaceQuestions() call (merging more projects into an already-merged quiz shouldn't touch what's already there). */
function toCarriedQuestionForm(question: QuizWithQuestions["questions"][number]): QuestionForm {
  return {
    question_text: question.question_text,
    type: question.type,
    timer_seconds: question.timer_seconds,
    marks: question.marks,
    explanation: question.explanation,
    is_hidden: question.is_hidden,
    source_label: question.source_label,
    source_question_id: question.source_question_id,
    options: question.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
    image_url: question.image_url,
    target_x: question.target_x,
    target_y: question.target_y,
    target_radius: question.target_radius,
    hotspot_zones: question.hotspot_zones,
  };
}

/**
 * Combines every question from the selected quizzes (in the order given).
 * Without targetQuizId: creates a brand-new draft quiz (needs 2+ sources).
 * With targetQuizId: appends into that EXISTING quiz instead — its own
 * questions are kept as-is, its title/settings are untouched, and only 1+
 * source is needed since the target itself is effectively "one side."
 * This is what lets an admin build up ONE cumulative merged test over
 * multiple merge operations instead of getting a brand-new quiz (and a
 * brand-new "remove a merged-in project" list) every single time.
 */
/** Same question = same type + same text (ignoring case/extra spaces). Used to keep a merge from copying a question that is already in the result. */
function questionKey(q: { type: string; question_text: string }): string {
  return `${q.type}|${q.question_text.trim().toLowerCase().replace(/s+/g, " ")}`;
}

export interface MergeResult {
  quiz: Quiz;
  /** How many incoming questions were left out because an identical question was already there. */
  skippedDuplicates: number;
}

export async function mergeQuizzes(
  quizIds: string[],
  companyId: string,
  createdBy: string | null,
  title: string,
  targetQuizId?: string
): Promise<MergeResult> {
  if (targetQuizId) {
    if (quizIds.length < 1) throw new Error("Select at least one quiz to add.");

    const [target, ...sources] = await Promise.all([
      quizRepo.getQuizWithQuestions(targetQuizId),
      ...quizIds.map((id) => quizRepo.getQuizWithQuestions(id)),
    ]);
    if (!target) throw new Error("Could not load the destination quiz.");
    const found = sources.filter((q): q is QuizWithQuestions => q !== null);
    if (found.length === 0) throw new Error("Could not load the selected quizzes.");

    const carried = target.questions.map(toCarriedQuestionForm);
    const seen = new Set(carried.map(questionKey));
    let skippedDuplicates = 0;
    const added = found.flatMap((q) =>
      q.questions
        .filter((question) => {
          const key = questionKey(question);
          if (seen.has(key)) { skippedDuplicates++; return false; }
          seen.add(key);
          return true;
        })
        .map((question) => toMergedQuestionForm(q, question))
    );
    await quizRepo.replaceQuestions(targetQuizId, [...carried, ...added]);

    // Bumps updated_at and hands back a fresh Quiz row — nothing about the
    // target's own title/settings is changed, only its question set.
    return { quiz: await quizRepo.updateQuizMeta(targetQuizId, {}), skippedDuplicates };
  }

  if (quizIds.length < 2) throw new Error("Select at least two quizzes to merge.");

  const sources = await Promise.all(quizIds.map((id) => quizRepo.getQuizWithQuestions(id)));
  const found = sources.filter((q): q is QuizWithQuestions => q !== null);
  if (found.length < 2) throw new Error("Could not load the selected quizzes.");

  const hardest = found.some((q) => q.difficulty === "Hard")
    ? "Hard"
    : found.some((q) => q.difficulty === "Medium")
    ? "Medium"
    : "Easy";

  const created = await quizRepo.createQuiz(companyId, createdBy, {
    title: title.trim() || found.map((q) => q.title).join(" + "),
    description: `Merged from: ${found.map((q) => q.title).join(", ")}`,
    category_id: found[0].category_id,
    difficulty: hardest,
    default_timer_seconds: found[0].default_timer_seconds,
    passing_score_pct: Math.round(found.reduce((sum, q) => sum + q.passing_score_pct, 0) / found.length),
    improve_threshold_pct: Math.round(found.reduce((sum, q) => sum + q.improve_threshold_pct, 0) / found.length),
    shuffle_options: found.some((q) => q.shuffle_options),
    shuffle_questions: found.some((q) => q.shuffle_questions),
    shuffle_questions_per_participant: found.some((q) => q.shuffle_questions_per_participant),
    issue_certificate: found.every((q) => q.issue_certificate),
    mode: "live",
    exam_duration_minutes: null,
  });

  const seen = new Set<string>();
  let skippedDuplicates = 0;
  const mergedQuestions = found.flatMap((q) =>
    q.questions
      .filter((question) => {
        const key = questionKey(question);
        if (seen.has(key)) { skippedDuplicates++; return false; }
        seen.add(key);
        return true;
      })
      .map((question) => toMergedQuestionForm(q, question))
  );

  if (mergedQuestions.length > 0) {
    await quizRepo.replaceQuestions(created.id, mergedQuestions);
  }

  return { quiz: created, skippedDuplicates };
}

/** Just the syncable content fields — deliberately excludes source_label/source_question_id/is_hidden, which are the merged copy's own identity within its quiz, not content to overwrite. */
export type ResyncedQuestionContent = Pick<QuestionForm, "question_text" | "type" | "timer_seconds" | "marks" | "explanation" | "options" | "image_url" | "target_x" | "target_y" | "target_radius" | "hotspot_zones">;

/**
 * Fetches the current content of a merged question's original source
 * question, for the builder's "🔄 Sync from source" button — the caller
 * merges this into local state (same edit-then-Save flow as everything
 * else in the builder), it does not write to the database itself.
 * Returns null if the source question no longer exists (deleted since the
 * merge, or its whole quiz was removed).
 */
export async function resyncQuestionFromSource(sourceQuestionId: string): Promise<ResyncedQuestionContent | null> {
  const source = await quizRepo.getQuestionById(sourceQuestionId);
  if (!source) return null;
  return {
    question_text: source.question_text,
    type: source.type,
    timer_seconds: source.timer_seconds,
    marks: source.marks,
    explanation: source.explanation,
    options: source.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
    image_url: source.image_url,
    target_x: source.target_x,
    target_y: source.target_y,
    target_radius: source.target_radius,
    hotspot_zones: source.hotspot_zones,
  };
}
