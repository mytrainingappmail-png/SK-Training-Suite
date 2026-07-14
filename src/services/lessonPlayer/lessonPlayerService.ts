// src/services/lessonPlayer/lessonPlayerService.ts
// Business logic only — no Supabase imports.

import {
  getLessonById,
  getLessonsByModule,
} from '../../repositories/lessonPlayer/lessonPlayerRepository';
import type { LessonPlayerLesson } from '../../types/lessonPlayer';

export async function loadLesson(lessonId: string): Promise<LessonPlayerLesson> {
  if (!lessonId) throw new Error('Lesson ID is required.');
  return await getLessonById(lessonId);
}

export async function loadModuleLessons(moduleId: string): Promise<LessonPlayerLesson[]> {
  if (!moduleId) throw new Error('Module ID is required.');
  return await getLessonsByModule(moduleId);
}
