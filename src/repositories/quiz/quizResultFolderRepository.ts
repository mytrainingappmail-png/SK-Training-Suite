import { supabaseQuiz } from "../../lib/supabaseQuiz";
import type { QuizResultFolder } from "../../types/quiz";

export async function listFoldersForCompany(companyId: string): Promise<QuizResultFolder[]> {
  const { data, error } = await supabaseQuiz
    .from("quiz_result_folders")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[quizResultFolderRepository] listFoldersForCompany:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export interface FolderExamSession {
  id: string;
  folder_id: string;
  title: string;
  created_at: string;
  finished_at: string | null;
  joined: number;
}

/** Exam sessions filed into a batch folder - a folder holds Live Quiz sessions and Exam sessions side by side. */
export async function listFolderExamSessions(companyId: string): Promise<FolderExamSession[]> {
  const { data, error } = await supabaseQuiz
    .from("exam_sessions")
    .select("id, folder_id, created_at, finished_at, quizzes(title), exam_participants(count)")
    .eq("company_id", companyId)
    .not("folder_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[quizResultFolderRepository] listFolderExamSessions:", error);
    throw new Error(error.message);
  }

  return (data ?? []).map((r) => {
    const row = r as unknown as {
      id: string; folder_id: string; created_at: string; finished_at: string | null;
      quizzes: { title: string } | { title: string }[] | null;
      exam_participants: { count: number }[] | null;
    };
    const quiz = Array.isArray(row.quizzes) ? row.quizzes[0] : row.quizzes;
    return {
      id: row.id, folder_id: row.folder_id, created_at: row.created_at, finished_at: row.finished_at,
      title: quiz?.title ?? "Exam", joined: row.exam_participants?.[0]?.count ?? 0,
    };
  });
}

export async function removeExamSessionFromFolder(sessionId: string): Promise<void> {
  const { error } = await supabaseQuiz.rpc("move_exam_session_to_folder", { p_session_id: sessionId, p_folder_id: null });
  if (error) {
    console.error("[quizResultFolderRepository] removeExamSessionFromFolder:", error);
    throw new Error(error.message);
  }
}

export async function createFolder(companyId: string, name: string, createdBy: string | null): Promise<QuizResultFolder> {
  const { data, error } = await supabaseQuiz
    .from("quiz_result_folders")
    .insert({ company_id: companyId, name: name.trim(), created_by: createdBy })
    .select()
    .single();

  if (error) {
    console.error("[quizResultFolderRepository] createFolder:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function renameFolder(folderId: string, name: string): Promise<void> {
  const { error } = await supabaseQuiz
    .from("quiz_result_folders")
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq("id", folderId);

  if (error) {
    console.error("[quizResultFolderRepository] renameFolder:", error);
    throw new Error(error.message);
  }
}

/** Refuses to delete a folder that still holds sessions — move them out (or to another
 * folder) first, so a record can never be silently orphaned by a stray click. */
export async function deleteFolder(folderId: string): Promise<void> {
  const { count, error: countError } = await supabaseQuiz
    .from("quiz_sessions")
    .select("id", { count: "exact", head: true })
    .eq("folder_id", folderId);

  if (countError) {
    console.error("[quizResultFolderRepository] deleteFolder (count check):", countError);
    throw new Error(countError.message);
  }
  const { count: examCount, error: examCountError } = await supabaseQuiz
    .from("exam_sessions")
    .select("id", { count: "exact", head: true })
    .eq("folder_id", folderId);
  if (examCountError) {
    console.error("[quizResultFolderRepository] deleteFolder (exam count check):", examCountError);
    throw new Error(examCountError.message);
  }

  const total = (count ?? 0) + (examCount ?? 0);
  if (total > 0) {
    throw new Error(`This folder still has ${total} session${total === 1 ? "" : "s"} in it. Move them out first.`);
  }

  const { error } = await supabaseQuiz.from("quiz_result_folders").delete().eq("id", folderId);

  if (error) {
    console.error("[quizResultFolderRepository] deleteFolder:", error);
    throw new Error(error.message);
  }
}

/** Pass `folderId: null` to pull a session back out of whatever folder it's in. */
export async function moveSessionToFolder(sessionId: string, folderId: string | null): Promise<void> {
  const { error } = await supabaseQuiz.from("quiz_sessions").update({ folder_id: folderId }).eq("id", sessionId);

  if (error) {
    console.error("[quizResultFolderRepository] moveSessionToFolder:", error);
    throw new Error(error.message);
  }
}
