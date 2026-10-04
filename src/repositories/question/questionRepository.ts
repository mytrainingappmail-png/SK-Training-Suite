import { supabase } from "../../lib/supabase";
import type { Question } from "../../types/question";
import type { QuestionForm } from "../../types/question";
import type { QuestionOption } from "../../types/question";
import type { QuestionOptionForm } from "../../types/question";

// ─── Questions ────────────────────────────────────────────────────────────────

export async function getQuestions(): Promise<Question[]> {
  const { data, error } = await supabase
    .from("question_bank")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[questionRepository] getQuestions:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

// Just ids + codes — all the duplicate check needs (instead of downloading every question in full).
export async function getQuestionCodes(): Promise<{ id: string; question_code: string | null }[]> {
  const { data, error } = await supabase.from("question_bank").select("id, question_code");
  if (error) {
    console.error("[questionRepository] getQuestionCodes:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function getQuestionsByAssessment(assessmentId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from("question_bank")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("display_order", { ascending: true });
  if (error) {
    console.error("[questionRepository] getQuestionsByAssessment:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

/** Options of many questions in a few calls, grouped by question id. */
export async function getOptionsForQuestions(questionIds: string[]): Promise<Record<string, QuestionOption[]>> {
  const grouped: Record<string, QuestionOption[]> = Object.fromEntries(questionIds.map((id) => [id, []]));
  for (let i = 0; i < questionIds.length; i += 100) {
    const { data, error } = await supabase
      .from("question_options")
      .select("*")
      .in("question_id", questionIds.slice(i, i + 100))
      .order("display_order", { ascending: true });
    if (error) {
      console.error("[questionRepository] getOptionsForQuestions:", error);
      throw new Error(error.message);
    }
    for (const o of data ?? []) (grouped[o.question_id] ??= []).push(o);
  }
  return grouped;
}

export async function createQuestionsBulk(questions: QuestionForm[]): Promise<Question[]> {
  const { data, error } = await supabase.from("question_bank").insert(questions).select();
  if (error) {
    console.error("[questionRepository] createQuestionsBulk:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function createOptionsBulk(options: (QuestionOptionForm & { question_id: string })[]): Promise<void> {
  if (options.length === 0) return;
  const { error } = await supabase.from("question_options").insert(options);
  if (error) {
    console.error("[questionRepository] createOptionsBulk:", error);
    throw new Error(error.message);
  }
}

export async function getQuestionById(id: string): Promise<Question> {
  const { data, error } = await supabase
    .from("question_bank")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[questionRepository] getQuestionById:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createQuestion(
  question: QuestionForm
): Promise<Question> {
  const { data, error } = await supabase
    .from("question_bank")
    .insert(question)
    .select()
    .single();

  if (error) {
    console.error("[questionRepository] createQuestion:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateQuestion(
  id: string,
  question: Partial<QuestionForm>
): Promise<Question> {
  const { data, error } = await supabase
    .from("question_bank")
    .update(question)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[questionRepository] updateQuestion:", error);
    throw new Error(error.message);
  }

  return data;
}

/** Same marks for many questions in ONE call. */
export async function setMarksForQuestions(ids: string[], marks: number): Promise<void> {
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await supabase.from("question_bank").update({ marks }).in("id", ids.slice(i, i + 100));
    if (error) {
      console.error("[questionRepository] setMarksForQuestions:", error);
      throw new Error(error.message);
    }
  }
}

export async function deleteQuestion(id: string): Promise<void> {
  // Options are deleted via ON DELETE CASCADE on question_id FK in the DB.
  const { error } = await supabase
    .from("question_bank")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[questionRepository] deleteQuestion:", error);
    throw new Error(error.message);
  }
}

export async function toggleQuestionStatus(
  id: string,
  active: boolean
): Promise<Question> {
  const { data, error } = await supabase
    .from("question_bank")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[questionRepository] toggleQuestionStatus:", error);
    throw new Error(error.message);
  }

  return data;
}

// ─── Question Options ─────────────────────────────────────────────────────────

export async function getOptionsByQuestion(
  questionId: string
): Promise<QuestionOption[]> {
  const { data, error } = await supabase
    .from("question_options")
    .select("*")
    .eq("question_id", questionId)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[questionRepository] getOptionsByQuestion:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createOption(
  questionId: string,
  option: QuestionOptionForm
): Promise<QuestionOption> {
  const { data, error } = await supabase
    .from("question_options")
    .insert({ ...option, question_id: questionId })
    .select()
    .single();

  if (error) {
    console.error("[questionRepository] createOption:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteOptionsByQuestion(
  questionId: string
): Promise<void> {
  const { error } = await supabase
    .from("question_options")
    .delete()
    .eq("question_id", questionId);

  if (error) {
    console.error("[questionRepository] deleteOptionsByQuestion:", error);
    throw new Error(error.message);
  }
}
