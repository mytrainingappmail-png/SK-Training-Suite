export interface EvaluationRule {

  id: string;

  assessment_id: string;

  negative_marking: boolean;

  negative_marks: number;

  partial_marking: boolean;

  pass_percentage: number;

  case_sensitive_fill_blank: boolean;

  trim_whitespace: boolean;

  allow_manual_review: boolean;

  active: boolean;

  created_at: string;

  updated_at: string;

}

export type EvaluationRuleForm = Omit<
  EvaluationRule,
  "id" | "created_at" | "updated_at"
>;

export const defaultEvaluationRuleForm: EvaluationRuleForm = {
  assessment_id:             "",
  negative_marking:          false,
  negative_marks:            0,
  partial_marking:           false,
  pass_percentage:           50,
  case_sensitive_fill_blank: false,
  trim_whitespace:           true,
  allow_manual_review:       false,
  active:                    true,
};
