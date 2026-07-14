// Exact enums from the database schema
export type AssignmentType =
  | "MANUAL"
  | "AUTO"
  | "BULK"
  | "IMPORT"
  | "API";

export type EnrollmentType =
  | "COURSE"
  | "LEARNING_PATH";

export type EnrollmentStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED";

// Exact column names from the enrollments table
export interface Enrollment {

  id: string;

  company_id: string;

  branch_id: string;

  employee_id: string;

  course_id: string;

  learning_path_id: string;

  assignment_type: AssignmentType;

  enrollment_type: EnrollmentType;

  status: EnrollmentStatus;

  assigned_by: string;

  assigned_at: string;

  start_date: string;

  due_date: string;

  completed_at: string | null;

  expiry_date: string;

  completion_percentage: number;

  certificate_id: string;

  remarks: string;

  is_active: boolean;

  created_at: string;

  updated_at: string;

}

export type EnrollmentForm = Omit<
  Enrollment,
  "id" | "created_at" | "updated_at"
>;

export const defaultEnrollmentForm: EnrollmentForm = {
  company_id:            "",
  branch_id:             "",
  employee_id:           "",
  course_id:             "",
  learning_path_id:      "",
  assignment_type:       "MANUAL",
  enrollment_type:       "COURSE",
  status:                "PENDING",
  assigned_by:           "",
  assigned_at:           "",
  start_date:            "",
  due_date:              "",
  completed_at:          null,
  expiry_date:           "",
  completion_percentage: 0,
  certificate_id:        "",
  remarks:               "",
  is_active:             true,
};
