// Client side of the AI Quiz Maker (edge function generate-quiz-questions). Returns the questions only — nothing is
// saved; the caller puts them into the test editor for the trainer to review.

import { supabase } from "../../lib/supabase";

export interface AiQuestion { text: string; options: string[]; correct_index: number; explanation: string }
export type AiDifficulty = "easy" | "medium" | "hard" | "mixed";

export interface AiQuizRequest { content: string; count: number; difficulty: AiDifficulty; extra?: string }

export async function generateQuizQuestions(req: AiQuizRequest): Promise<{ questions: AiQuestion[]; runsLeft: number }> {
  const { data, error } = await supabase.functions.invoke("generate-quiz-questions", { body: req });
  if (error) {
    let message = "Could not make questions right now. Please try again.";
    const res = (error as { context?: Response }).context;
    // the platform itself answers with its own wording when the function ran too long / was not signed in
    if (res?.status === 504 || res?.status === 546 || res?.status === 408) message = "The AI took too long to answer. Please try once more.";
    else if (res?.status === 401) message = "Your sign-in has expired. Please refresh the page and sign in again.";
    try {
      const body = await res?.json();
      if (body?.error) message = body.error;
    } catch { /* keep the sentence above */ }
    throw new Error(message);
  }
  return { questions: (data?.questions ?? []) as AiQuestion[], runsLeft: Number(data?.runs_left_today ?? 0) };
}
