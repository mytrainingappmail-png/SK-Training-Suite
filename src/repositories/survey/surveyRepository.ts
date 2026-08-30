// Admin side of Survey — same supabaseQuiz client/identity as Quizzes
// (one quiz_admins login covers both sections), RLS-scoped to the
// admin's own company via current_quiz_admin_company_id().

import { supabaseQuiz } from "../../lib/supabaseQuiz";
import type {
  Survey,
  SurveyWithQuestions,
  SurveyStatus,
  SurveyQuestionWithOptions,
  SurveyResults,
  SurveyQuestionResult,
  SurveySentiment,
  SurveySettings,
} from "../../types/survey";

export interface SurveyForm {
  title: string;
  description: string;
  closes_at: string | null;
}

export interface SurveyQuestionForm {
  question_text: string;
  type: "single_choice" | "multi_choice" | "scale" | "open_text";
  required: boolean;
  scale_min: number | null;
  scale_max: number | null;
  options: { option_text: string; sentiment: SurveySentiment }[];
}

export async function listSurveys(companyId: string): Promise<Survey[]> {
  const { data, error } = await supabaseQuiz
    .from("surveys")
    .select("*")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[surveyRepository] listSurveys:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function getSurveyWithQuestions(surveyId: string): Promise<SurveyWithQuestions | null> {
  const { data: survey, error: surveyError } = await supabaseQuiz.from("surveys").select("*").eq("id", surveyId).maybeSingle();
  if (surveyError) {
    console.error("[surveyRepository] getSurveyWithQuestions (survey):", surveyError);
    throw new Error(surveyError.message);
  }
  if (!survey) return null;

  const { data: questions, error: qError } = await supabaseQuiz
    .from("survey_questions")
    .select("*, options:survey_question_options(*)")
    .eq("survey_id", surveyId)
    .order("display_order", { ascending: true });

  if (qError) {
    console.error("[surveyRepository] getSurveyWithQuestions (questions):", qError);
    throw new Error(qError.message);
  }

  const sortedQuestions = (questions ?? []).map((q) => ({
    ...q,
    options: (q.options ?? []).slice().sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order),
  }));

  return { ...survey, questions: sortedQuestions };
}

