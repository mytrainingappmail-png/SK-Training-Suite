import { supabaseQuiz } from "../../lib/supabaseQuiz";
import { supabaseQuizPlayer } from "../../lib/supabaseQuizPlayer";
import type { QuizParticipant } from "../../types/quiz";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Used by the host (supabaseQuiz) and, via useQuizSessionRealtime, the player too (supabaseQuizPlayer) — client is passed in so each reads with its own identity. */
export async function listParticipants(sessionId: string, client: SupabaseClient = supabaseQuiz): Promise<QuizParticipant[]> {
  const { data, error } = await client
    .from("quiz_participants")
    .select("*")
    .eq("session_id", sessionId)
    .order("score", { ascending: false });

  if (error) {
    console.error("[quizParticipantRepository] listParticipants:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

interface FindSessionByPinRow {
  session_id: string;
  quiz_title: string;
  phase: string;
  join_mode: string;
  company_id: string;
}

/** Public PIN lookup — routed through a SECURITY DEFINER RPC so a joiner never gets raw table access to quiz_sessions. Always the participant client. */
export async function findSessionByPin(pin: string): Promise<FindSessionByPinRow | null> {
  const { data, error } = await supabaseQuizPlayer.rpc("find_quiz_session_by_pin", { p_pin: pin });

  if (error) {
    console.error("[quizParticipantRepository] findSessionByPin:", error);
    throw new Error(error.message);
  }

  return (data as FindSessionByPinRow[] | null)?.[0] ?? null;
}

interface JoinSessionRow {
  participant_id: string;
  score: number;
  correct_count: number;
}

/** Requires an active (anonymous) Supabase Auth session on supabaseQuizPlayer first. */
export async function joinSession(sessionId: string, displayName: string): Promise<JoinSessionRow> {
  const { data, error } = await supabaseQuizPlayer.rpc("join_quiz_session", {
    p_session_id: sessionId,
    p_display_name: displayName,
  });

  if (error) {
    console.error("[quizParticipantRepository] joinSession:", error);
    throw new Error(error.message);
  }

  const row = (data as JoinSessionRow[] | null)?.[0];
  if (!row) throw new Error("Could not join this quiz session.");
  return row;
}
