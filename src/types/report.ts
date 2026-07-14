export type ReportType =
  | "dashboard"
  | "employee"
  | "course"
  | "assessment"
  | "certificate"
  | "learning_path"
  | "department"
  | "branch"
  | "company";

export interface ReportFilters {
  company_id:      string;
  branch_id:       string;
  department_id:   string;
  employee_id:     string;
  course_id:       string;
  learning_path_id:string;
  status:          string;
  date_from:       string;
  date_to:         string;
}

export const defaultReportFilters: ReportFilters = {
  company_id:       "",
  branch_id:        "",
  department_id:    "",
  employee_id:      "",
  course_id:        "",
  learning_path_id: "",
  status:           "",
  date_from:        "",
  date_to:          "",
};

export interface DashboardSummary {
  total_employees:       number;
  total_courses:         number;
  completed_courses:     number;
  total_assessments:     number;
  certificates_generated:number;
  learning_paths:        number;
  completion_percentage: number;
}

export interface EmployeeReportRow {
  id:              string;
  employee_code:   string;
  full_name:       string;
  department_name: string;
  branch_name:     string;
  company_name:    string;
  roles:           string;
  created_at:      string;
}

export interface CourseReportRow {
  id:               string;
  course_title:     string;
  category_name:    string;
  total_modules:    number;
  total_lessons:    number;
  enrolled_count:   number;
  created_at:       string;
}

export interface AssessmentReportRow {
  id:             string;
  assessment_name:string;
  course_title:   string;
  total_attempts: number;
  avg_score:      number;
  pass_count:     number;
  fail_count:     number;
}

export interface CertificateReportRow {
  id:                string;
  certificate_no:    string;
  certificate_title: string;
  employee_name:     string;
  course_title:      string;
  issued_date:       string;
}

export interface LearningPathReportRow {
  id:                   string;
  path_code:            string;
  path_name:            string;
  difficulty_level:     string;
  enrolled_count:       number;
  completed_count:      number;
  avg_progress:         number;
}

export interface DepartmentReportRow {
  id:              string;
  department_name: string;
  company_name:    string;
  employee_count:  number;
}

export interface BranchReportRow {
  id:           string;
  branch_name:  string;
  company_name: string;
  employee_count:number;
}

export interface CompanyReportRow {
  id:             string;
  company_name:   string;
  branch_count:   number;
  employee_count: number;
  course_count:   number;
}
