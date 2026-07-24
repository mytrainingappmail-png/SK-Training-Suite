export interface EmployeeOfTheMonth {
  id: string;
  company_id: string;
  employee_id: string;
  month: number;
  year: number;
  photo_url: string;
  message: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type EmployeeOfTheMonthForm = Pick<
  EmployeeOfTheMonth,
  "employee_id" | "month" | "year" | "photo_url" | "message"
>;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
