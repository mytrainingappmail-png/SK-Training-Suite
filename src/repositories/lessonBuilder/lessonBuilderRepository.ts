// src/repositories/lessonBuilder/lessonBuilderRepository.ts
//
// Supabase queries only — zero business logic.
// Operates on the existing `lessons` table (see types/lesson.ts).

import { supabase } from '../../lib/supabase';
import type { Lesson, LessonForm } from '../../types/lessonBuilder';

export async function getAllLessons(): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[lessonBuilderRepository] getAllLessons:', error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getLessonById(id: string): Promise<Lesson> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[lessonBuilderRepository] getLessonById:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function insertLesson(lesson: LessonForm): Promise<Lesson> {
  const { data, error } = await supabase
    .from('lessons')
    .insert(lesson)
    .select()
    .single();

  if (error) {
    console.error('[lessonBuilderRepository] insertLesson:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateLessonById(
  id: string,
  lesson: Partial<LessonForm>
): Promise<Lesson> {
  const { data, error } = await supabase
    .from('lessons')
    .update(lesson)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[lessonBuilderRepository] updateLessonById:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteLessonById(id: string): Promise<void> {
  const { error } = await supabase
    .from('lessons')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[lessonBuilderRepository] deleteLessonById:', error);
    throw new Error(error.message);
  }
}
