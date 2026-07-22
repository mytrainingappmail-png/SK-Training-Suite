// src/repositories/courseVisibility/courseVisibilityRepository.ts
//
// Repository layer — Supabase ONLY. course_visibility is a plain
// junction table (course_id, designation_id) — no "granted" flag,
// same pattern as role_permissions: a row's existence IS the grant.

import { supabase } from '../../lib/supabase';
import type { CourseVisibility, CourseVisibilityForm } from '../../types/courseVisibility';

export async function getCourseVisibility(): Promise<CourseVisibility[]> {
  const { data, error } = await supabase.from('course_visibility').select('*');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addCourseVisibility(form: CourseVisibilityForm): Promise<CourseVisibility> {
  const { data: existingRows, error: existingError } = await supabase
    .from('course_visibility')
    .select('*')
    .eq('course_id', form.course_id)
    .eq('designation_id', form.designation_id);
  if (existingError) throw new Error(existingError.message);
  if (existingRows && existingRows.length > 0) return existingRows[0];

  const { data, error } = await supabase.from('course_visibility').insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  return { id: '', created_at: '', ...form };
}

export async function removeCourseVisibility(courseId: string, designationId: string): Promise<void> {
  const { error } = await supabase
    .from('course_visibility')
    .delete()
    .eq('course_id', courseId)
    .eq('designation_id', designationId);
  if (error) throw new Error(error.message);
}
