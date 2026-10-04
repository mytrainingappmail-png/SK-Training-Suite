import type { Question } from "../../types/question";
import type { QuestionWithOptionsForm } from "../../types/question";
import type { QuestionOptionForm } from "../../types/question";
import type { QuestionOption } from "../../types/question";

import {
  setMarksForQuestions as repositorySetMarks,
  getQuestions,
  getQuestionCodes,
  getQuestionsByAssessment,
  getOptionsForQuestions,
  createQuestionsBulk as repositoryCreateQuestionsBulk,
  createOptionsBulk,
  createQuestion as repositoryCreateQuestion,
  updateQuestion,
  deleteQuestion,
  toggleQuestionStatus as repositoryToggleQuestionStatus,
  deleteOptionsByQuestion,
  getOptionsByQuestion,
} from "../../repositories/question/questionRepository";

// ─── Public API ────────────────────────────────────────────────────────────────

export async function loadQuestions(): Promise<Question[]> {
  return await getQuestions();
}

export async function loadOptionsByQuestion(
  questionId: string
): Promise<QuestionOption[]> {
  return await getOptionsByQuestion(questionId);
}

export async function createQuestion(
  data: QuestionWithOptionsForm
): Promise<Question> {
  validateQuestionForm(data);

  // Reject duplicate code
  const existing = await getQuestionCodes();
  const code = data.question_code.trim().toLowerCase();
  if (existing.some((q) => (q.question_code ?? '').trim().toLowerCase() === code)) {
    throw new Error(
      `Question Code "${data.question_code.trim()}" already exists.`
    );
  }

  const { options, ...questionForm } = data;
  const question = await repositoryCreateQuestion(questionForm);

  await saveOptions(question.id, options);

  return question;
}

/** One test's questions with all their options, in two calls (not one call per question). */
export async function loadQuestionsWithOptions(assessmentId: string): Promise<{ questions: Question[]; optionsByQuestion: Record<string, QuestionOption[]> }> {
  const questions = await getQuestionsByAssessment(assessmentId);
  const optionsByQuestion = await getOptionsForQuestions(questions.map((q) => q.id));
  return { questions, optionsByQuestion };
}

/** Many new questions at once (CSV upload, several added in the editor): checked together, saved in two batched calls. */
export async function createQuestionsBulk(forms: QuestionWithOptionsForm[]): Promise<Question[]> {
  if (forms.length === 0) return [];
  forms.forEach(validateQuestionForm);

  const existing = await getQuestionCodes();
  const taken = new Set(existing.map((q) => (q.question_code ?? '').trim().toLowerCase()));
  for (const f of forms) {
    const code = f.question_code.trim().toLowerCase();
    if (taken.has(code)) throw new Error(`Question Code "${f.question_code.trim()}" already exists.`);
    taken.add(code);
  }

  const created = await repositoryCreateQuestionsBulk(forms.map(({ options: _options, ...q }) => q));
  const idByCode = new Map(created.map((q) => [(q.question_code ?? '').trim().toLowerCase(), q.id]));
  await createOptionsBulk(forms.flatMap((f) => {
    const id = idByCode.get(f.question_code.trim().toLowerCase());
    return id ? f.options.map((o, i) => ({ ...o, display_order: i + 1, question_id: id })) : [];
  }));
  return created;
}

export async function saveQuestion(
  id: string,
  data: QuestionWithOptionsForm
): Promise<Question> {
  if (!id) throw new Error("Invalid Question ID.");
  validateQuestionForm(data);

  // Reject duplicate code (exclude self)
  const existing = await getQuestionCodes();
  const code = data.question_code.trim().toLowerCase();
  if (
    existing.some(
      (q) => (q.question_code ?? '').trim().toLowerCase() === code && q.id !== id
    )
  ) {
    throw new Error(
      `Question Code "${data.question_code.trim()}" already exists.`
    );
  }

  const { options, ...questionForm } = data;
  const question = await updateQuestion(id, questionForm);

  // Replace all options atomically: delete then re-insert
  await deleteOptionsByQuestion(id);
  await saveOptions(id, options);

  return question;
}

/** Same marks for many questions at once — one call, nothing else is rewritten. */
export async function setMarksForQuestions(ids: string[], marks: number): Promise<void> {
  if (!Number.isFinite(marks) || marks < 1) throw new Error("Marks must be at least 1.");
  if (ids.length > 0) await repositorySetMarks(ids, marks);
}

/** Only the wording / marks changed (options untouched): update just those two fields. */
export async function editQuestionText(id: string, text: string, marks: number): Promise<void> {
  if (!id) throw new Error("Invalid Question ID.");
  if (!text.trim()) throw new Error("Question Text is required.");
  if (marks < 1) throw new Error("Marks must be at least 1.");
  await updateQuestion(id, { question_text: text.trim(), marks });
}

export async function removeQuestion(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Question ID.");
  await deleteQuestion(id);
}

export async function toggleQuestionStatus(
  id: string,
  active: boolean
): Promise<Question> {
  if (!id) throw new Error("Invalid Question ID.");
  return await repositoryToggleQuestionStatus(id, active);
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function saveOptions(
  questionId: string,
  options: QuestionOptionForm[]
): Promise<void> {
  await createOptionsBulk(options.map((o, i) => ({ ...o, display_order: i + 1, question_id: questionId })));
}

function validateQuestionForm(data: QuestionWithOptionsForm): void {
  if (!data.assessment_id)         throw new Error("Assessment is required.");
  if (!data.question_code.trim())  throw new Error("Question Code is required.");
  if (!data.question_text.trim())  throw new Error("Question Text is required.");

  if (data.display_order < 1) {
    throw new Error("Display Order must be at least 1.");
  }

  if (data.marks < 1) {
    throw new Error("Marks must be at least 1.");
  }

  if (data.negative_marks > data.marks) {
    throw new Error("Negative Marks cannot exceed Marks.");
  }

  if (data.time_limit_seconds > 0) {
    if (data.time_limit_seconds < 5) {
      throw new Error("Question Timer must be at least 5 seconds.");
    }
    if (data.time_limit_seconds > 600) {
      throw new Error("Question Timer cannot exceed 600 seconds.");
    }
  }

  // Options validation — only for question types that use options
  const needsOptions = ["mcq", "multiple_select", "true_false"].includes(
    data.question_type
  );

  if (needsOptions) {
    const opts = data.options;

    if (opts.length < 2) {
      throw new Error("At least 2 options are required.");
    }
    if (opts.length > 6) {
      throw new Error("Maximum 6 options are allowed.");
    }

    const anyEmpty = opts.some((o) => !o.option_text.trim());
    if (anyEmpty) {
      throw new Error("All options must have text.");
    }

    const correctCount = opts.filter((o) => o.is_correct).length;

    if (data.question_type === "mcq" || data.question_type === "true_false") {
      if (correctCount !== 1) {
        throw new Error("Exactly one correct option is required for this question type.");
      }
    }

    if (data.question_type === "multiple_select") {
      if (correctCount < 1) {
        throw new Error("At least one correct option is required for Multiple Select.");
      }
    }
  }
}
