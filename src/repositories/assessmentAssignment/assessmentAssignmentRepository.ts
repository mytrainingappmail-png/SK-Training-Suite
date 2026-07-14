import { supabase } from "../../lib/supabase";
import type { AssessmentAssignment } from "../../types/assessmentAssignment";
import type { AssessmentAssignmentForm } from "../../types/assessmentAssignment";

export async function getAssignments(): Promise<AssessmentAssignment[]> {
  const { data, error } = await supabase
    .from("assessment_assignments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[assessmentAssignmentRepository] getAssignments:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getAssignmentById(
  id: string
): Promise<AssessmentAssignment> {
  const { data, error } = await supabase
    .from("assessment_assignments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[assessmentAssignmentRepository] getAssignmentById:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createAssignment(
  assignment: AssessmentAssignmentForm
): Promise<AssessmentAssignment> {
  const { data, error } = await supabase
    .from("assessment_assignments")
    .insert(assignment)
    .select()
    .single();

  if (error) {
    console.error("[assessmentAssignmentRepository] createAssignment:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateAssignment(
  id: string,
  assignment: Partial<AssessmentAssignmentForm>
): Promise<AssessmentAssignment> {
  const { data, error } = await supabase
    .from("assessment_assignments")
    .update(assignment)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[assessmentAssignmentRepository] updateAssignment:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase
    .from("assessment_assignments")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[assessmentAssignmentRepository] deleteAssignment:", error);
    throw new Error(error.message);
  }
}

export async function toggleAssignmentStatus(
  id: string,
  active: boolean
): Promise<AssessmentAssignment> {
  const { data, error } = await supabase
    .from("assessment_assignments")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[assessmentAssignmentRepository] toggleAssignmentStatus:", error);
    throw new Error(error.message);
  }

  return data;
}
