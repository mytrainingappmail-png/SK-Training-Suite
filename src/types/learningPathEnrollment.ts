export type EnrollmentType =
  | "company"
  | "branch"
  | "department"
  | "designation"
  | "employee";

export type EnrollmentStatus =
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface LearningPathEnrollment {

  id: string;

  learning_path_id: string;

  company_id: string;

  branch_id: string;

  department_id: string;

  designation_id: string;

  employee_id: string;

  enrollment_type: EnrollmentType;

  enrolled_date: string;

  start_date: string;

  end_date: string;

  mandatory: boolean;

  active: boolean;

  completion_required: boolean;

  status: EnrollmentStatus;

  remarks: string;

  created_at: string;

  updated_at: string;

}

export type LearningPathEnrollmentForm = Omit<
  LearningPathEnrollment,
  "id" | "created_at" | "updated_at"
>;

export const defaultEnrollmentForm: LearningPathEnrollmentForm = {
  learning_path_id:    "",
  company_id:          "",
  branch_id:           "",
  department_id:       "",
  designation_id:      "",
  employee_id:         "",
  enrollment_type:     "employee",
  enrolled_date:       "",
  start_date:          "",
  end_date:            "",
  mandatory:           false,
  active:              true,
  completion_required: false,
  status:              "assigned",
  remarks:             "",
};
