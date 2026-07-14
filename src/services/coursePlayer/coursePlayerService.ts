// src/services/coursePlayer/coursePlayerService.ts
// Business logic only — no Supabase imports.

import {
  getCoursePlayerData,
  markLessonComplete,
} from '../../repositories/coursePlayer/coursePlayerRepository';

import type { CoursePlayerData } from '../../types/coursePlayer';

export async function loadCoursePlayer(
  enrollmentId: string,
  employeeId:   string,
): Promise<CoursePlayerData> {
  if (!enrollmentId) throw new Error('Enrollment ID is required.');
  if (!employeeId)   throw new Error('Employee ID is required.');
  return await getCoursePlayerData(enrollmentId, employeeId);
}

export async function completeLesson(
  enrollmentId:    string,
  lessonId:        string,
  totalLessons:    number,
  completedCount:  number,
): Promise<number> {
  if (!enrollmentId) throw new Error('Enrollment ID is required.');
  if (!lessonId)     throw new Error('Lesson ID is required.');

  const next       = Math.min(completedCount + 1, totalLessons);
  const percentage = totalLessons > 0 ? Math.round((next / totalLessons) * 100) : 0;

  await markLessonComplete(enrollmentId, lessonId, percentage);
  return percentage;
}
