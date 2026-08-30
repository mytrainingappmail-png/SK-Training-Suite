import { supabaseQuizPlayer } from "../../lib/supabaseQuizPlayer";
import { supabaseQuiz } from "../../lib/supabaseQuiz";
import type { QuizCertificate } from "../../types/quiz";

/** Admin-only — the candidate never uploads their own photo. RLS
 * (quiz_certificates_admin_update) is the real gate; this just writes
 * the URL onto the already-issued certificate row. */
export async function updateCertificatePhoto(certificateId: string, photoUrl: string | null): Promise<void> {
  const { error } = await supabaseQuiz.from("quiz_certificates").update({ candidate_photo_url: photoUrl }).eq("id", certificateId);
  if (error) {
    console.error("[quizCertificateRepository] updateCertificatePhoto:", error);
    throw new Error(error.message);
  }
}

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

/** Admin-triggered issuance for any passing participant in one of the admin's own sessions — used from the host's live TV screen so trainees don't need their own device to get a certificate. */
export async function issueCertificateForParticipant(participantId: string): Promise<QuizCertificate> {
  const { data, error } = await supabaseQuiz.rpc("issue_certificate_for_participant", { p_participant_id: participantId });

  if (error) {
    console.error("[quizCertificateRepository] issueCertificateForParticipant:", error);
    throw new Error(error.message);
  }

  const row = (data as QuizCertificate[] | null)?.[0];
  if (!row) throw new Error("Could not issue a certificate.");
  return row;
}
