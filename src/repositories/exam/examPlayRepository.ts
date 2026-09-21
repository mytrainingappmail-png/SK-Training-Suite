// Employee side of Exams. Uses the same throwaway participant identity as the
// Live Quiz player (supabaseQuizPlayer) - see quizPlayService's
// ensureParticipantSession.

import { supabaseQuizPlayer } from "../../lib/supabaseQuizPlayer";
import type { ExamState, ExamPaperQuestion, ExamAnswerDraft, MyExamResultRow } from "../../types/exam";

function fail(label: string, error: { message: string }): never {
  console.error(`[examPlayRepository] ${label}:`, error);
  throw new Error(error.message);
}

export async function joinExam(pin: string, displayName: string): Promise<{ sessionId: string; participantId: string }> {
  const { data, error } = await supabaseQuizPlayer.rpc("join_exam_session", { p_pin: pin, p_display_name: displayName });
  if (error) fail("joinExam", error);
  const row = (data as { exam_session_id: string; exam_participant_id: string }[] | null)?.[0];
  if (!row) throw new Error("Could not join the exam.");
  return { sessionId: row.exam_session_id, participantId: row.exam_participant_id };
}

export async function getExamState(sessionId: string): Promise<ExamState> {
  const { data, error } = await supabaseQuizPlayer.rpc("get_exam_state", { p_session_id: sessionId });
  if (error) fail("getExamState", error);
  const row = (data as ExamState[] | null)?.[0];
  if (!row) throw new Error("Exam not found.");
  return row;
}

interface PaperRow {
  question_position: number;
  question_id: string;
  question_text: string;
  type: ExamPaperQuestion["type"];
  marks: number;
  image_url: string | null;
  option_id: string | null;
  option_text: string | null;
  option_order: number | null;
  saved_selected_option_id: string | null;
  saved_click_x: number | null;
  saved_click_y: number | null;
  saved_text: string | null;
  saved_image_paths: string[] | null;
  saved_flagged: boolean;
}

export async function getExamPaper(sessionId: string): Promise<ExamPaperQuestion[]> {
  const { data, error } = await supabaseQuizPlayer.rpc("get_exam_paper", { p_session_id: sessionId });
  if (error) fail("getExamPaper", error);
  const byId = new Map<string, ExamPaperQuestion>();
  for (const r of (data as PaperRow[] | null) ?? []) {
    let q = byId.get(r.question_id);
    if (!q) {
      q = {
        position: r.question_position,
        question_id: r.question_id,
        question_text: r.question_text,
        type: r.type,
        marks: r.marks,
        image_url: r.image_url,
        options: [],
        saved: {
          selected_option_id: r.saved_selected_option_id,
          click_x: r.saved_click_x === null ? null : Number(r.saved_click_x),
          click_y: r.saved_click_y === null ? null : Number(r.saved_click_y),
          text: r.saved_text ?? "",
          image_paths: r.saved_image_paths ?? [],
          flagged: r.saved_flagged,
        },
      };
      byId.set(r.question_id, q);
    }
    if (r.option_id && r.option_text) q.options.push({ option_id: r.option_id, option_text: r.option_text });
  }
  return [...byId.values()].sort((a, b) => a.position - b.position);
}

export async function saveExamAnswer(sessionId: string, questionId: string, draft: ExamAnswerDraft): Promise<void> {
  const { error } = await supabaseQuizPlayer.rpc("save_exam_answer", {
    p_session_id: sessionId,
    p_question_id: questionId,
    p_selected_option_id: draft.selected_option_id,
    p_click_x: draft.click_x,
    p_click_y: draft.click_y,
    p_text_answer: draft.text,
    p_image_paths: draft.image_paths,
    p_flagged: draft.flagged,
  });
  if (error) fail("saveExamAnswer", error);
}

export async function submitExam(sessionId: string, reason: "manual" | "timeout"): Promise<void> {
  const { error } = await supabaseQuizPlayer.rpc("submit_exam", { p_session_id: sessionId, p_reason: reason });
  if (error) fail("submitExam", error);
}

export async function flagExamTabSwitch(sessionId: string): Promise<void> {
  await supabaseQuizPlayer.rpc("flag_exam_tab_switch", { p_session_id: sessionId });
}

export async function getMyExamResult(sessionId: string): Promise<MyExamResultRow[]> {
  const { data, error } = await supabaseQuizPlayer.rpc("get_my_exam_result", { p_session_id: sessionId });
  if (error) fail("getMyExamResult", error);
  return ((data as MyExamResultRow[] | null) ?? []).map((r) => ({ ...r, marks_awarded: r.marks_awarded === null ? null : Number(r.marks_awarded) }));
}

// ── Photos ──────────────────────────────────────────────────────────────

const BUCKET = "exam-answers";
const MAX_SIDE = 1600;

/** Phone cameras produce 4-12 MB photos - shrink to a readable ~300 KB JPEG before uploading (weak mobile data). */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the photo.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  if (!blob) throw new Error("Could not process the photo.");
  return blob;
}

export async function uploadAnswerPhoto(sessionId: string, participantId: string, questionId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a photo.");
  const blob = await compressImage(file);
  const path = `${sessionId}/${participantId}/${questionId}-${Date.now()}.jpg`;
  const { error } = await supabaseQuizPlayer.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) fail("uploadAnswerPhoto", error);
  return path;
}

export async function removeAnswerPhoto(path: string): Promise<void> {
  await supabaseQuizPlayer.storage.from(BUCKET).remove([path]);
}

export async function signedOwnPhotoUrl(path: string): Promise<string | null> {
  const { data } = await supabaseQuizPlayer.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
