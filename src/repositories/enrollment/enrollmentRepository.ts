import { supabase } from "../../lib/supabase";
import type { Enrollment } from "../../types/enrollment";
import type { EnrollmentForm } from "../../types/enrollment";

export async function getEnrollments(): Promise<Enrollment[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[enrollmentRepository] getEnrollments:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getEnrollment(id: string): Promise<Enrollment> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[enrollmentRepository] getEnrollment:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createEnrollment(
  enrollment: EnrollmentForm
): Promise<Enrollment> {
  const { data, error } = await supabase
    .from("enrollments")
    .insert(enrollment)
    .select()
    .single();

  if (error) {
    console.error("[enrollmentRepository] createEnrollment:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateEnrollment(
  id: string,
  enrollment: Partial<EnrollmentForm>
): Promise<Enrollment> {
  const { data, error } = await supabase
    .from("enrollments")
    .update(enrollment)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[enrollmentRepository] updateEnrollment:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteEnrollment(id: string): Promise<void> {
  const { error } = await supabase
    .from("enrollments")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[enrollmentRepository] deleteEnrollment:", error);
    throw new Error(error.message);
  }
}

export async function cancelEnrollment(id: string): Promise<Enrollment> {
  const { data, error } = await supabase
    .from("enrollments")
    .update({ status: "CANCELLED" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[enrollmentRepository] cancelEnrollment:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function toggleIsActive(
  id: string,
  is_active: boolean
): Promise<Enrollment> {
  const { data, error } = await supabase
    .from("enrollments")
    .update({ is_active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[enrollmentRepository] toggleIsActive:", error);
    throw new Error(error.message);
  }

  return data;
}
