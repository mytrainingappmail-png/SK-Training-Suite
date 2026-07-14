export interface AssessmentResult {

  id: string;

  attempt_id: string;

  assessment_id: string;

  employee_id: string;

  total_marks: number;

  obtained_marks: number;

  percentage: number;

  passed: boolean;

  grade: string;

  rank: number;

  certificate_generated: boolean;

  evaluated_at: string;

  published: boolean;

  remarks: string;

  created_at: string;

  updated_at: string;

}

export type AssessmentResultForm = Omit<
  AssessmentResult,
  "id" | "created_at" | "updated_at"
>;

export const defaultAssessmentResultForm: AssessmentResultForm = {
  attempt_id:            "",
  assessment_id:         "",
  employee_id:           "",
  total_marks:           0,
  obtained_marks:        0,
  percentage:            0,
  passed:                false,
  grade:                 "",
  rank:                  1,
  certificate_generated: false,
  evaluated_at:          "",
  published:             false,
  remarks:               "",
};
