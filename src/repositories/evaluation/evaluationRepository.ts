import { supabase } from "../../lib/supabase";
import type { EvaluationRule } from "../../types/evaluation";
import type { EvaluationRuleForm } from "../../types/evaluation";

export async function getRules(): Promise<EvaluationRule[]> {
  const { data, error } = await supabase
    .from("evaluation_rules")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[evaluationRepository] getRules:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getRule(id: string): Promise<EvaluationRule> {
  const { data, error } = await supabase
    .from("evaluation_rules")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[evaluationRepository] getRule:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createRule(
  rule: EvaluationRuleForm
): Promise<EvaluationRule> {
  const { data, error } = await supabase
    .from("evaluation_rules")
    .insert(rule)
    .select()
    .single();

  if (error) {
    console.error("[evaluationRepository] createRule:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateRule(
  id: string,
  rule: Partial<EvaluationRuleForm>
): Promise<EvaluationRule> {
  const { data, error } = await supabase
    .from("evaluation_rules")
    .update(rule)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[evaluationRepository] updateRule:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase
    .from("evaluation_rules")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[evaluationRepository] deleteRule:", error);
    throw new Error(error.message);
  }
}

export async function toggleRuleStatus(
  id: string,
  active: boolean
): Promise<EvaluationRule> {
  const { data, error } = await supabase
    .from("evaluation_rules")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[evaluationRepository] toggleRuleStatus:", error);
    throw new Error(error.message);
  }

  return data;
}
