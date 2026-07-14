import { supabase } from "../../lib/supabase";
import type { Assessment } from "../../types/assessment";
import type { Question } from "../../types/question";
import type { QuestionOption } from "../../types/question";
import type {
  AssessmentAttempt,
  AssessmentAnswer,
  SaveAnswerPayload,
  SubmitAssessmentPayload,
} from "../../types/assessmentPlayer";

// ─── loadAssessment ───────────────────────────────────────────────────────────

export async function loadAssessment(
  assessmentId: string
): Promise<Assessment> {
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("id", assessmentId)
    .single();

  if (error) {
    console.error("[assessmentPlayerRepository] loadAssessment:", error);
    throw new Error(error.message);
  }

  return data;
}

// ─── loadQuestions ────────────────────────────────────────────────────────────

export async function loadQuestions(
  assessmentId: string
): Promise<{ question: Question; options: QuestionOption[] }[]> {
  const { data: questions, error: qErr } = await supabase
    .from("question_bank")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("active", true)
    .order("display_order", { ascending: true });

  if (qErr) {
    console.error("[assessmentPlayerRepository] loadQuestions:", qErr);
    throw new Error(qErr.message);
  }

  const questionList: Question[] = questions ?? [];

  if (questionList.length === 0) {
    return [];
  }

  const questionIds = questionList.map((q) => q.id);

  const { data: options, error: oErr } = await supabase
    .from("question_options")
    .select("*")
    .in("question_id", questionIds)
    .order("display_order", { ascending: true });

  if (oErr) {
    console.error("[assessmentPlayerRepository] loadQuestions (options):", oErr);
    throw new Error(oErr.message);
  }

  const optionList: QuestionOption[] = options ?? [];

  const optionsByQuestion = optionList.reduce<Record<string, QuestionOption[]>>(
    (acc, opt) => {
      if (!acc[opt.question_id]) acc[opt.question_id] = [];
      acc[opt.question_id].push(opt);
      return acc;
    },
    {}
  );

  return questionList.map((q) => ({
    question: q,
    options: optionsByQuestion[q.id] ?? [],
  }));
}

// ─── loadExistingAttempt ──────────────────────────────────────────────────────

export async function loadExistingAttempt(
  assessmentId: string,
  employeeId: string
): Promise<AssessmentAttempt | null> {
  const { data, error } = await supabase
    .from("assessment_attempts")
    .select("*")
    .eq("assessment_id", assessmentId)
    .eq("employee_id", employeeId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[assessmentPlayerRepository] loadExistingAttempt:", error);
    throw new Error(error.message);
  }

  return data ?? null;
}

// ─── countCompletedAttempts ───────────────────────────────────────────────────

export async function countCompletedAttempts(
  assessmentId: string,
  employeeId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("assessment_attempts")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId)
    .eq("employee_id", employeeId)
    .neq("status", "abandoned")
    .neq("status", "in_progress");

  if (error) {
    console.error("[assessmentPlayerRepository] countCompletedAttempts:", error);
    throw new Error(error.message);
  }

  return count ?? 0;
}

// ─── startAttempt ─────────────────────────────────────────────────────────────

export async function startAttempt(
  assessmentId: string,
  employeeId: string,
  attemptNo: number,
  totalQuestions: number,
  totalMarks: number
): Promise<AssessmentAttempt> {
  const { data, error } = await supabase
    .from("assessment_attempts")
    .insert({
      assessment_id:        assessmentId,
      employee_id:          employeeId,
      attempt_no:           attemptNo,
      started_at:           new Date().toISOString(),
      status:               "in_progress",
      score:                0,
      percentage:           0,
      passed:               false,
      total_questions:      totalQuestions,
      answered_questions:   0,
      unanswered_questions: totalQuestions,
      skipped_questions:    0,
      total_marks:          totalMarks,
      obtained_marks:       0,
      time_taken_seconds:   0,
      browser_locked:       false,
      tab_switch_count:     0,
      auto_submitted:       false,
      ip_address:           null,
      device_info:          null,
      completed_at:         null,
      submitted_at:         null,
    })
    .select()
    .single();

  if (error) {
    console.error("[assessmentPlayerRepository] startAttempt:", error);
    throw new Error(error.message);
  }

  return data;
}

// ─── loadExistingAnswers ──────────────────────────────────────────────────────

export async function loadExistingAnswers(
  attemptId: string
): Promise<AssessmentAnswer[]> {
  const { data, error } = await supabase
    .from("assessment_answers")
    .select("*")
    .eq("attempt_id", attemptId);

  if (error) {
    console.error("[assessmentPlayerRepository] loadExistingAnswers:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

// ─── saveAnswer ───────────────────────────────────────────────────────────────
// Upserts on (attempt_id, question_id) — never creates duplicate rows.
// Writes only fields that exist in assessment_answers.

export async function saveAnswer(
  payload: SaveAnswerPayload
): Promise<AssessmentAnswer> {
  const { data, error } = await supabase
    .from("assessment_answers")
    .upsert(
      {
        attempt_id:          payload.attemptId,
        question_id:         payload.questionId,
        selected_option_ids: payload.selectedOptionIds,
        answer_text:         payload.textAnswer,
        time_taken_seconds:  payload.timeTakenSeconds,
        answered_at:         new Date().toISOString(),
      },
      { onConflict: "attempt_id,question_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("[assessmentPlayerRepository] saveAnswer:", error);
    throw new Error(error.message);
  }

  return data;
}

// ─── submitAssessment ─────────────────────────────────────────────────────────
// Receives pre-calculated counts from the service layer.
// Writes all terminal fields in a single update.

export async function submitAssessment(
  payload: SubmitAssessmentPayload
): Promise<AssessmentAttempt> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("assessment_attempts")
    .update({
      status:               payload.status,
      submitted_at:         now,
      completed_at:         now,
      time_taken_seconds:   payload.timeTakenSeconds,
      auto_submitted:       payload.autoSubmitted,
      answered_questions:   payload.answeredQuestions,
      unanswered_questions: payload.unansweredQuestions,
      skipped_questions:    payload.skippedQuestions,
    })
    .eq("id", payload.attemptId)
    .select()
    .single();

  if (error) {
    console.error("[assessmentPlayerRepository] submitAssessment:", error);
    throw new Error(error.message);
  }

  return data;
}
