import { supabaseQuiz } from "../../lib/supabaseQuiz";

export interface DashboardCertificateRow {
  id: string;
  candidate_name: string;
  quiz_title: string;
  issued_at: string;
  session_id: string;
}

/** Company-wide certificate list for the "Certificates Generated" KPI, trend, and recent-activity panel. */
export async function listCertificatesForCompany(companyId: string): Promise<DashboardCertificateRow[]> {
  const { data, error } = await supabaseQuiz
    .from("quiz_certificates")
    .select("id, candidate_name, quiz_title, issued_at, session_id")
    .eq("company_id", companyId)
    .order("issued_at", { ascending: false });

  if (error) {
    console.error("[quizDashboardRepository] listCertificatesForCompany:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

/** Total question count across every quiz in the company — the "Questions in Question Bank" KPI. */
export async function countQuestionBankSize(companyId: string): Promise<number> {
  const { count, error } = await supabaseQuiz
    .from("quiz_questions")
    .select("id, quizzes!inner(company_id)", { count: "exact", head: true })
    .eq("quizzes.company_id", companyId);

  if (error) {
    console.error("[quizDashboardRepository] countQuestionBankSize:", error);
    throw new Error(error.message);
  }

  return count ?? 0;
}

export interface ParticipantJoinRow {
  participant_id: string;
  session_id: string;
  joined_at: string;
}

/** Every participant's actual join timestamp, company-wide — quiz_session_results has no joined_at, so "today's participants" and the participation trend need this separately. */
export async function listParticipantJoinTimes(companyId: string): Promise<ParticipantJoinRow[]> {
  const { data, error } = await supabaseQuiz
    .from("quiz_participants")
    .select("id, session_id, joined_at, quiz_sessions!inner(company_id)")
    .eq("quiz_sessions.company_id", companyId);

  if (error) {
    console.error("[quizDashboardRepository] listParticipantJoinTimes:", error);
    throw new Error(error.message);
  }

  return (data ?? []).map((r) => ({ participant_id: r.id as string, session_id: r.session_id as string, joined_at: r.joined_at as string }));
}

/** Raw response times (ms) for every answer in the company, optionally date-bounded — used for the "Average Response Time" KPI and any response-time analysis. */
export async function listResponseTimes(companyId: string, fromIso?: string, toIso?: string): Promise<number[]> {
  let query = supabaseQuiz
    .from("quiz_answers")
    .select("response_time_ms, quiz_sessions!inner(company_id)")
    .eq("quiz_sessions.company_id", companyId);

  if (fromIso) query = query.gte("answered_at", fromIso);
  if (toIso) query = query.lte("answered_at", toIso);

  const { data, error } = await query;

  if (error) {
    console.error("[quizDashboardRepository] listResponseTimes:", error);
    throw new Error(error.message);
  }

  return (data ?? []).map((r) => r.response_time_ms as number).filter((n) => typeof n === "number");
}
