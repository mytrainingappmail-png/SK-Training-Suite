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
  if (count && count > 0) {
    throw new Error(`This folder still has ${count} session${count === 1 ? "" : "s"} in it. Move them out first.`);
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
