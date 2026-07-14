// src/repositories/courseBuilder/courseBuilderRepository.ts
//
// Supabase queries only — zero business logic.
// Operates on the existing `courses` table (see types/course.ts).

import { supabase } from '../../lib/supabase';
import type { Course, CourseForm } from '../../types/courseBuilder';

export async function getAllCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[courseBuilderRepository] getAllCourses:', error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getCourseById(id: string): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[courseBuilderRepository] getCourseById:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function insertCourse(course: CourseForm): Promise<Course> {
    console.log("COURSE PAYLOAD", course);

Object.entries(course).forEach(([k, v]) => {
  if (v === "") console.warn("EMPTY STRING:", k);
});
  const { data, error } = await supabase
    .from('courses')
    .insert(course)
    .select()
    .single();

  if (error) {
    console.error('[courseBuilderRepository] insertCourse:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateCourseById(
  id: string,
  course: Partial<CourseForm>
): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .update(course)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[courseBuilderRepository] updateCourseById:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteCourseById(id: string): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[courseBuilderRepository] deleteCourseById:', error);
    throw new Error(error.message);
  }
}
