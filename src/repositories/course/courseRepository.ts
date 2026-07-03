import { supabase } from "../../lib/supabase";
import type { Course } from "../../types/course";
import type { CourseForm } from "../../types/course";

export async function getAllCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("course_name", { ascending: true });

  if (error) {
    console.error("[courseRepository] getAllCourses:", error);
    throw new Error(error.message);
  }

  return data ?? [];
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
  const { data, error } = await supabase
    .from("courses")
    .insert(course)
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
  const { data, error } = await supabase
    .from("courses")
    .update(course)
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
