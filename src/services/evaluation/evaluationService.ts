import type { EvaluationRule } from "../../types/evaluation";
import type { EvaluationRuleForm } from "../../types/evaluation";

import {
  getRules,
  createRule as repositoryCreateRule,
  updateRule,
  deleteRule,
  toggleRuleStatus as repositoryToggleRuleStatus,
} from "../../repositories/evaluation/evaluationRepository";

export async function loadRules(): Promise<EvaluationRule[]> {
  return await getRules();
}

export async function createRule(
  data: EvaluationRuleForm
): Promise<EvaluationRule> {
  validateRuleForm(data);

  const existing = await getRules();
  assertNoRuleForAssessment(data.assessment_id, existing);

  return await repositoryCreateRule(data);
}

export async function saveRule(
  id: string,
  data: EvaluationRuleForm
): Promise<EvaluationRule> {
  if (!id) throw new Error("Invalid Evaluation Rule ID.");
  validateRuleForm(data);

  const existing = await getRules();
  assertNoRuleForAssessment(data.assessment_id, existing, id);

  return await updateRule(id, data);
}

export async function removeRule(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Evaluation Rule ID.");
  await deleteRule(id);
}

export async function toggleRuleStatus(
  id: string,
  active: boolean
): Promise<EvaluationRule> {
  if (!id) throw new Error("Invalid Evaluation Rule ID.");
  return await repositoryToggleRuleStatus(id, active);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateRuleForm(data: EvaluationRuleForm): void {
  if (!data.assessment_id) {
    throw new Error("Assessment is required.");
  }

  if (data.pass_percentage < 0 || data.pass_percentage > 100) {
    throw new Error("Pass Percentage must be between 0 and 100.");
  }

  if (data.negative_marks < 0) {
    throw new Error("Negative Marks must be zero or greater.");
  }
}

function assertNoRuleForAssessment(
  assessmentId: string,
  existing: EvaluationRule[],
  excludeId?: string
): void {
  const duplicate = existing.find(
    (r) =>
      r.assessment_id === assessmentId &&
      (excludeId === undefined || r.id !== excludeId)
  );

  if (duplicate) {
    throw new Error(
      "An evaluation rule already exists for this assessment. Only one rule is allowed per assessment."
    );
  }
}
