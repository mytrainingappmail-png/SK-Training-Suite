import { useEffect, useState } from "react";
import { supabaseQuiz } from "../../lib/supabaseQuiz";
import { getSession } from "../../repositories/quiz/quizSessionRepository";
import { listParticipants } from "../../repositories/quiz/quizParticipantRepository";
import type { QuizSession, QuizParticipant } from "../../types/quiz";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Keeps a live quiz session's phase/current-question and its participant
 * list in sync via Supabase Realtime — shared by both the host screen
 * (needs the participant list for the leaderboard) and the player screen
 * (needs session.phase/current_question_index to know when to advance),
 * same "host writes, everyone else follows" model as the original app,
 * just driven by Postgres row changes instead of Firebase.
 *
 * `client` must be the caller's OWN authenticated Supabase client —
 * supabaseQuiz for the host (a quiz_admin), supabaseQuizPlayer for a
 * participant — since Realtime enforces the same RLS as a normal query,
 * scoped to whichever identity the connection authenticated as.
 */
export function useQuizSessionRealtime(sessionId: string | null, client: SupabaseClient = supabaseQuiz) {
  const [session, setSession] = useState<QuizSession | null>(null);
  const [participants, setParticipants] = useState<QuizParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setParticipants([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([getSession(sessionId, client), listParticipants(sessionId, client)])
      .then(([s, p]) => {
        if (cancelled) return;
        setSession(s);
        setParticipants(p);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const channel = client
      .channel(`quiz-session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quiz_sessions", filter: `id=eq.${sessionId}` },
        (payload) => setSession(payload.new as QuizSession)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_participants", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id: string };
            setParticipants((prev) => prev.filter((p) => p.id !== oldRow.id));
            return;
          }
          const row = payload.new as QuizParticipant;
          setParticipants((prev) => {
            const exists = prev.some((p) => p.id === row.id);
            return exists ? prev.map((p) => (p.id === row.id ? row : p)) : [...prev, row];
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
  }, [sessionId, client]);

  return { session, participants, loading };
}
