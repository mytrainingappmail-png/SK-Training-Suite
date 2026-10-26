// "Open test link": trainees start a quiz / exam themselves with a link (no PIN), each with their own timer.
// Admin side uses the quiz-admin client; the trainee side uses the participant client (anonymous sign-in).

import { supabaseQuiz } from "../../lib/supabaseQuiz";
import { supabaseQuizPlayer } from "../../lib/supabaseQuizPlayer";
import type { OpenTestAttempt, OpenTestInfo, OpenTestStart, QuizOpenLink } from "../../types/quiz";

function fail(label: string, error: { message: string }): never {
  console.error(`[quizOpenLinkRepository] ${label}:`, error);
  throw new Error(error.message);
}

export async function getOpenLink(quizId: string): Promise<QuizOpenLink | null> {
  const { data, error } = await supabaseQuiz.from("quiz_open_links").select("*").eq("quiz_id", quizId).maybeSingle();
  if (error) fail("getOpenLink", error);
  return data;
}

/** The test's link (made switched-off the first time it is looked at). */
export async function ensureOpenLink(companyId: string, quizId: string): Promise<QuizOpenLink> {
  const existing = await getOpenLink(quizId);
  if (existing) return existing;
  const { data, error } = await supabaseQuiz.from("quiz_open_links").insert({ company_id: companyId, quiz_id: quizId }).select().single();
  if (error) {
    // two tabs opened it at the same moment: the other one won, use that
    const again = await getOpenLink(quizId);
    if (again) return again;
    fail("ensureOpenLink", error);
  }
  return data;
}

export type OpenLinkPatch = Partial<Pick<QuizOpenLink, "enabled" | "opens_at" | "closes_at" | "max_attempts" | "release_results">>;

export async function updateOpenLink(id: string, patch: OpenLinkPatch): Promise<QuizOpenLink> {
  const { data, error } = await supabaseQuiz.from("quiz_open_links").update(patch).eq("id", id).select().single();
  if (error) fail("updateOpenLink", error);
  return data;
}

export async function listOpenTestAttempts(linkId: string): Promise<OpenTestAttempt[]> {
  const { data, error } = await supabaseQuiz.rpc("get_open_test_attempts", { p_link_id: linkId });
  if (error) fail("listOpenTestAttempts", error);
  return (data ?? []) as OpenTestAttempt[];
}

/** Closes abandoned attempts so they finish and show up in results. Housekeeping: never throws. */
export async function sweepOpenTests(linkId?: string): Promise<void> {
  try {
    await supabaseQuiz.rpc("open_test_sweep", { p_link_id: linkId ?? null });
  } catch {
    /* housekeeping only */
  }
}

/** What the trainee sees on the link page (works before signing in). */
export async function getOpenTestInfo(token: string): Promise<OpenTestInfo | null> {
  const { data, error } = await supabaseQuizPlayer.rpc("get_open_test_info", { p_token: token });
  if (error) {
    console.error("[quizOpenLinkRepository] getOpenTestInfo:", error);
    return null;
  }
  return ((data ?? []) as OpenTestInfo[])[0] ?? null;
}

/** Needs the participant's anonymous sign-in first (ensureParticipantSession). */
export async function startOpenTest(token: string, name: string): Promise<OpenTestStart> {
  const { data, error } = await supabaseQuizPlayer.rpc("start_open_test", { p_token: token, p_name: name });
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as OpenTestStart[])[0];
  if (!row) throw new Error("Could not start the test. Please try again.");
  return row;
}
