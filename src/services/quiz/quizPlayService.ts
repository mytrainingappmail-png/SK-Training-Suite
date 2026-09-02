import { supabaseQuizPlayer } from "../../lib/supabaseQuizPlayer";
import * as participantRepo from "../../repositories/quiz/quizParticipantRepository";
import * as answerRepo from "../../repositories/quiz/quizAnswerRepository";
import type { PublicQuizQuestion, SubmitAnswerResult } from "../../types/quiz";

const PLAYER_NAME_KEY = "QUIZ_PLAYER_NAME";
const PLAYER_CREDENTIALS_KEY = "QUIZ_PLAYER_CREDENTIALS";

export function getSavedPlayerName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function savePlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch {
    // non-fatal — just means the join form won't pre-fill next time
  }
}

interface PlayerCredentials {
  email: string;
  password: string;
}

function getSavedCredentials(): PlayerCredentials | null {
  try {
    const raw = localStorage.getItem(PLAYER_CREDENTIALS_KEY);
    return raw ? (JSON.parse(raw) as PlayerCredentials) : null;
  } catch {
    return null;
  }
}

function saveCredentials(creds: PlayerCredentials): void {
  try {
    localStorage.setItem(PLAYER_CREDENTIALS_KEY, JSON.stringify(creds));
  } catch {
    // non-fatal — worst case a new throwaway account is minted next visit
  }
}

/**
 * Anonymous Sign-Ins are disabled on this Supabase project (a dashboard
 * setting we don't touch programmatically) — but RLS/Realtime still need
 * a real auth.uid() per participant. Reuses a throwaway, single-purpose
 * account created once per browser via provision-quiz-participant-auth
 * (service role, mints a random email/password) and saved to
 * localStorage, so a device that joins many quizzes over time still only
 * ever creates ONE auth user, not one per join.
 */
async function ensureParticipantSession(): Promise<void> {
  const { data } = await supabaseQuizPlayer.auth.getSession();
  if (data.session) return;

  const saved = getSavedCredentials();
  if (saved) {
    const { error } = await supabaseQuizPlayer.auth.signInWithPassword(saved);
    if (!error) return;
    console.warn("[quizPlayService] saved participant credentials no longer valid, provisioning a new one:", error.message);
  }

  const { data: fnData, error: fnError } = await supabaseQuizPlayer.functions.invoke("provision-quiz-participant-auth", {
    body: {},
  });
  if (fnError || !fnData?.success) {
    console.error("[quizPlayService] provision-quiz-participant-auth:", fnError?.message ?? fnData?.error);
    throw new Error("Could not connect. Please check your internet connection and try again.");
  }

  const creds: PlayerCredentials = { email: fnData.email, password: fnData.password };
  const { error: signInError } = await supabaseQuizPlayer.auth.signInWithPassword(creds);
  if (signInError) {
    console.error("[quizPlayService] signInWithPassword (new participant):", signInError.message);
    throw new Error("Could not connect. Please check your internet connection and try again.");
  }

  saveCredentials(creds);
}

export interface JoinResult {
  sessionId: string;
  participantId: string;
  quizTitle: string;
  phase: string;
  score: number;
  correctCount: number;
}

export async function joinByPin(pin: string, displayName: string): Promise<JoinResult> {
  const trimmedPin = pin.trim();
  const trimmedName = displayName.trim();
  if (trimmedPin.length !== 6) throw new Error("Enter a valid 6-digit PIN.");
  if (!trimmedName) throw new Error("Enter your name.");

  const found = await participantRepo.findSessionByPin(trimmedPin);
  if (!found) throw new Error("Invalid PIN. Ask your trainer to launch a quiz first.");

  await ensureParticipantSession();

  const joined = await participantRepo.joinSession(found.session_id, trimmedName);
  savePlayerName(trimmedName);

  return {
    sessionId: found.session_id,
    participantId: joined.participant_id,
    quizTitle: found.quiz_title,
    phase: found.phase,
    score: joined.score,
    correctCount: joined.correct_count,
  };
}

export async function getCurrentQuestion(sessionId: string): Promise<PublicQuizQuestion | null> {
  return answerRepo.getCurrentQuestion(sessionId);
}

export async function submitAnswer(
  sessionId: string,
  questionId: string,
  optionId: string | null,
  responseTimeMs: number
): Promise<SubmitAnswerResult> {
  return answerRepo.submitAnswer(sessionId, questionId, optionId, responseTimeMs);
}

export async function heartbeat(sessionId: string): Promise<void> {
  return participantRepo.heartbeat(sessionId);
}
