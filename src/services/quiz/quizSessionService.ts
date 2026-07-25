import * as sessionRepo from "../../repositories/quiz/quizSessionRepository";
import { getQuiz } from "./quizService";
import type { QuizSession, QuizJoinMode } from "../../types/quiz";

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

  return sessionRepo.createSession(quizId, companyId, hostAdminId, joinMode);
}

export async function startQuiz(sessionId: string): Promise<void> {
  await sessionRepo.updateSessionPhase(sessionId, {
    phase: "question",
    current_question_index: 0,
    started_at: new Date().toISOString(),
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

  await sessionRepo.updateSessionPhase(sessionId, { phase: "question", current_question_index: nextIndex });
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
