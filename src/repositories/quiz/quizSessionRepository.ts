import { supabaseQuiz } from "../../lib/supabaseQuiz";
import type { QuizSession, QuizSessionPhase, QuizJoinMode, QuizSessionResultRow } from "../../types/quiz";
import type { SupabaseClient } from "@supabase/supabase-js";

function randomPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Creates a lobby session with a fresh 6-digit PIN, retrying on the rare collision with another active PIN. */
export async function createSession(
  quizId: string,
  companyId: string,
  hostAdminId: string,
  joinMode: QuizJoinMode
): Promise<QuizSession> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const pin = randomPin();
    const { data, error } = await supabaseQuiz
      .from("quiz_sessions")
      .insert({ quiz_id: quizId, company_id: companyId, host_admin_id: hostAdminId, pin, join_mode: joinMode })
      .select()
      .single();

    if (!error) return data;
    // 23505 = unique_violation — another active session already holds this PIN, try again.
    if (error.code !== "23505") {
      console.error("[quizSessionRepository] createSession:", error);
      throw new Error(error.message);
    }
  }

  throw new Error("Could not allocate a unique PIN after several attempts. Please try again.");
}

/** Used by the host (supabaseQuiz) and, via useQuizSessionRealtime, the player too (supabaseQuizPlayer). */
export async function getSession(sessionId: string, client: SupabaseClient = supabaseQuiz): Promise<QuizSession | null> {
  const { data, error } = await client.from("quiz_sessions").select("*").eq("id", sessionId).maybeSingle();

  if (error) {
    console.error("[quizSessionRepository] getSession:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateSessionPhase(
  sessionId: string,
  patch: Partial<Pick<QuizSession, "phase" | "current_question_index" | "started_at" | "ended_at">>
): Promise<void> {
  const { error } = await supabaseQuiz.from("quiz_sessions").update(patch).eq("id", sessionId);

  if (error) {
    console.error("[quizSessionRepository] updateSessionPhase:", error);
    throw new Error(error.message);
  }
}

export type { QuizSessionPhase };

export async function listSessionsForQuiz(quizId: string): Promise<QuizSession[]> {
  const { data, error } = await supabaseQuiz
    .from("quiz_sessions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[quizSessionRepository] listSessionsForQuiz:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function listSessionsForCompany(companyId: string): Promise<QuizSession[]> {
  const { data, error } = await supabaseQuiz
    .from("quiz_sessions")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[quizSessionRepository] listSessionsForCompany:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getSessionResults(sessionId: string): Promise<QuizSessionResultRow[]> {
  const { data, error } = await supabaseQuiz
    .from("quiz_session_results")
    .select("*")
    .eq("session_id", sessionId)
    .order("score", { ascending: false });

  if (error) {
    console.error("[quizSessionRepository] getSessionResults:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}