export async function createSurvey(companyId: string, createdBy: string | null, form: SurveyForm): Promise<Survey> {
  const { data, error } = await supabaseQuiz
    .from("surveys")
    .insert({ ...form, company_id: companyId, created_by: createdBy })
    .select()
    .single();

  if (error) {
    console.error("[surveyRepository] createSurvey:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function updateSurveyMeta(surveyId: string, form: Partial<SurveyForm>): Promise<Survey> {
  const { data, error } = await supabaseQuiz
    .from("surveys")
    .update({ ...form, updated_at: new Date().toISOString() })
    .eq("id", surveyId)
    .select()
    .single();

  if (error) {
    console.error("[surveyRepository] updateSurveyMeta:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function setSurveyStatus(surveyId: string, status: SurveyStatus): Promise<void> {
  const { error } = await supabaseQuiz.from("surveys").update({ status, updated_at: new Date().toISOString() }).eq("id", surveyId);
  if (error) {
    console.error("[surveyRepository] setSurveyStatus:", error);
    throw new Error(error.message);
  }
}

export async function deleteSurvey(surveyId: string): Promise<void> {
  const { error } = await supabaseQuiz.from("surveys").delete().eq("id", surveyId);
  if (error) {
    console.error("[surveyRepository] deleteSurvey:", error);
    throw new Error(error.message);
  }
}

/** Replaces the whole question set for a survey — same "edit in memory, save all at once" pattern as the quiz builder. */
export async function replaceSurveyQuestions(surveyId: string, questions: SurveyQuestionForm[]): Promise<void> {
  const { error: delError } = await supabaseQuiz.from("survey_questions").delete().eq("survey_id", surveyId);
  if (delError) {
    console.error("[surveyRepository] replaceSurveyQuestions (delete):", delError);
    throw new Error(delError.message);
  }

  if (questions.length === 0) return;

  const { data: insertedQuestions, error: qError } = await supabaseQuiz
    .from("survey_questions")
    .insert(
      questions.map((q, i) => ({
        survey_id: surveyId,
        question_text: q.question_text,
        type: q.type,
        required: q.required,
        scale_min: q.type === "scale" ? q.scale_min : null,
        scale_max: q.type === "scale" ? q.scale_max : null,
        display_order: i,
      }))
    )
    .select("id");

  if (qError) {
    console.error("[surveyRepository] replaceSurveyQuestions (insert questions):", qError);
    throw new Error(qError.message);
  }

  const optionRows = (insertedQuestions ?? []).flatMap((row, qi) =>
    questions[qi].options.map((opt, oi) => ({
      question_id: row.id,
      option_text: opt.option_text,
      sentiment: opt.sentiment,
      display_order: oi,
    }))
  );

  if (optionRows.length === 0) return;

  const { error: oError } = await supabaseQuiz.from("survey_question_options").insert(optionRows);
  if (oError) {
    console.error("[surveyRepository] replaceSurveyQuestions (insert options):", oError);
    throw new Error(oError.message);
  }
}

// ── Results (anonymous by construction — see the migration's header note) ──

interface RawSurveyAnswer {
  question_id: string;
  selected_option_ids: string[] | null;
  scale_value: number | null;
  text_value: string | null;
}

export async function fetchSurveyResults(surveyId: string, questions: SurveyQuestionWithOptions[]): Promise<SurveyResults> {
  const { data: responses, error: rError } = await supabaseQuiz.from("survey_responses").select("id").eq("survey_id", surveyId);
  if (rError) {
    console.error("[surveyRepository] fetchSurveyResults (responses):", rError);
    throw new Error(rError.message);
  }
  const responseIds = (responses ?? []).map((r) => r.id);

  let answers: RawSurveyAnswer[] = [];
  if (responseIds.length > 0) {
    const { data, error: aError } = await supabaseQuiz.from("survey_answers").select("*").in("response_id", responseIds);
    if (aError) {
      console.error("[surveyRepository] fetchSurveyResults (answers):", aError);
      throw new Error(aError.message);
    }
    answers = data ?? [];
  }

  // Best-effort — a quiz_admin session may not always resolve a linked
  // employee headcount (e.g. a dedicated quiz-only login); the
  // response data itself is never blocked on this.
  let eligibleCount: number | null = null;
  try {
    const { data, error } = await supabaseQuiz.rpc("get_company_active_employee_count");
    if (!error) eligibleCount = data as number;
  } catch {
    eligibleCount = null;
  }

  return buildSurveyResults(questions, answers, responseIds.length, eligibleCount);
}

/** Positivity is only meaningful for choice/scale questions — open_text
 * has nothing numeric to score, so it's simply excluded from the
 * overall average rather than forced into one. */
function buildSurveyResults(questions: SurveyQuestionWithOptions[], answers: RawSurveyAnswer[], totalResponses: number, eligibleCount: number | null): SurveyResults {
  const results: SurveyQuestionResult[] = questions.map((q) => {
    const forQuestion = answers.filter((a) => a.question_id === q.id);

    if (q.type === "single_choice" || q.type === "multi_choice") {
      const counts = new Map<string, number>();
      forQuestion.forEach((a) => (a.selected_option_ids ?? []).forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1)));
      const choiceBreakdown = q.options.map((o) => ({ option_id: o.id, option_text: o.option_text, sentiment: o.sentiment, count: counts.get(o.id) ?? 0 }));
      const totalSelections = choiceBreakdown.reduce((sum, c) => sum + c.count, 0);
      const positiveSelections = choiceBreakdown.filter((c) => c.sentiment === "positive").reduce((sum, c) => sum + c.count, 0);
      const positivityScore = totalSelections > 0 ? (positiveSelections / totalSelections) * 100 : undefined;
      return { question: q, totalAnswers: forQuestion.length, choiceBreakdown, positivityScore };
    }

    if (q.type === "scale") {
      const values = forQuestion.map((a) => a.scale_value).filter((v): v is number => v !== null);
      const averageScale = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
      const distCounts = new Map<number, number>();
      values.forEach((v) => distCounts.set(v, (distCounts.get(v) ?? 0) + 1));
      const min = q.scale_min ?? 1;
      const max = q.scale_max ?? 5;
      const scaleDistribution = Array.from({ length: max - min + 1 }, (_, i) => min + i).map((value) => ({ value, count: distCounts.get(value) ?? 0 }));
      const positivityScore = values.length > 0 && max > min ? ((averageScale - min) / (max - min)) * 100 : undefined;
      return { question: q, totalAnswers: values.length, averageScale, scaleDistribution, positivityScore };
    }

    // open_text
    const textAnswers = forQuestion
      .map((a) => a.text_value)
      .filter((t): t is string => !!t)
      .reverse();
    return { question: q, totalAnswers: textAnswers.length, textAnswers };
  });

  const scored = results.filter((r) => r.positivityScore !== undefined).map((r) => r.positivityScore as number);
  const overallPositivityScore = scored.length > 0 ? scored.reduce((sum, v) => sum + v, 0) / scored.length : undefined;

  return { totalResponses, eligibleCount, questions: results, overallPositivityScore };
}

// ── CSV export ──────────────────────────────────────────────────────

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildResultsCsv(survey: Survey, results: SurveyResults): string {
  const lines: string[] = [csvEscape(survey.title), ""];
  lines.push("Question,Type,Total Answers,Breakdown");
  results.questions.forEach((qr) => {
    let breakdown = "";
    if (qr.choiceBreakdown) {
      breakdown = qr.choiceBreakdown.map((c) => `${c.option_text}: ${c.count}`).join(" | ");
    } else if (qr.averageScale !== undefined) {
      breakdown = `Average: ${qr.averageScale.toFixed(2)} / ${qr.question.scale_max}`;
    } else if (qr.textAnswers) {
      breakdown = qr.textAnswers.map((t) => t.replace(/\n/g, " ")).join(" | ");
    }
    lines.push([qr.question.question_text, qr.question.type, String(qr.totalAnswers), breakdown].map(csvEscape).join(","));
  });
  lines.push("");
  lines.push(`Total Responses,${results.totalResponses}`);
  if (results.eligibleCount !== null) lines.push(`Eligible Employees,${results.eligibleCount}`);
  if (results.overallPositivityScore !== undefined) lines.push(`Overall Positivity Score,${results.overallPositivityScore.toFixed(1)}%`);
  return lines.join("\n");
}

export function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Survey Settings (company-wide, separate from quiz_settings) ────────

const DEFAULT_SETTINGS: Omit<SurveySettings, "company_id" | "updated_at"> = {
  option_font_size: 16,
  option_colors: [
    { box: "#7C3AED", font: "#FFFFFF" },
    { box: "#2563EB", font: "#FFFFFF" },
    { box: "#059669", font: "#FFFFFF" },
    { box: "#D97706", font: "#FFFFFF" },
    { box: "#DB2777", font: "#FFFFFF" },
    { box: "#0891B2", font: "#FFFFFF" },
  ],
};

export async function getSurveySettings(companyId: string): Promise<SurveySettings> {
  const { data, error } = await supabaseQuiz.from("survey_settings").select("*").eq("company_id", companyId).maybeSingle();
  if (error) {
    console.error("[surveyRepository] getSurveySettings:", error);
    throw new Error(error.message);
  }
  return data ?? { company_id: companyId, updated_at: new Date().toISOString(), ...DEFAULT_SETTINGS };
}

export async function saveSurveySettings(companyId: string, patch: Partial<SurveySettings>): Promise<SurveySettings> {
  const { data, error } = await supabaseQuiz
    .from("survey_settings")
    .upsert({ company_id: companyId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "company_id" })
    .select()
    .single();
  if (error) {
    console.error("[surveyRepository] saveSurveySettings:", error);
    throw new Error(error.message);
  }
  return data;
}
