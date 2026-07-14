import { supabase } from "../../lib/supabase";
import type { LearningPath } from "../../types/learningPath";
import type { LearningPathForm } from "../../types/learningPath";

export async function getLearningPaths(): Promise<LearningPath[]> {
  const { data, error } = await supabase
    .from("learning_paths")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[learningPathRepository] getLearningPaths:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getLearningPath(id: string): Promise<LearningPath> {
  const { data, error } = await supabase
    .from("learning_paths")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[learningPathRepository] getLearningPath:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createLearningPath(
  path: LearningPathForm
): Promise<LearningPath> {
  const { data, error } = await supabase
    .from("learning_paths")
    .insert(path)
    .select()
    .single();

  if (error) {
    console.error("[learningPathRepository] createLearningPath:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateLearningPath(
  id: string,
  path: Partial<LearningPathForm>
): Promise<LearningPath> {
  const { data, error } = await supabase
    .from("learning_paths")
    .update(path)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[learningPathRepository] updateLearningPath:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteLearningPath(id: string): Promise<void> {
  const { error } = await supabase
    .from("learning_paths")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[learningPathRepository] deleteLearningPath:", error);
    throw new Error(error.message);
  }
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<LearningPath> {
  const { data, error } = await supabase
    .from("learning_paths")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[learningPathRepository] toggleActive:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function togglePublished(
  id: string,
  published: boolean
): Promise<LearningPath> {
  const { data, error } = await supabase
    .from("learning_paths")
    .update({ published })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[learningPathRepository] togglePublished:", error);
    throw new Error(error.message);
  }

  return data;
}
