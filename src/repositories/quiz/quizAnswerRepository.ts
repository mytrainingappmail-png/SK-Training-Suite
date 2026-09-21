import { supabaseQuizPlayer } from "../../lib/supabaseQuizPlayer";
import type { PublicQuizQuestion, PublicQuizQuestionOption, SubmitAnswerResult, SubmitHotspotAnswerResult, AnswerReviewOptionRow, AnswerReviewQuestion, MyQuizResult, QuizQuestionType } from "../../types/quiz";

interface RawQuestionOptionRow {
  question_id: string;
  question_text: string;
  type: QuizQuestionType;
  timer_seconds: number;
  question_index: number;
  total_questions: number;
  option_id: string | null;
  option_text: string | null;
  option_order: number | null;
  image_url: string | null;
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

  // A hotspot question has no options rows — the RPC's left join still
  // returns exactly one row for it, with option_id/option_text/option_order
  // all null, which this filter drops rather than rendering a phantom option.
  const options: PublicQuizQuestionOption[] = rows
    .filter((r) => r.option_id !== null)
    .map((r) => ({ option_id: r.option_id as string, option_text: r.option_text as string, option_order: r.option_order as number }))
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
    image_url: first.image_url,
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

/** Hotspot counterpart to submitAnswer() — click_x/click_y are a percent (0-100) of the image's rendered width/height, computed by the caller from wherever the trainee tapped, or both null if the timer ran out with no tap. */
export async function submitHotspotAnswer(
  sessionId: string,
  questionId: string,
  clickX: number | null,
  clickY: number | null,
  responseTimeMs: number
): Promise<SubmitHotspotAnswerResult> {
  const { data, error } = await supabaseQuizPlayer.rpc("submit_quiz_hotspot_answer", {
    p_session_id: sessionId,
    p_question_id: questionId,
    p_click_x: clickX,
    p_click_y: clickY,
    p_response_time_ms: responseTimeMs,
  });

  if (error) {
    console.error("[quizAnswerRepository] submitHotspotAnswer:", error);
    throw new Error(error.message);
  }

  const row = (data as SubmitHotspotAnswerResult[] | null)?.[0];
  if (!row) throw new Error("Could not submit your answer.");
  return row;
}

/** Only available once the session has ended — groups the flat option/hotspot rows into one entry per question. */
export async function getMyAnswerReview(sessionId: string): Promise<AnswerReviewQuestion[]> {
  const { data, error } = await supabaseQuizPlayer.rpc("get_my_answer_review", { p_session_id: sessionId });

  if (error) {
    console.error("[quizAnswerRepository] getMyAnswerReview:", error);
    throw new Error(error.message);
  }

  const rows = (data as AnswerReviewOptionRow[] | null) ?? [];
  const byIndex = new Map<number, AnswerReviewQuestion>();

  for (const r of rows) {
    if (!byIndex.has(r.question_index)) {
      byIndex.set(r.question_index, {
        question_index: r.question_index,
        question_text: r.question_text,
        explanation: r.explanation,
        type: r.type,
        options: [],
        hotspot:
          r.type === "hotspot"
            ? {
                image_url: r.image_url,
                target_x: r.target_x,
                target_y: r.target_y,
                target_radius: r.target_radius,
                click_x: r.click_x,
                click_y: r.click_y,
                is_correct: r.hotspot_is_correct,
                hotspot_zones: r.hotspot_zones,
              }
            : null,
      });
    }
    if (r.option_id !== null) {
      byIndex.get(r.question_index)!.options.push({
        option_id: r.option_id,
        option_text: r.option_text as string,
        is_correct: r.is_correct as boolean,
        was_chosen: r.was_chosen as boolean,
      });
    }
  }

  return [...byIndex.values()].sort((a, b) => a.question_index - b.question_index);
}

/** The calling participant's own grade for a finished session — used to pick the admin-configured Champion/Improve/Fail message. */
export async function getMyResult(sessionId: string): Promise<MyQuizResult | null> {
  const { data, error } = await supabaseQuizPlayer.rpc("get_my_result", { p_session_id: sessionId });

  if (error) {
    console.error("[quizAnswerRepository] getMyResult:", error);
    return null;
  }

  return (data as MyQuizResult[] | null)?.[0] ?? null;
}

/** Fire-and-forget — records that the trainee's browser tab was backgrounded/switched during a live quiz. */
export async function flagTabSwitch(sessionId: string): Promise<void> {
  const { error } = await supabaseQuizPlayer.rpc("flag_tab_switch", { p_session_id: sessionId });
  if (error) {
    console.error("[quizAnswerRepository] flagTabSwitch:", error);
  }
}
