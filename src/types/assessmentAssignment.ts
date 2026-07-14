export type AssignmentType =
  | "company"
  | "branch"
  | "department"
  | "designation"
  | "employee";

export type AssignmentStatus =
  | "scheduled"
  | "published"
  | "in_progress"
  | "completed"
  | "expired"
  | "cancelled";

export interface AssessmentAssignment {

  id: string;

  assessment_id: string;

  company_id: string;

  branch_id: string;

  department_id: string;

  designation_id: string;

  employee_id: string;

  assignment_type: AssignmentType;

  assigned_date: string;

  start_date: string;

  end_date: string;

  mandatory: boolean;

  allow_retake: boolean;

  maximum_attempts: number;

  assignment_status: AssignmentStatus;

  completion_required: boolean;

  notify_employee: boolean;

  remarks: string;

  active: boolean;

  created_at: string;

  updated_at: string;

}

export type AssessmentAssignmentForm = Omit<
  AssessmentAssignment,
  "id" | "created_at" | "updated_at"
>;

export const defaultAssignmentForm: AssessmentAssignmentForm = {
  assessment_id:       "",
  company_id:          "",
  branch_id:           "",
  department_id:       "",
  designation_id:      "",
  employee_id:         "",
  assignment_type:     "employee",
  assigned_date:       "",
  start_date:          "",
  end_date:            "",
  mandatory:           false,
  allow_retake:        false,
  maximum_attempts:    1,
  assignment_status:   "scheduled",
  completion_required: false,
  notify_employee:     false,
  remarks:             "",
  active:              true,
};
