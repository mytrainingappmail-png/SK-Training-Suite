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

/** Validates the whole question set before it ever reaches the database — every question needs 2+ options and exactly one marked correct. */
export function validateQuestions(questions: QuestionForm[]): SaveQuestionsResult {
  if (questions.length === 0) return { ok: false, error: "Add at least one question." };

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.question_text.trim()) return { ok: false, error: `Question ${i + 1} has no text.` };
    const options = q.type === "truefalse" ? q.options.slice(0, 2) : q.options;
    if (options.length < 2) return { ok: false, error: `Question ${i + 1} needs at least 2 options.` };
    if (options.some((o) => !o.option_text.trim())) return { ok: false, error: `Question ${i + 1} has an empty option.` };
    const correctCount = options.filter((o) => o.is_correct).length;
    if (correctCount !== 1) return { ok: false, error: `Question ${i + 1} must have exactly one correct answer.` };
  }

  return { ok: true };
}

export async function saveQuestions(quizId: string, questions: QuestionForm[]): Promise<SaveQuestionsResult> {
  const validation = validateQuestions(questions);
  if (!validation.ok) return validation;

  await quizRepo.replaceQuestions(quizId, questions);
  return { ok: true };
}

export async function publishQuiz(quizId: string): Promise<void> {
  const quiz = await quizRepo.getQuizWithQuestions(quizId);
  if (!quiz) throw new Error("Quiz not found.");
  const validation = validateQuestions(
    quiz.questions.map((q) => ({
      question_text: q.question_text,
      type: q.type,
      timer_seconds: q.timer_seconds,
      marks: q.marks,
      explanation: q.explanation,
      is_hidden: q.is_hidden,
      source_label: q.source_label,
      options: q.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
    }))
  );
  if (!validation.ok) throw new Error(validation.error);

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
    issue_certificate: source.issue_certificate,
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
        options: q.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
      }))
    );
  }

  return created;
}

/** Combines every question from the selected quizzes (in the order given) into one new draft quiz. */
export async function mergeQuizzes(
  quizIds: string[],
  companyId: string,
  createdBy: string | null,
  title: string
): Promise<Quiz> {
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
    issue_certificate: found.every((q) => q.issue_certificate),
  });

  const mergedQuestions = found.flatMap((q) =>
    q.questions.map((question) => ({
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
      options: question.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
    }))
  );

  if (mergedQuestions.length > 0) {
    await quizRepo.replaceQuestions(created.id, mergedQuestions);
  }

  return created;
}
