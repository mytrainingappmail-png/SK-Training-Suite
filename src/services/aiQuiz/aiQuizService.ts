// Client side of the AI Quiz Maker (edge function generate-quiz-questions). Returns the questions only — nothing is
// saved; the caller puts them into the test editor for the trainer to review.

import { supabase } from "../../lib/supabase";

export interface AiQuestion { text: string; options: string[]; correct_index: number; explanation: string }
export type AiDifficulty = "easy" | "medium" | "hard" | "mixed";
export type AiLanguage = "english" | "hinglish";

export interface AiQuizRequest { content: string; count: number; difficulty: AiDifficulty; language: AiLanguage; extra?: string }

export async function generateQuizQuestions(req: AiQuizRequest): Promise<{ questions: AiQuestion[]; runsLeft: number }> {
  const { data, error } = await supabase.functions.invoke("generate-quiz-questions", { body: req });
  if (error) {
    let message = "Could not make questions right now. Please try again.";
    try {
      const body = await (error as { context?: Response }).context?.json();
      if (body?.error) message = body.error;
    } catch { /* keep the generic sentence */ }
    throw new Error(message);
  }
  return { questions: (data?.questions ?? []) as AiQuestion[], runsLeft: Number(data?.runs_left_today ?? 0) };
}
