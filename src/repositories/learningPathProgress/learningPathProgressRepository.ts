import { supabase } from "../../lib/supabase";
import type { LearningPathProgress } from "../../types/learningPathProgress";
import type { LearningPathProgressForm } from "../../types/learningPathProgress";

export async function getProgress(): Promise<LearningPathProgress[]> {
  const { data, error } = await supabase
    .from("learning_path_progress")
    .select("*")
    .order("last_accessed_at", { ascending: false });

  if (error) {
    console.error("[learningPathProgressRepository] getProgress:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getProgressById(
  id: string
): Promise<LearningPathProgress> {
  const { data, error } = await supabase
    .from("learning_path_progress")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[learningPathProgressRepository] getProgressById:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createProgress(
  progress: LearningPathProgressForm
): Promise<LearningPathProgress> {
  const { data, error } = await supabase
    .from("learning_path_progress")
    .insert(progress)
    .select()
    .single();

  if (error) {
    console.error("[learningPathProgressRepository] createProgress:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateProgress(
  id: string,
  progress: Partial<LearningPathProgressForm>
): Promise<LearningPathProgress> {
  const { data, error } = await supabase
    .from("learning_path_progress")
    .update(progress)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[learningPathProgressRepository] updateProgress:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteProgress(id: string): Promise<void> {
  const { error } = await supabase
    .from("learning_path_progress")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[learningPathProgressRepository] deleteProgress:", error);
    throw new Error(error.message);
  }
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<LearningPathProgress> {
  const { data, error } = await supabase
    .from("learning_path_progress")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[learningPathProgressRepository] toggleActive:", error);
    throw new Error(error.message);
  }

  return data;
}
