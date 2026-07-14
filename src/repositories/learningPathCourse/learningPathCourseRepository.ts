import { supabase } from "../../lib/supabase";
import type { LearningPathCourse } from "../../types/learningPathCourse";
import type { LearningPathCourseForm } from "../../types/learningPathCourse";

export async function getLearningPathCourses(): Promise<LearningPathCourse[]> {
  const { data, error } = await supabase
    .from("learning_path_courses")
    .select("*")
    .order("learning_path_id", { ascending: true })
    .order("sequence_no",      { ascending: true });

  if (error) {
    console.error("[learningPathCourseRepository] getLearningPathCourses:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getLearningPathCourse(
  id: string
): Promise<LearningPathCourse> {
  const { data, error } = await supabase
    .from("learning_path_courses")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[learningPathCourseRepository] getLearningPathCourse:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createLearningPathCourse(
  item: LearningPathCourseForm
): Promise<LearningPathCourse> {
  const { data, error } = await supabase
    .from("learning_path_courses")
    .insert(item)
    .select()
    .single();

  if (error) {
    console.error("[learningPathCourseRepository] createLearningPathCourse:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateLearningPathCourse(
  id: string,
  item: Partial<LearningPathCourseForm>
): Promise<LearningPathCourse> {
  const { data, error } = await supabase
    .from("learning_path_courses")
    .update(item)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[learningPathCourseRepository] updateLearningPathCourse:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteLearningPathCourse(id: string): Promise<void> {
  const { error } = await supabase
    .from("learning_path_courses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[learningPathCourseRepository] deleteLearningPathCourse:", error);
    throw new Error(error.message);
  }
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<LearningPathCourse> {
  const { data, error } = await supabase
    .from("learning_path_courses")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[learningPathCourseRepository] toggleActive:", error);
    throw new Error(error.message);
  }

  return data;
}
