// Admin side of Exams - same supabaseQuiz identity as the rest of the Live
// Quiz admin surface. Every time value is stamped by the database.

import { supabaseQuiz } from "../../lib/supabaseQuiz";
import type {
  ExamSession, ExamSessionAdmin, ExamParticipantAdmin, ExamResultRow, ExamDetailRow, ExamQuestionStat,
} from "../../types/exam";

function fail(label: string, error: { message: string }): never {
  console.error(`[examAdminRepository] ${label}:`, error);
  throw new Error(error.message);
}

export interface ExamStartOptions {
  durationSeconds: number;
  startInSeconds?: number | null;
  startAt?: Date | null;
}

export async function createExamSession(quizId: string, options: ExamStartOptions): Promise<ExamSession> {
  const { data, error } = await supabaseQuiz.rpc("create_exam_session", {
    p_quiz_id: quizId,
    p_duration_seconds: options.durationSeconds,
    p_start_in_seconds: options.startInSeconds ?? null,
    p_start_at: options.startAt ? options.startAt.toISOString() : null,
  });
  if (error) fail("createExamSession", error);
  const row = (data as ExamSession[] | null)?.[0];
  if (!row) throw new Error("Could not start the exam.");
  return row;
}

export async function startExamNow(sessionId: string): Promise<void> {
  const { error } = await supabaseQuiz.rpc("start_exam_now", { p_session_id: sessionId });
  if (error) fail("startExamNow", error);
}

export async function extendExamSession(sessionId: string, addSeconds: number): Promise<void> {
  const { error } = await supabaseQuiz.rpc("extend_exam_session", { p_session_id: sessionId, p_add_seconds: addSeconds });
  if (error) fail("extendExamSession", error);
}

export async function endExamSession(sessionId: string): Promise<void> {
  const { error } = await supabaseQuiz.rpc("end_exam_session", { p_session_id: sessionId });
  if (error) fail("endExamSession", error);
}

export async function releaseExamResults(sessionId: string, release: boolean): Promise<void> {
  const { error } = await supabaseQuiz.rpc("release_exam_results", { p_session_id: sessionId, p_release: release });
  if (error) fail("releaseExamResults", error);
}

export async function getExamSessionAdmin(sessionId: string): Promise<ExamSessionAdmin> {
  const { data, error } = await supabaseQuiz.rpc("get_exam_session_admin", { p_session_id: sessionId });
  if (error) fail("getExamSessionAdmin", error);
  const row = (data as ExamSessionAdmin[] | null)?.[0];
  if (!row) throw new Error("Exam not found.");
  return row;
}

export async function getExamParticipantsAdmin(sessionId: string): Promise<ExamParticipantAdmin[]> {
  const { data, error } = await supabaseQuiz.rpc("get_exam_participants_admin", { p_session_id: sessionId });
  if (error) fail("getExamParticipantsAdmin", error);
  return (data as ExamParticipantAdmin[] | null) ?? [];
}

export async function getExamResults(sessionId: string): Promise<ExamResultRow[]> {
  const { data, error } = await supabaseQuiz.rpc("get_exam_results", { p_session_id: sessionId });
  if (error) fail("getExamResults", error);
  return ((data as ExamResultRow[] | null) ?? []).map((r) => ({
    ...r,
    auto_marks: Number(r.auto_marks),
    manual_marks: Number(r.manual_marks),
    possible_marks: Number(r.possible_marks),
  }));
}

export async function getExamParticipantDetail(participantId: string): Promise<ExamDetailRow[]> {
  const { data, error } = await supabaseQuiz.rpc("get_exam_participant_detail", { p_participant_id: participantId });
  if (error) fail("getExamParticipantDetail", error);
  return ((data as ExamDetailRow[] | null) ?? []).map((r) => ({
    ...r,
    marks_awarded: r.marks_awarded === null ? null : Number(r.marks_awarded),
    click_x: r.click_x === null ? null : Number(r.click_x),
    click_y: r.click_y === null ? null : Number(r.click_y),
  }));
}

export async function gradeExamAnswer(answerId: string, marks: number, comment: string): Promise<void> {
  const { error } = await supabaseQuiz.rpc("grade_exam_answer", { p_answer_id: answerId, p_marks: marks, p_comment: comment });
  if (error) fail("gradeExamAnswer", error);
}

export async function getExamQuestionStats(sessionId: string): Promise<ExamQuestionStat[]> {
  const { data, error } = await supabaseQuiz.rpc("get_exam_question_stats", { p_session_id: sessionId });
  if (error) fail("getExamQuestionStats", error);
  return (data as ExamQuestionStat[] | null) ?? [];
}

export async function getExamSessionFolder(sessionId: string): Promise<string | null> {
  const { data, error } = await supabaseQuiz.rpc("get_exam_session_folder", { p_session_id: sessionId });
  if (error) fail("getExamSessionFolder", error);
  return (data as string | null) ?? null;
}

export async function moveExamSessionToFolder(sessionId: string, folderId: string | null): Promise<void> {
  const { error } = await supabaseQuiz.rpc("move_exam_session_to_folder", { p_session_id: sessionId, p_folder_id: folderId });
  if (error) fail("moveExamSessionToFolder", error);
}

export async function listExamSessions(quizId: string): Promise<ExamSession[]> {
  const { data, error } = await supabaseQuiz
    .from("exam_sessions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) fail("listExamSessions", error);
  return data ?? [];
}

/** Photos are in a private bucket - the admin views them through short-lived signed links. */
export async function signedPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabaseQuiz.storage.from("exam-answers").createSignedUrls(paths, 3600);
  if (error) fail("signedPhotoUrls", error);
  const out: Record<string, string> = {};
  for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  return out;
}
