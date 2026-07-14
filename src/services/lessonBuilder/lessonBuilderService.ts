// src/services/lessonBuilder/lessonBuilderService.ts
// Business logic only — no Supabase imports.

import type { Lesson, LessonForm } from '../../types/lessonBuilder';

import {
  getAllLessons,
  insertLesson,
  updateLessonById,
  deleteLessonById,
} from '../../repositories/lessonBuilder/lessonBuilderRepository';

function validateLessonForm(data: Partial<LessonForm>): void {
  if (data.module_id !== undefined && !data.module_id) {
    throw new Error('Module is required.');
  }

  if (data.lesson_title !== undefined && !data.lesson_title.trim()) {
    throw new Error('Lesson Title is required.');
  }

  if (data.lesson_type !== undefined && !data.lesson_type) {
    throw new Error('Lesson Type is required.');
  }

  if (data.display_order !== undefined && data.display_order < 1) {
    throw new Error('Display Order must be at least 1.');
  }

  if (data.duration_minutes !== undefined && data.duration_minutes < 0) {
    throw new Error('Estimated Duration cannot be negative.');
  }
}

export async function loadLessons(): Promise<Lesson[]> {
  return await getAllLessons();
}

export async function createLesson(data: LessonForm): Promise<Lesson> {
  validateLessonForm(data);
  return await insertLesson(data);
}

export async function updateLesson(
  id: string,
  data: Partial<LessonForm>
): Promise<Lesson> {
  if (!id) {
    throw new Error('Invalid Lesson ID.');
  }

  validateLessonForm(data);
  return await updateLessonById(id, data);
}

export async function deleteLesson(id: string): Promise<void> {
  if (!id) {
    throw new Error('Invalid Lesson ID.');
  }

  await deleteLessonById(id);
}
