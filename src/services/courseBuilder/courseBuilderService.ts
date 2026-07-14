// src/services/courseBuilder/courseBuilderService.ts
// Business logic only — no Supabase imports.

import type { Course, CourseForm } from '../../types/courseBuilder';

import {
  getAllCourses,
  insertCourse,
  updateCourseById,
  deleteCourseById,
} from '../../repositories/courseBuilder/courseBuilderRepository';

function validateCourseForm(data: Partial<CourseForm>): void {
  if (!data.company_id) {
    throw new Error('Company is required.');
  }

  if (!data.category_id) {
    throw new Error('Category is required.');
  }

  if (!data.course_code?.trim()) {
    throw new Error('Course Code is required.');
  }

  if (!data.course_name?.trim()) {
    throw new Error('Course Name is required.');
  }

  if (!data.level) {
    throw new Error('Course Level is required.');
  }

  if (
    data.passing_percentage !== undefined &&
    (data.passing_percentage < 0 || data.passing_percentage > 100)
  ) {
    throw new Error('Passing Percentage must be between 0 and 100.');
  }

  if (data.duration_days !== undefined && data.duration_days < 0) {
    throw new Error('Duration Days cannot be negative.');
  }

  if (data.duration_hours !== undefined && data.duration_hours < 0) {
    throw new Error('Duration Hours cannot be negative.');
  }
}

export async function loadCourseBuilder(): Promise<Course[]> {
  return await getAllCourses();
}

export async function createCourse(data: CourseForm): Promise<Course> {
  validateCourseForm(data);
  return await insertCourse(data);
}

export async function updateCourse(
  id: string,
  data: Partial<CourseForm>
): Promise<Course> {
  if (!id) {
    throw new Error('Invalid Course ID.');
  }

  validateCourseForm(data);
  return await updateCourseById(id, data);
}

export async function deleteCourse(id: string): Promise<void> {
  if (!id) {
    throw new Error('Invalid Course ID.');
  }

  await deleteCourseById(id);
}
