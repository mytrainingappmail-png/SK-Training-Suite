// Final Result storage — frozen copies of ended sessions (see migration 20261009100000). Independent of
// quiz_sessions: deleting a session never touches these, and deleting one of these never touches a session.

import { supabaseQuiz } from "../../lib/supabaseQuiz";
import type { QuizFinalResult, QuizSession, QuizSessionResultRow, AnswerDistributionQuestion } from "../../types/quiz";

export async function listFinalResults(companyId: string): Promise<QuizFinalResult[]> {
  const { data, error } = await supabaseQuiz
    .from("quiz_final_results")
    .select("*")
    .eq("company_id", companyId)
    .order("ended_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("[quizFinalResultRepository] listFinalResults:", error);
    throw new Error(error.message);
  }
  return (data ?? []) as QuizFinalResult[];
}

/** Which sessions already have a saved copy, and in which folder — drives the "saved" tag in Results. */
export async function listSavedSessionFolders(companyId: string): Promise<Map<string, string>> {
  const { data, error } = await supabaseQuiz
    .from("quiz_final_results")
    .select("source_session_id, folder_id")
    .eq("company_id", companyId)
    .not("source_session_id", "is", null);

  if (error) {
    console.error("[quizFinalResultRepository] listSavedSessionFolders:", error);
    throw new Error(error.message);
  }
  return new Map((data ?? []).map((r) => [r.source_session_id as string, r.folder_id as string]));
}

/** Saves (or refreshes / re-files) the frozen copy of one session. */
export async function saveSessionToFinalResult(
  companyId: string,
  savedBy: string | null,
  session: QuizSession,
  rows: QuizSessionResultRow[],
  distribution: AnswerDistributionQuestion[],
  folderId: string
): Promise<void> {
  const first = rows[0];
  const { data: existing, error: findError } = await supabaseQuiz
    .from("quiz_final_results")
    .select("id")
    .eq("company_id", companyId)
    .eq("source_session_id", session.id)
    .maybeSingle();
  if (findError) {
    console.error("[quizFinalResultRepository] saveSessionToFinalResult (find):", findError);
    throw new Error(findError.message);
  }

  const payload = {
    company_id: companyId,
    folder_id: folderId,
    source_session_id: session.id,
    quiz_id: session.quiz_id,
    quiz_title: first?.quiz_title ?? "Quiz session",
    started_at: session.started_at,
    ended_at: session.ended_at,
    passing_score_pct: first?.passing_score_pct ?? null,
    improve_threshold_pct: first?.improve_threshold_pct ?? null,
    rows,
    distribution,
    saved_by: savedBy,
    saved_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await supabaseQuiz.from("quiz_final_results").update(payload).eq("id", existing.id)
    : await supabaseQuiz.from("quiz_final_results").insert(payload);

  if (error) {
    console.error("[quizFinalResultRepository] saveSessionToFinalResult:", error);
    throw new Error(error.message);
  }
}

export async function moveFinalResultToFolder(id: string, folderId: string): Promise<void> {
  const { error } = await supabaseQuiz.from("quiz_final_results").update({ folder_id: folderId }).eq("id", id);
  if (error) {
    console.error("[quizFinalResultRepository] moveFinalResultToFolder:", error);
    throw new Error(error.message);
  }
}

export async function deleteFinalResult(id: string): Promise<void> {
  const { error } = await supabaseQuiz.from("quiz_final_results").delete().eq("id", id);
  if (error) {
    console.error("[quizFinalResultRepository] deleteFinalResult:", error);
    throw new Error(error.message);
  }
}
