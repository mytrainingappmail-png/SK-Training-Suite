// Recycle Bin for Live Quiz admins (see migration 20261010120000). The database copies a quiz / exam / session / survey
// into the bin the moment it is deleted; this file lists, restores and permanently clears those copies.

import { supabaseQuiz } from "../../lib/supabaseQuiz";

export type RecycleType = "quiz" | "quiz_session" | "exam_session" | "survey";

export interface RecycleItem {
  id: string;
  entity_type: RecycleType;
  title: string;
  subtitle: string;
  deleted_at: string;
  expires_at: string;
}

export async function listRecycleBin(companyId: string): Promise<RecycleItem[]> {
  // clear what has expired before listing — best effort, never blocks the list
  await supabaseQuiz.rpc("purge_recycle_bin").then(() => undefined, () => undefined);
  const { data, error } = await supabaseQuiz
    .from("recycle_bin")
    .select("id, entity_type, title, subtitle, deleted_at, expires_at")
    .eq("company_id", companyId)
    .order("deleted_at", { ascending: false });
  if (error) {
    console.error("[quizRecycleBinRepository] listRecycleBin:", error);
    throw new Error(error.message);
  }
  return (data ?? []) as RecycleItem[];
}

/** Puts the item back exactly as it was. Returns its title. */
export async function restoreFromBin(id: string): Promise<string> {
  const { data, error } = await supabaseQuiz.rpc("restore_from_recycle_bin", { p_id: id });
  if (error) {
    console.error("[quizRecycleBinRepository] restoreFromBin:", error);
    throw new Error(error.message);
  }
  return String(data ?? "");
}

export async function deleteForever(id: string): Promise<void> {
  const { error } = await supabaseQuiz.from("recycle_bin").delete().eq("id", id);
  if (error) {
    console.error("[quizRecycleBinRepository] deleteForever:", error);
    throw new Error(error.message);
  }
}
