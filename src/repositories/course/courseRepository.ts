import { supabase } from "../../lib/supabase";
import type { Course } from "../../types/course";
import type { CourseForm } from "../../types/course";

export async function getAllCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("display_order", { ascending: true })
    .order("course_name", { ascending: true });

  if (error) {
    console.error("[courseRepository] getAllCourses:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function convertCourseToModule(
  sourceCourseId: string,
  targetCourseId: string,
  moduleName?: string
): Promise<string> {
  const { data, error } = await supabase.rpc("convert_course_to_module", {
    p_source_course_id: sourceCourseId,
    p_target_course_id: targetCourseId,
    p_module_name: moduleName?.trim() || null,
  });

  if (error) {
    console.error("[courseRepository] convertCourseToModule:", error);
    throw new Error(error.message);
  }

  return data as string;
}

export async function getCourseById(id: string): Promise<Course> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[courseRepository] getCourseById:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createCourse(course: CourseForm): Promise<Course> {
  // created_by is a real FK to `users` (uuid) but the UI never collects a
  // value for it, so it's always "" here — Postgres rejects "" for a uuid
  // column ("invalid input syntax for type uuid"), it must be null instead.
  const { data, error } = await supabase
    .from("courses")
    .insert({ ...course, created_by: course.created_by || null })
    .select()
    .single();

  if (error) {
    console.error("[courseRepository] createCourse:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateCourse(
  id: string,
  course: Partial<CourseForm>
): Promise<Course> {
  const patch = "created_by" in course
    ? { ...course, created_by: course.created_by || null }
    : course;
  const { data, error } = await supabase
    .from("courses")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[courseRepository] updateCourse:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteCourse(id: string): Promise<void> {
  const { error } = await supabase
    .from("courses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[courseRepository] deleteCourse:", error);
    throw new Error(error.message);
  }
}

export async function setCourseStatus(
  id: string,
  active: boolean
): Promise<Course> {
  const { data, error } = await supabase
    .from("courses")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[courseRepository] setCourseStatus:", error);
    throw new Error(error.message);
  }

  return data;
}
