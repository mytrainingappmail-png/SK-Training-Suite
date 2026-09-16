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
    let isConnected = false;
    let channel: ReturnType<SupabaseClient["channel"]> | null = null;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryAttempt = 0;
    let channelSeq = 0;
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

    function clearTimers() {
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    }

    // Schedules a fresh connection attempt with capped backoff — used both
    // for an explicit error status and for the watchdog below, so a flaky
    // (weak-signal) connection doesn't hammer the server with instant
    // back-to-back retries.
    function scheduleRetry() {
      if (cancelled || retryTimer) return;
      const delay = Math.min(1000 * 2 ** retryAttempt, 15000);
      retryAttempt++;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (!cancelled) openChannel();
      }, delay);
    }

    // Tears down whatever channel exists and opens a brand new one. Always
    // creating a fresh channel (never reusing/resubscribing the old one) is
    // deliberate — a channel that silently died (mobile backgrounded, weak
    // signal) can be left in a half-alive state where neither SUBSCRIBED nor
    // an error status ever fires again, so the only reliable recovery is to
    // discard it and start over.
    function openChannel() {
      if (cancelled) return;
      clearTimers();
      if (channel) {
        client.removeChannel(channel);
        channel = null;
      }

      const mySeq = ++channelSeq;
      const newChannel = client
        .channel(`quiz-session-${sessionId}-${mySeq}`)
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
          if (cancelled || mySeq !== channelSeq) return; // a stale callback from a channel we already replaced
          if (status === "SUBSCRIBED") {
            isConnected = true;
            retryAttempt = 0;
            clearTimers();
            setConnected(true);
            // Re-fetch on every (re)connect, not just the first one — any
            // postgres_changes event missed while disconnected is gone for
            // good, so the only reliable way back to the true current state
            // is to ask for it fresh rather than trust the next diff.
            if (hasConnectedOnce) refetchAll();
            hasConnectedOnce = true;
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            isConnected = false;
            setConnected(false);
            scheduleRetry();
          }
        });
      channel = newChannel;

      // Watchdog: on a weak/flaky connection a channel can sit "joining"
      // forever — never reaching SUBSCRIBED and never firing an error status
      // either — which used to leave the screen frozen with no path back
      // except a manual page refresh. If it hasn't connected within 8s,
      // treat that as failed and retry with a fresh channel.
      watchdogTimer = setTimeout(() => {
        if (!cancelled && mySeq === channelSeq && !isConnected) scheduleRetry();
      }, 8000);
    }

    refetchAll();
    openChannel();

    // A phone being locked, the app switched away from, or the browser
    // backgrounding the tab to save battery/data on a weak connection can
    // kill the socket outright — sometimes without the socket's own onClose
    // ever firing, since the JS timers driving its reconnect logic are
    // frozen right along with the tab. Coming back to the tab (or the
    // network coming back after a drop) is exactly the moment to stop
    // waiting on the socket to notice on its own and force a fresh
    // connection + resync instead — this is what turns the old "stuck until
    // you refresh" symptom into a normal, automatic recovery.
    function handleReconnectSignal() {
      if (cancelled || document.visibilityState === "hidden") return;
      retryAttempt = 0;
      openChannel();
      refetchAll();
    }

    document.addEventListener("visibilitychange", handleReconnectSignal);
    window.addEventListener("online", handleReconnectSignal);

    return () => {
      cancelled = true;
      clearTimers();
      document.removeEventListener("visibilitychange", handleReconnectSignal);
      window.removeEventListener("online", handleReconnectSignal);
      if (channel) client.removeChannel(channel);
    };
  }, [sessionId, client]);

  return { session, participants, loading, connected };
}
