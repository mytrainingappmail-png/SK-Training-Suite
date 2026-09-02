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
  await sessionRepo.updateSessionPhase(sessionId, {
    phase: "question",
    current_question_index: 0,
    started_at: new Date().toISOString(),
    question_started_at: new Date().toISOString(),
  });
}

/** Advances to the next question, or ends the session when the current one was the last. */
export async function advanceQuestion(sessionId: string, totalQuestions: number): Promise<"question" | "ended"> {
  const session = await sessionRepo.getSession(sessionId);
  if (!session) throw new Error("Session not found.");

  const nextIndex = session.current_question_index + 1;
  if (nextIndex >= totalQuestions) {
    await endSession(sessionId);
    return "ended";
  }

  await sessionRepo.updateSessionPhase(sessionId, {
    phase: "question",
    current_question_index: nextIndex,
    question_started_at: new Date().toISOString(),
  });
  return "question";
}

export async function pauseSession(sessionId: string): Promise<void> {
  await sessionRepo.updateSessionPhase(sessionId, { phase: "paused" });
}

export async function resumeSession(sessionId: string): Promise<void> {
  await sessionRepo.updateSessionPhase(sessionId, { phase: "question" });
}

export async function endSession(sessionId: string): Promise<void> {
  await sessionRepo.updateSessionPhase(sessionId, { phase: "ended", ended_at: new Date().toISOString() });
}

export { getSession, getSessionResults, listSessionsForQuiz, listSessionsForCompany } from "../../repositories/quiz/quizSessionRepository";
export { listParticipants } from "../../repositories/quiz/quizParticipantRepository";
