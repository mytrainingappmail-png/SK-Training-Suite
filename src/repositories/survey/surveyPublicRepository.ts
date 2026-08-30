// Public (anon), unauthenticated survey-taking — deliberately never
// calls .auth.signIn* of any kind, unlike Live Quiz's join flow. A
// respondent doesn't need (and never gets) an identity of any sort;
// both RPCs below are the entire public surface, security-definer
// gated server-side.

import { supabaseQuizPlayer } from "../../lib/supabaseQuizPlayer";
import type { PublicSurvey, PublicSurveyRow, SurveyAnswerInput } from "../../types/survey";

function groupSurveyRows(rows: PublicSurveyRow[]): PublicSurvey | null {
  if (rows.length === 0) return null;
  const first = rows[0];
  const byQuestion = new Map<string, PublicSurvey["questions"][number]>();

  for (const row of rows) {
    let q = byQuestion.get(row.question_id);
    if (!q) {
      q = {
        question_id: row.question_id,
        question_text: row.question_text,
        type: row.type,
        required: row.required,
        scale_min: row.scale_min,
        scale_max: row.scale_max,
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

export async function submitSurveyResponse(accessCode: string, answers: SurveyAnswerInput[]): Promise<void> {
  const { error } = await supabaseQuizPlayer.rpc("submit_survey_response", { p_access_code: accessCode, p_answers: answers });
  if (error) {
    console.error("[surveyPublicRepository] submitSurveyResponse:", error);
    throw new Error(error.message);
  }
}
