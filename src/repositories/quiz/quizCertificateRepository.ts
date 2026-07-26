import { supabaseQuizPlayer } from "../../lib/supabaseQuizPlayer";
import type { QuizCertificate } from "../../types/quiz";

/** Issues (or returns the already-issued) certificate for the calling participant — correctness/passing is verified server-side. */
export async function issueMyCertificate(sessionId: string): Promise<QuizCertificate> {
  const { data, error } = await supabaseQuizPlayer.rpc("issue_my_certificate", { p_session_id: sessionId });

  if (error) {
    console.error("[quizCertificateRepository] issueMyCertificate:", error);
    throw new Error(error.message);
  }

  const row = (data as QuizCertificate[] | null)?.[0];
  if (!row) throw new Error("Could not issue a certificate.");
  return row;
}
