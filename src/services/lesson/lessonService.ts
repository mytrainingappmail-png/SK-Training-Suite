import type { Lesson } from "../../types/lesson";
import type { LessonForm } from "../../types/lesson";

import {
  getLessons,
  createLesson as repositoryCreateLesson,
  updateLesson,
  deleteLesson,
  toggleLessonStatus as repositoryToggleLessonStatus,
} from "../../repositories/lesson/lessonRepository";

export async function loadLessons(): Promise<Lesson[]> {
  return await getLessons();
}

export async function createLesson(data: LessonForm): Promise<Lesson> {
  validateLessonForm(data);
  return await repositoryCreateLesson(data);
}

export async function saveLesson(
  id: string,
  data: Partial<LessonForm>
): Promise<Lesson> {
  if (!id) throw new Error("Invalid Lesson ID.");
  validateLessonForm(data);
  return await updateLesson(id, data);
}

export async function removeLesson(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Lesson ID.");
  await deleteLesson(id);
}

export async function toggleLessonStatus(
  id: string,
  active: boolean
): Promise<Lesson> {
  if (!id) throw new Error("Invalid Lesson ID.");
  return await repositoryToggleLessonStatus(id, active);
}

function validateLessonForm(data: Partial<LessonForm>): void {
  if (!data.module_id)           throw new Error("Module is required.");
  if (!data.lesson_title?.trim()) throw new Error("Lesson Title is required.");
  if (!data.lesson_type?.trim())  throw new Error("Lesson Type is required.");

  if (data.display_order !== undefined && data.display_order < 1) {
    throw new Error("Display Order must be at least 1.");
  }

  if (data.duration_minutes !== undefined && data.duration_minutes < 0) {
    throw new Error("Duration Minutes cannot be negative.");
  }
}
