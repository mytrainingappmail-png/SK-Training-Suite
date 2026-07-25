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
      options: q.options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
    }))
  );
  if (!validation.ok) throw new Error(validation.error);

  await quizRepo.setQuizStatus(quizId, "published");
}

export async function unpublishQuiz(quizId: string): Promise<void> {
  await quizRepo.setQuizStatus(quizId, "draft");
}
