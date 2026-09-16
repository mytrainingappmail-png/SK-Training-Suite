import * as sessionRepo from "../../repositories/quiz/quizSessionRepository";
import { getQuiz } from "./quizService";
import type { QuizSession, QuizJoinMode } from "../../types/quiz";

function shuffleArray<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function launchSession(
  quizId: string,
  companyId: string,
  hostAdminId: string,
  joinMode: QuizJoinMode
): Promise<QuizSession> {
  const quiz = await getQuiz(quizId);
  if (!quiz) throw new Error("Quiz not found.");
  if (quiz.status !== "published") throw new Error("Only a published quiz can be launched live.");
  if (quiz.questions.length === 0) throw new Error("This quiz has no questions yet.");

  const visibleIds = quiz.questions.filter((q) => !q.is_hidden).map((q) => q.id);
  if (visibleIds.length === 0) throw new Error("Every question in this quiz is hidden — unhide at least one before launching.");

  // Decided once at launch, not per-participant — current_question_index is a
  // single value broadcast to everyone, so every player must see the same order.
  // Always pre-filtered to visible questions, whether or not shuffle is on —
  // this is what keeps a hidden question from ever being served live.
  const questionOrder = quiz.shuffle_questions ? shuffleArray(visibleIds) : visibleIds;

  return sessionRepo.createSession(quizId, companyId, hostAdminId, joinMode, questionOrder);
}

export async function startQuiz(sessionId: string): Promise<void> {
  await sessionRepo.startQuizSessionNow(sessionId);
}

/** Advances to the next question, or ends the session when the current one was the last — totalQuestions is no longer taken on faith from the caller, the RPC resolves it itself from the session's own question_order. */
export async function advanceQuestion(sessionId: string, _totalQuestions?: number): Promise<"question" | "ended"> {
  return sessionRepo.advanceQuizSessionNow(sessionId);
}

export async function pauseSession(sessionId: string): Promise<void> {
  await sessionRepo.pauseQuizSessionNow(sessionId);
}

export async function resumeSession(sessionId: string): Promise<void> {
  await sessionRepo.resumeQuizSessionNow(sessionId);
}

export async function endSession(sessionId: string): Promise<void> {
  await sessionRepo.endQuizSessionNow(sessionId);
}

export { getSession, getSessionResults, listSessionsForQuiz, listSessionsForCompany } from "../../repositories/quiz/quizSessionRepository";
export { listParticipants } from "../../repositories/quiz/quizParticipantRepository";
