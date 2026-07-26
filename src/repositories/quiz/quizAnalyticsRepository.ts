import { supabaseQuiz } from "../../lib/supabaseQuiz";
import { getQuizWithQuestions } from "./quizRepository";
import type { AnswerDistributionQuestion, QuizSessionResultRow } from "../../types/quiz";

/** Per-question, per-option vote counts for one ended session — the host already has RLS access to every answer in their own company's sessions. */
export async function getAnswerDistribution(sessionId: string, quizId: string): Promise<AnswerDistributionQuestion[]> {
  const [quiz, answersRes] = await Promise.all([
    getQuizWithQuestions(quizId),
    supabaseQuiz.from("quiz_answers").select("question_id, selected_option_id").eq("session_id", sessionId),
  ]);

  if (answersRes.error) {
    console.error("[quizAnalyticsRepository] getAnswerDistribution:", answersRes.error);
    throw new Error(answersRes.error.message);
  }
  if (!quiz) return [];

  const answers = answersRes.data ?? [];

  return quiz.questions
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((q) => {
      const counts = new Map<string, number>();
      let totalAnswered = 0;
      for (const a of answers) {
        if (a.question_id !== q.id) continue;
        totalAnswered += 1;
        if (a.selected_option_id) {
          counts.set(a.selected_option_id, (counts.get(a.selected_option_id) ?? 0) + 1);
        }
      }
      const options = q.options
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .map((o) => ({
          option_id: o.id,
          option_text: o.option_text,
          is_correct: o.is_correct,
          count: counts.get(o.id) ?? 0,
        }));
      return { question_id: q.id, question_text: q.question_text, display_order: q.display_order, options, totalAnswered };
    });
}

/** Company-wide result rows for exports/performance table, optionally bounded by ended_at date range (inclusive). */
export async function getCompanySessionResults(
  companyId: string,
  fromIso?: string,
  toIso?: string
): Promise<QuizSessionResultRow[]> {
  let query = supabaseQuiz.from("quiz_session_results").select("*").eq("company_id", companyId).not("ended_at", "is", null);

  if (fromIso) query = query.gte("ended_at", fromIso);
  if (toIso) query = query.lte("ended_at", toIso);

  const { data, error } = await query.order("ended_at", { ascending: false });

  if (error) {
    console.error("[quizAnalyticsRepository] getCompanySessionResults:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}
