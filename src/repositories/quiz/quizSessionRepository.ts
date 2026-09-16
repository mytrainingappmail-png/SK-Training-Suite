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
  joinMode: QuizJoinMode,
  questionOrder: string[] | null = null
): Promise<QuizSession> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const pin = randomPin();
    const { data, error } = await supabaseQuiz
      .from("quiz_sessions")
      .insert({ quiz_id: quizId, company_id: companyId, host_admin_id: hostAdminId, pin, join_mode: joinMode, question_order: questionOrder })
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

// ── Server-clock-authoritative session timing ───────────────────────────────
// question_started_at must never be stamped by a client's own Date.now() —
// the auto-advance safety net (quiz_participant_heartbeat) checks expiry
// against the DATABASE's clock, so a start-time written by a client with
// any clock drift makes a question look like it started earlier (or later)
// than it really did. These RPCs let the database set its own "now".

export async function startQuizSessionNow(sessionId: string): Promise<void> {
  const { error } = await supabaseQuiz.rpc("start_quiz_session", { p_session_id: sessionId });
  if (error) {
    console.error("[quizSessionRepository] startQuizSessionNow:", error);
    throw new Error(error.message);
  }
}

export async function advanceQuizSessionNow(sessionId: string): Promise<"question" | "ended"> {
  const { data, error } = await supabaseQuiz.rpc("advance_quiz_session", { p_session_id: sessionId });
  if (error) {
    console.error("[quizSessionRepository] advanceQuizSessionNow:", error);
    throw new Error(error.message);
  }
  return data as "question" | "ended";
}

export async function pauseQuizSessionNow(sessionId: string): Promise<void> {
  const { error } = await supabaseQuiz.rpc("pause_quiz_session", { p_session_id: sessionId });
  if (error) {
    console.error("[quizSessionRepository] pauseQuizSessionNow:", error);
    throw new Error(error.message);
  }
}

export async function resumeQuizSessionNow(sessionId: string): Promise<void> {
  const { error } = await supabaseQuiz.rpc("resume_quiz_session", { p_session_id: sessionId });
  if (error) {
    console.error("[quizSessionRepository] resumeQuizSessionNow:", error);
    throw new Error(error.message);
  }
}

export async function endQuizSessionNow(sessionId: string): Promise<void> {
  const { error } = await supabaseQuiz.rpc("end_quiz_session", { p_session_id: sessionId });
  if (error) {
    console.error("[quizSessionRepository] endQuizSessionNow:", error);
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

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabaseQuiz.from("quiz_sessions").delete().eq("id", sessionId);

  if (error) {
    console.error("[quizSessionRepository] deleteSession:", error);
    throw new Error(error.message);
  }
}

/** One statement for the whole batch, so clearing out a pile of old
 * practice sessions doesn't mean clicking delete once per row. */
export async function deleteSessions(sessionIds: string[]): Promise<void> {
  if (sessionIds.length === 0) return;
  const { error } = await supabaseQuiz.from("quiz_sessions").delete().in("id", sessionIds);

  if (error) {
    console.error("[quizSessionRepository] deleteSessions:", error);
    throw new Error(error.message);
  }
}

export async function deleteAllSessions(companyId: string): Promise<void> {
  const { error } = await supabaseQuiz.from("quiz_sessions").delete().eq("company_id", companyId);

  if (error) {
    console.error("[quizSessionRepository] deleteAllSessions:", error);
    throw new Error(error.message);
  }
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
