import { supabase } from "../../lib/supabase";
import type { Assessment } from "../../types/assessment";
import type { AssessmentForm } from "../../types/assessment";

export async function getAssessments(): Promise<Assessment[]> {
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .order("assessment_title", { ascending: true });

  if (error) {
    console.error("[assessmentRepository] getAssessments:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getAssessmentById(id: string): Promise<Assessment> {
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[assessmentRepository] getAssessmentById:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createAssessment(
  assessment: AssessmentForm
): Promise<Assessment> {
  const { data, error } = await supabase
    .from("assessments")
    .insert(assessment)
    .select()
    .single();

  if (error) {
    console.error("[assessmentRepository] createAssessment:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateAssessment(
  id: string,
  assessment: Partial<AssessmentForm>
): Promise<Assessment> {
  const { data, error } = await supabase
    .from("assessments")
    .update(assessment)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[assessmentRepository] updateAssessment:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteAssessment(id: string): Promise<void> {
  const { error } = await supabase
    .from("assessments")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[assessmentRepository] deleteAssessment:", error);
    throw new Error(error.message);
  }
}

export async function toggleAssessmentStatus(
  id: string,
  active: boolean
): Promise<Assessment> {
  const { data, error } = await supabase
    .from("assessments")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[assessmentRepository] toggleAssessmentStatus:", error);
    throw new Error(error.message);
  }

  return data;
}
