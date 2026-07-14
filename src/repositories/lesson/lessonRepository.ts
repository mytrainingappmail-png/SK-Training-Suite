import { supabase } from "../../lib/supabase";
import type { Lesson } from "../../types/lesson";
import type { LessonForm } from "../../types/lesson";

export async function getLessons(): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[lessonRepository] getLessons:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getLessonById(id: string): Promise<Lesson> {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[lessonRepository] getLessonById:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createLesson(lesson: LessonForm): Promise<Lesson> {
  const { data, error } = await supabase
    .from("lessons")
    .insert(lesson)
    .select()
    .single();

  if (error) {
    console.error("[lessonRepository] createLesson:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateLesson(
  id: string,
  lesson: Partial<LessonForm>
): Promise<Lesson> {
  const { data, error } = await supabase
    .from("lessons")
    .update(lesson)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[lessonRepository] updateLesson:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteLesson(id: string): Promise<void> {
  const { error } = await supabase
    .from("lessons")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[lessonRepository] deleteLesson:", error);
    throw new Error(error.message);
  }
}

export async function toggleLessonStatus(
  id: string,
  active: boolean
): Promise<Lesson> {
  const { data, error } = await supabase
    .from("lessons")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[lessonRepository] toggleLessonStatus:", error);
    throw new Error(error.message);
  }

  return data;
}
