// Public (anon), unauthenticated survey-taking — deliberately never
// calls .auth.signIn* of any kind, unlike Live Quiz's join flow. A
// respondent doesn't need (and never gets) an identity of any sort;
// both RPCs below are the entire public surface, security-definer
// gated server-side.

import { supabaseQuizPlayer } from "../../lib/supabaseQuizPlayer";
import type { PublicSurvey, PublicSurveyRow, JoinSurveySessionRow, JoinedSurveySession, SurveyAnswerInput, SurveySettings } from "../../types/survey";

type GroupableRow = Pick<PublicSurveyRow, "survey_id" | "title" | "description" | "scale_min" | "scale_max" | "time_limit_seconds" | "option_id" | "option_text"> & {
  question_id: string | null;
  question_text: string | null;
  type: PublicSurveyRow["type"] | null;
  required: boolean | null;
};

function groupSurveyRows(rows: GroupableRow[]): PublicSurvey | null {
  if (rows.length === 0) return null;
  const first = rows[0];
  const byQuestion = new Map<string, PublicSurvey["questions"][number]>();

  for (const row of rows) {
    if (!row.question_id || !row.question_text || !row.type) continue; // lobby row - no question yet
    let q = byQuestion.get(row.question_id);
    if (!q) {
      q = {
        question_id: row.question_id,
        question_text: row.question_text,
        type: row.type,
        required: !!row.required,
        scale_min: row.scale_min,
        scale_max: row.scale_max,
        time_limit_seconds: row.time_limit_seconds,
        options: [],
      };
      byQuestion.set(row.question_id, q);
    }
    if (row.option_id && row.option_text) {
      q.options.push({ option_id: row.option_id, option_text: row.option_text });
    }
  }

  return {
    survey_id: first.survey_id,
    title: first.title,
    description: first.description,
    questions: Array.from(byQuestion.values()),
  };
}

export async function getSurveyByCode(accessCode: string): Promise<PublicSurvey | null> {
  const { data, error } = await supabaseQuizPlayer.rpc("get_survey_by_code", { p_access_code: accessCode });
  if (error) {
    console.error("[surveyPublicRepository] getSurveyByCode:", error);
    throw new Error(error.message);
  }
  return groupSurveyRows((data as PublicSurveyRow[] | null) ?? []);
}

export async function getSurveyPublicSettings(accessCode: string): Promise<Pick<SurveySettings, "option_font_size" | "option_colors"> | null> {
  const { data, error } = await supabaseQuizPlayer.rpc("get_survey_public_settings", { p_access_code: accessCode });
  if (error) {
    console.error("[surveyPublicRepository] getSurveyPublicSettings:", error);
    return null;
  }
  const row = (data as { option_font_size: number; option_colors: SurveySettings["option_colors"] }[] | null)?.[0];
  return row ? { option_font_size: row.option_font_size, option_colors: row.option_colors } : null;
}

export async function submitSurveyResponse(accessCode: string, answers: SurveyAnswerInput[]): Promise<void> {
  const { error } = await supabaseQuizPlayer.rpc("submit_survey_response", { p_access_code: accessCode, p_answers: answers });
  if (error) {
    console.error("[surveyPublicRepository] submitSurveyResponse:", error);
    throw new Error(error.message);
  }
}

// ── Live sessions ("short time", PIN-join, named) ──────────────────

function toJoinedSession(rows: JoinSurveySessionRow[], receivedAtMs: number): JoinedSurveySession | null {
  if (rows.length === 0) return null;
  const first = rows[0];
  const serverNowMs = new Date(first.server_now).getTime();
  return {
    survey_id: first.survey_id,
    title: first.title,
    description: first.description,
    questions: groupSurveyRows(rows)?.questions ?? [],
    participant_id: first.participant_id,
    opens_at: first.opens_at,
    expires_at: first.expires_at,
    clock_offset_ms: serverNowMs - receivedAtMs,
    is_open: new Date(first.opens_at).getTime() <= serverNowMs,
  };
}

export async function joinSurveySession(pin: string, displayName: string): Promise<JoinedSurveySession | null> {
  const { data, error } = await supabaseQuizPlayer.rpc("join_survey_session", { p_pin: pin, p_display_name: displayName });
  const receivedAt = Date.now();
  if (error) {
    console.error("[surveyPublicRepository] joinSurveySession:", error);
    throw new Error(error.message);
  }
  return toJoinedSession((data as JoinSurveySessionRow[] | null) ?? [], receivedAt);
}

/** Called once the lobby countdown reaches zero (and then re-polled until it succeeds) - the questions only come back after the survey has really opened, by the database's clock. */
export async function getSurveySessionQuestions(participantId: string): Promise<JoinedSurveySession | null> {
  const { data, error } = await supabaseQuizPlayer.rpc("get_survey_session_questions", { p_participant_id: participantId });
  const receivedAt = Date.now();
  if (error) {
    console.error("[surveyPublicRepository] getSurveySessionQuestions:", error);
    throw new Error(error.message);
  }
  return toJoinedSession((data as JoinSurveySessionRow[] | null) ?? [], receivedAt);
}

export async function submitSurveySessionResponse(participantId: string, answers: SurveyAnswerInput[]): Promise<void> {
  const { error } = await supabaseQuizPlayer.rpc("submit_survey_session_response", { p_participant_id: participantId, p_answers: answers });
  if (error) {
    console.error("[surveyPublicRepository] submitSurveySessionResponse:", error);
    throw new Error(error.message);
  }
}
