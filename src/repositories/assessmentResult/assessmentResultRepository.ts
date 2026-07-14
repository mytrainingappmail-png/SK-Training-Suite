import { supabase } from "../../lib/supabase";
import type { AssessmentResult } from "../../types/assessmentResult";
import type { AssessmentResultForm } from "../../types/assessmentResult";

export async function getResults(): Promise<AssessmentResult[]> {
  const { data, error } = await supabase
    .from("assessment_results")
    .select("*")
    .order("evaluated_at", { ascending: false });

  if (error) {
    console.error("[assessmentResultRepository] getResults:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getResult(id: string): Promise<AssessmentResult> {
  const { data, error } = await supabase
    .from("assessment_results")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[assessmentResultRepository] getResult:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createResult(
  result: AssessmentResultForm
): Promise<AssessmentResult> {
  const { data, error } = await supabase
    .from("assessment_results")
    .insert(result)
    .select()
    .single();

  if (error) {
    console.error("[assessmentResultRepository] createResult:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateResult(
  id: string,
  result: Partial<AssessmentResultForm>
): Promise<AssessmentResult> {
  const { data, error } = await supabase
    .from("assessment_results")
    .update(result)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[assessmentResultRepository] updateResult:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteResult(id: string): Promise<void> {
  const { error } = await supabase
    .from("assessment_results")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[assessmentResultRepository] deleteResult:", error);
    throw new Error(error.message);
  }
}

export async function togglePublished(
  id: string,
  published: boolean
): Promise<AssessmentResult> {
  const { data, error } = await supabase
    .from("assessment_results")
    .update({ published })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[assessmentResultRepository] togglePublished:", error);
    throw new Error(error.message);
  }

  return data;
}
