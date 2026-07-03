export interface Employee {
  id: string;

  company_id: string;
  branch_id: string;
  department_id: string;
  designation_id: string;

  employee_code: string;

  first_name: string;
  last_name: string;

  mobile: string;
  email: string;

  joining_date: string;

  reporting_manager: string | null;

  active: boolean;

  created_at: string;
  updated_at: string;
}

export type EmployeeForm = Omit<
  Employee,
  "id" | "created_at" | "updated_at"
>;