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
  // True once the channel has connected at least once; false while it's
  // disconnected/reconnecting. A dropped connection (phone locks, backgrounds,
  // a network blip) used to leave this screen silently frozen on whatever
  // it last knew — the host keeps advancing while this device never finds
  // out, which is exactly the "host and employee see different questions"
  // symptom this was built to fix.
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setParticipants([]);
      setLoading(false);
      setConnected(false);
      return;
    }

    let cancelled = false;
    let hasConnectedOnce = false;
    setLoading(true);

    function refetchAll() {
      Promise.all([getSession(sessionId as string, client), listParticipants(sessionId as string, client)])
        .then(([s, p]) => {
          if (cancelled) return;
          setSession(s);
          setParticipants(p);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    refetchAll();

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
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setConnected(true);
          // Re-fetch on every (re)connect, not just the first one — any
          // postgres_changes event missed while disconnected is gone for
          // good, so the only reliable way back to the true current state
          // is to ask for it fresh rather than trust the next diff.
          if (hasConnectedOnce) refetchAll();
          hasConnectedOnce = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
  }, [sessionId, client]);

  return { session, participants, loading, connected };
}
