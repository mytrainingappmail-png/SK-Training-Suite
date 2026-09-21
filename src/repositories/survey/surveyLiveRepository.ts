// Admin side of Survey's "short time" live sessions — same
// supabaseQuiz identity/RLS as the rest of the Survey admin surface.

import { supabaseQuiz } from "../../lib/supabaseQuiz";
import type { SurveySession, SurveySessionParticipant } from "../../types/survey";

export interface SurveyStartOptions {
  /** Total time once the survey is open; omit/null for no limit. */
  timeLimitSeconds?: number | null;
  /** Open this many seconds from now (lobby countdown until then). */
  startInSeconds?: number | null;
  /** Or open at this exact moment. Wins over startInSeconds. */
  startAt?: Date | null;
}

/** Everything time-related is computed by the DATABASE clock inside the RPC (never this browser's), including the PIN allocation. */
export async function createSurveySession(surveyId: string, options: SurveyStartOptions = {}): Promise<SurveySession> {
  const { data, error } = await supabaseQuiz.rpc("create_survey_session", {
    p_survey_id: surveyId,
    p_time_limit_seconds: options.timeLimitSeconds ?? null,
    p_start_in_seconds: options.startInSeconds ?? null,
    p_start_at: options.startAt ? options.startAt.toISOString() : null,
  });
  if (error) {
    console.error("[surveyLiveRepository] createSurveySession:", error);
    throw new Error(error.message);
  }
  const row = (data as SurveySession[] | null)?.[0];
  if (!row) throw new Error("Could not start the session.");
  return row;
}

export async function startSurveySessionNow(sessionId: string): Promise<void> {
  const { error } = await supabaseQuiz.rpc("start_survey_session_now", { p_session_id: sessionId });
  if (error) {
    console.error("[surveyLiveRepository] startSurveySessionNow:", error);
    throw new Error(error.message);
  }
}

export async function extendSurveySession(sessionId: string, addSeconds: number): Promise<void> {
  const { error } = await supabaseQuiz.rpc("extend_survey_session", { p_session_id: sessionId, p_add_seconds: addSeconds });
  if (error) {
    console.error("[surveyLiveRepository] extendSurveySession:", error);
    throw new Error(error.message);
  }
}

export async function getSurveySession(sessionId: string): Promise<SurveySession | null> {
  const { data, error } = await supabaseQuiz.from("survey_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) {
    console.error("[surveyLiveRepository] getSurveySession:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function listSurveySessions(surveyId: string): Promise<SurveySession[]> {
  const { data, error } = await supabaseQuiz.from("survey_sessions").select("*").eq("survey_id", surveyId).order("started_at", { ascending: false });
  if (error) {
    console.error("[surveyLiveRepository] listSurveySessions:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function listSessionParticipants(sessionId: string): Promise<SurveySessionParticipant[]> {
  const { data, error } = await supabaseQuiz.from("survey_session_participants").select("*").eq("session_id", sessionId).order("joined_at", { ascending: true });
  if (error) {
    console.error("[surveyLiveRepository] listSessionParticipants:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function endSurveySession(sessionId: string): Promise<void> {
  const { error } = await supabaseQuiz.from("survey_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", sessionId);
  if (error) {
    console.error("[surveyLiveRepository] endSurveySession:", error);
    throw new Error(error.message);
  }
}
