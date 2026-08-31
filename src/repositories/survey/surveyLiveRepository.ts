// Admin side of Survey's "short time" live sessions — same
// supabaseQuiz identity/RLS as the rest of the Survey admin surface.

import { supabaseQuiz } from "../../lib/supabaseQuiz";
import type { SurveySession, SurveySessionParticipant } from "../../types/survey";

function randomPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Same "generate, insert, retry on collision" pattern as Quiz's own createSession — PINs only need to be unique among currently-active sessions. `timeLimitSeconds` is optional — omit (or pass null) for no time limit. */
export async function createSurveySession(surveyId: string, companyId: string, hostAdminId: string, timeLimitSeconds?: number | null): Promise<SurveySession> {
  const expiresAt = timeLimitSeconds ? new Date(Date.now() + timeLimitSeconds * 1000).toISOString() : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const pin = randomPin();
    const { data, error } = await supabaseQuiz
      .from("survey_sessions")
      .insert({ survey_id: surveyId, company_id: companyId, host_admin_id: hostAdminId, pin, time_limit_seconds: timeLimitSeconds ?? null, expires_at: expiresAt })
      .select()
      .single();

    if (!error) return data;
    if (error.code !== "23505") {
      console.error("[surveyLiveRepository] createSurveySession:", error);
      throw new Error(error.message);
    }
  }
  throw new Error("Could not allocate a unique PIN after several attempts. Please try again.");
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
