import { supabaseQuiz } from "../../lib/supabaseQuiz";
import type { Quiz, QuizQuestion, QuizWithQuestions } from "../../types/quiz";

export interface QuizForm {
  title: string;
  description: string;
  category_id: string | null;
  difficulty: Quiz["difficulty"];
  default_timer_seconds: number;
  passing_score_pct: number;
  improve_threshold_pct: number;
  shuffle_options: boolean;
}

export interface QuestionOptionForm {
  option_text: string;
  is_correct: boolean;
}

export interface QuestionForm {
  question_text: string;
  type: QuizQuestion["type"];
  timer_seconds: number | null;
  marks: number;
  explanation: string;
  options: QuestionOptionForm[];
}

export async function listQuizzes(companyId: string): Promise<Quiz[]> {
  const { data, error } = await supabaseQuiz
    .from("quizzes")
    .select("*")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[quizRepository] listQuizzes:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getQuizWithQuestions(quizId: string): Promise<QuizWithQuestions | null> {
  const { data: quiz, error: quizError } = await supabaseQuiz
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .maybeSingle();

  if (quizError) {
    console.error("[quizRepository] getQuizWithQuestions (quiz):", quizError);
    throw new Error(quizError.message);
  }
  if (!quiz) return null;

  const { data: questions, error: qError } = await supabaseQuiz
    .from("quiz_questions")
    .select("*, options:quiz_question_options(*)")
    .eq("quiz_id", quizId)
    .order("display_order", { ascending: true });

  if (qError) {
    console.error("[quizRepository] getQuizWithQuestions (questions):", qError);
    throw new Error(qError.message);
  }

  const sortedQuestions = (questions ?? []).map((q) => ({
    ...q,
    options: (q.options ?? []).slice().sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order),
  }));

  return { ...quiz, questions: sortedQuestions };
}

export async function createQuiz(companyId: string, createdBy: string | null, form: QuizForm): Promise<Quiz> {
  const { data, error } = await supabaseQuiz
    .from("quizzes")
    .insert({ ...form, company_id: companyId, created_by: createdBy })
    .select()
    .single();

  if (error) {
    console.error("[quizRepository] createQuiz:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateQuizMeta(quizId: string, form: Partial<QuizForm>): Promise<Quiz> {
  const { data, error } = await supabaseQuiz
    .from("quizzes")
    .update({ ...form, updated_at: new Date().toISOString() })
    .eq("id", quizId)
    .select()
    .single();

  if (error) {
    console.error("[quizRepository] updateQuizMeta:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function setQuizStatus(quizId: string, status: Quiz["status"]): Promise<void> {
  const { error } = await supabaseQuiz
    .from("quizzes")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", quizId);

  if (error) {
    console.error("[quizRepository] setQuizStatus:", error);
    throw new Error(error.message);
  }
}

export async function deleteQuiz(quizId: string): Promise<void> {
  const { error } = await supabaseQuiz.from("quizzes").delete().eq("id", quizId);

  if (error) {
    console.error("[quizRepository] deleteQuiz:", error);
    throw new Error(error.message);
  }
}

/** Replaces the whole question set for a quiz — matches the "edit in memory, save on publish" builder flow. */
export async function replaceQuestions(quizId: string, questions: QuestionForm[]): Promise<void> {
  const { error: delError } = await supabaseQuiz.from("quiz_questions").delete().eq("quiz_id", quizId);
  if (delError) {
    console.error("[quizRepository] replaceQuestions (delete):", delError);
    throw new Error(delError.message);
  }

  if (questions.length === 0) return;

  const { data: insertedQuestions, error: qError } = await supabaseQuiz
    .from("quiz_questions")
    .insert(
      questions.map((q, i) => ({
        quiz_id: quizId,
        question_text: q.question_text,
        type: q.type,
        timer_seconds: q.timer_seconds,
        marks: q.marks,
        explanation: q.explanation,
        display_order: i,
      }))
    )
    .select("id");

  if (qError) {
    console.error("[quizRepository] replaceQuestions (insert questions):", qError);
    throw new Error(qError.message);
  }

  const optionRows = (insertedQuestions ?? []).flatMap((row, qi) =>
    questions[qi].options.map((opt, oi) => ({
      question_id: row.id,
      option_text: opt.option_text,
      is_correct: opt.is_correct,
      display_order: oi,
    }))
  );

  if (optionRows.length === 0) return;

  const { error: oError } = await supabaseQuiz.from("quiz_question_options").insert(optionRows);
  if (oError) {
    console.error("[quizRepository] replaceQuestions (insert options):", oError);
    throw new Error(oError.message);
  }
}
