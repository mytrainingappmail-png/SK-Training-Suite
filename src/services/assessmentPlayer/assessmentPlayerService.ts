import type {
  AssessmentPlayerPayload,
  AssessmentAttempt,
  AssessmentAnswer,
  PlayerQuestion,
  SaveAnswerPayload,
  SubmitRequest,
  SubmitAssessmentPayload,
} from "../../types/assessmentPlayer";

import {
  loadAssessment,
  loadQuestions,
  loadExistingAttempt,
  loadExistingAnswers,
  startAttempt,
  countCompletedAttempts,
  saveAnswer as repositorySaveAnswer,
  submitAssessment as repositorySubmitAssessment,
} from "../../repositories/assessmentPlayer/assessmentPlayerRepository";

import { finalizeAssessmentResult } from "./autoGradingService";

// ─── startAssessment ──────────────────────────────────────────────────────────
// Resumes an existing in-progress attempt or creates a new one after validating
// maximum_attempts. Returns everything the player component needs to render.

export async function startAssessment(
  assessmentId: string,
  employeeId: string
): Promise<AssessmentPlayerPayload> {
  if (!assessmentId) throw new Error("Assessment ID is required.");
  if (!employeeId)   throw new Error("Employee ID is required.");

  const assessment = await loadAssessment(assessmentId);

  if (!assessment.active) {
    throw new Error("This assessment is not currently active.");
  }

  // Resume any existing in-progress attempt before creating a new one
  let attempt: AssessmentAttempt | null = await loadExistingAttempt(
    assessmentId,
    employeeId
  );

  const questionData = await loadQuestions(assessmentId);

  if (questionData.length === 0) {
    throw new Error("This assessment has no active questions.");
  }

  if (!attempt) {
    const completedCount = await countCompletedAttempts(assessmentId, employeeId);

    if (completedCount >= assessment.maximum_attempts) {
      throw new Error(
        `You have used all ${assessment.maximum_attempts} attempt${
          assessment.maximum_attempts === 1 ? "" : "s"
        } for this assessment.`
      );
    }

    const totalMarks = questionData.reduce(
      (sum, { question: q }) => sum + q.marks,
      0
    );

    attempt = await startAttempt(
      assessmentId,
      employeeId,
      completedCount + 1,
      questionData.length,
      totalMarks
    );
  }

  // Build enriched question list; apply shuffle if configured
  let questions: PlayerQuestion[] = questionData.map(({ question, options }) => ({
    ...question,
    options,
  }));

  if (assessment.shuffle_questions) {
    questions = shuffleArray(questions);
  }

  questions = questions.map((q) => ({
    ...q,
    options:
      q.randomize_options || assessment.shuffle_options
        ? shuffleArray(q.options)
        : q.options,
  }));

  const existingAnswers = await loadExistingAnswers(attempt.id);

  return { assessment, attempt, questions, existingAnswers };
}

// ─── loadAssessmentPlayer ─────────────────────────────────────────────────────

export async function loadAssessmentPlayer(
  assessmentId: string,
  employeeId: string
): Promise<AssessmentPlayerPayload> {
  return await startAssessment(assessmentId, employeeId);
}

// ─── saveQuestionAnswer ───────────────────────────────────────────────────────
// Delegates directly to the repository. The repo upserts on (attempt_id, question_id)
// so duplicate rows can never be created regardless of how often this is called.

export async function saveQuestionAnswer(
  payload: SaveAnswerPayload
): Promise<AssessmentAnswer> {
  if (!payload.attemptId)  throw new Error("Attempt ID is required.");
  if (!payload.questionId) throw new Error("Question ID is required.");

  return await repositorySaveAnswer(payload);
}

// ─── submitAssessment ─────────────────────────────────────────────────────────
// Recalculates answered / skipped / unanswered counts from the actual rows
// persisted in assessment_answers before writing the terminal attempt record.
// The component supplies only timing and submission intent — counts are never
// trusted from the caller.
//
// Immediately after the terminal attempt record is written, this now also
// auto-grades every answer and creates the matching AssessmentResult —
// previously this was a separate manual step an admin had to do by hand.

export async function submitAssessment(
  request: SubmitRequest
): Promise<AssessmentAttempt> {
  if (!request.attemptId) throw new Error("Attempt ID is required.");

  // Fetch all answers saved for this attempt
  const savedAnswers = await loadExistingAnswers(request.attemptId);

  const answeredQuestions = savedAnswers.filter(
    (a) =>
      a.selected_option_ids.length > 0 ||
      a.answer_text.trim().length > 0
  ).length;

  // An answer row exists but has no options and no text → the question was
  // visited and explicitly skipped via the Skip button.
  const skippedQuestions = savedAnswers.filter(
    (a) =>
      a.selected_option_ids.length === 0 &&
      (a.answer_text ?? "").trim().length === 0
  ).length;

  // Questions for which no answer row exists at all → never visited
  const unansweredQuestions = Math.max(
    0,
    (request.totalQuestions ?? 0) - savedAnswers.length
  );

  const submitPayload: SubmitAssessmentPayload = {
    attemptId:            request.attemptId,
    timeTakenSeconds:     request.timeTakenSeconds,
    status:               request.status,
    autoSubmitted: request.autoSubmitted ?? false,
    answeredQuestions,
    skippedQuestions,
    unansweredQuestions,
  };

  const attempt = await repositorySubmitAssessment(submitPayload);

  // Auto-grade + auto-create the AssessmentResult. Never let a grading
  // failure hide the fact that the assessment itself was submitted
  // successfully — log it, but still return the submitted attempt.
  try {
    await finalizeAssessmentResult(request.attemptId);
  } catch (err) {
    console.error("[assessmentPlayerService] Auto-grading failed:", err);
  }

  return attempt;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
