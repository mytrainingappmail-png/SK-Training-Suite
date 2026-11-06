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
  joinMode: QuizJoinMode,
  /** The company default for "tell players right / wrong straight away" — the quiz's own choice, if it has one, wins. */
  revealDefault = true,
  /** The company default for "players may press Next early" — the quiz's own choice, if it has one, wins. */
  earlyNextDefault = false,
  /** A practice run: no shuffle, right / wrong shown, nothing kept (see migration 20261021100000). The quiz itself is not changed. */
  practice = false,
  /** The company's lobby wait music; each session keeps the music it had at launch. */
  lobbyMusic: { choice: "builtin" | "custom" | "off"; url: string | null; volume: number } | null = null
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
  // "Each player gets N random questions": the trainer's number (any number from 1 up), used only with the per-player shuffle on and when it is
  // fewer than the questions there are. The session then has N question slots (the host timeline is N long); each player's own set of N is
  // drawn by the database when they join. Practice runs always use every question.
  const pickWanted =
    !practice && quiz.shuffle_questions_per_participant && quiz.pick_count && quiz.pick_count >= 1 && quiz.pick_count < visibleIds.length
      ? Math.floor(quiz.pick_count)
      : null;

  const questionOrder = pickWanted
    ? shuffleArray(visibleIds).slice(0, pickWanted)
    : quiz.shuffle_questions && !practice ? shuffleArray(visibleIds) : visibleIds;

  return sessionRepo.createSession(
    quizId, companyId, hostAdminId, joinMode, questionOrder,
    practice ? true : quiz.reveal_answers ?? revealDefault,
    quiz.allow_early_next ?? earlyNextDefault,
    practice,
    lobbyMusic,
    pickWanted
  );
}

export async function startQuiz(sessionId: string): Promise<void> {
  await sessionRepo.startQuizSessionNow(sessionId);
}

/** Advances to the next question, or ends the session when the current one was the last — totalQuestions is no longer taken on faith from the caller, the RPC resolves it itself from the session's own question_order. */
export async function advanceQuestion(sessionId: string, _totalQuestions?: number, fromIndex?: number): Promise<"question" | "ended"> {
  return sessionRepo.advanceQuizSessionNow(sessionId, fromIndex);
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

export { getSession, getSessionResults, listSessionsForQuiz, listSessionsForCompany, practiceLeave, purgePracticeSessions } from "../../repositories/quiz/quizSessionRepository";
export { listParticipants } from "../../repositories/quiz/quizParticipantRepository";
