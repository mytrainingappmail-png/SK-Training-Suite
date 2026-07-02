export interface Department {
  id: string;

  company_id: string;

  branch_id: string;

  department_code: string;

  department_name: string;

  description: string;

  active: boolean;

  created_at: string;

  updated_at: string;
}

export type DepartmentForm = Omit<
  Department,
  "id" | "created_at" | "updated_at"
>;