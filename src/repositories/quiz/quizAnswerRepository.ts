import { supabaseQuizPlayer } from "../../lib/supabaseQuizPlayer";
import type { PublicQuizQuestion, PublicQuizQuestionOption, SubmitAnswerResult } from "../../types/quiz";

interface RawQuestionOptionRow {
  question_id: string;
  question_text: string;
  type: "mcq" | "truefalse";
  timer_seconds: number;
  question_index: number;
  total_questions: number;
  option_id: string;
  option_text: string;
  option_order: number;
}

/** Correctness-free — only ever shows the CURRENT question, via a SECURITY DEFINER RPC. */
export async function getCurrentQuestion(sessionId: string): Promise<PublicQuizQuestion | null> {
  const { data, error } = await supabaseQuizPlayer.rpc("get_current_quiz_question", { p_session_id: sessionId });

  if (error) {
    console.error("[quizAnswerRepository] getCurrentQuestion:", error);
    throw new Error(error.message);
  }

  const rows = (data as RawQuestionOptionRow[] | null) ?? [];
  if (rows.length === 0) return null;

  const options: PublicQuizQuestionOption[] = rows
    .map((r) => ({ option_id: r.option_id, option_text: r.option_text, option_order: r.option_order }))
    .sort((a, b) => a.option_order - b.option_order);

  const first = rows[0];
  return {
    question_id: first.question_id,
    question_text: first.question_text,
    type: first.type,
    timer_seconds: first.timer_seconds,
    question_index: first.question_index,
    total_questions: first.total_questions,
    options,
  };
}

/** Correctness is computed server-side — the client never decides whether its own answer was right. */
export async function submitAnswer(
  sessionId: string,
  questionId: string,
  optionId: string | null,
  responseTimeMs: number
): Promise<SubmitAnswerResult> {
  const { data, error } = await supabaseQuizPlayer.rpc("submit_quiz_answer", {
    p_session_id: sessionId,
    p_question_id: questionId,
    p_option_id: optionId,
    p_response_time_ms: responseTimeMs,
  });

  if (error) {
    console.error("[quizAnswerRepository] submitAnswer:", error);
    throw new Error(error.message);
  }

  const row = (data as SubmitAnswerResult[] | null)?.[0];
  if (!row) throw new Error("Could not submit your answer.");
  return row;
}
