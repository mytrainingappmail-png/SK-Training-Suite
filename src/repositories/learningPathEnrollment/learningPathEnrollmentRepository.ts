import { supabase } from "../../lib/supabase";
import type { LearningPathEnrollment } from "../../types/learningPathEnrollment";
import type { LearningPathEnrollmentForm } from "../../types/learningPathEnrollment";

export async function getEnrollments(): Promise<LearningPathEnrollment[]> {
  const { data, error } = await supabase
    .from("learning_path_enrollments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[learningPathEnrollmentRepository] getEnrollments:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getEnrollment(
  id: string
): Promise<LearningPathEnrollment> {
  const { data, error } = await supabase
    .from("learning_path_enrollments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[learningPathEnrollmentRepository] getEnrollment:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createEnrollment(
  enrollment: LearningPathEnrollmentForm
): Promise<LearningPathEnrollment> {
  const { data, error } = await supabase
    .from("learning_path_enrollments")
    .insert(enrollment)
    .select()
    .single();

  if (error) {
    console.error("[learningPathEnrollmentRepository] createEnrollment:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateEnrollment(
  id: string,
  enrollment: Partial<LearningPathEnrollmentForm>
): Promise<LearningPathEnrollment> {
  const { data, error } = await supabase
    .from("learning_path_enrollments")
    .update(enrollment)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[learningPathEnrollmentRepository] updateEnrollment:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteEnrollment(id: string): Promise<void> {
  const { error } = await supabase
    .from("learning_path_enrollments")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[learningPathEnrollmentRepository] deleteEnrollment:", error);
    throw new Error(error.message);
  }
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<LearningPathEnrollment> {
  const { data, error } = await supabase
    .from("learning_path_enrollments")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[learningPathEnrollmentRepository] toggleActive:", error);
    throw new Error(error.message);
  }

  return data;
}
