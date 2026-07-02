export interface Designation {
  id: string;

  company_id: string;

  branch_id: string;

  department_id: string;

  designation_code: string;

  designation_name: string;

  description: string;

  hierarchy_level: number;

  active: boolean;

  created_at: string;

  updated_at: string;
}

export type DesignationForm = Omit<
  Designation,
  "id" | "created_at" | "updated_at"
>;