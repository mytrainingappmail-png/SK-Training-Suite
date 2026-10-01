import type { AttendanceLocationScope } from './geofence';

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

  attendance_location_scope: AttendanceLocationScope;

  /** Set once this employee has a real Supabase Auth login — null means an administrator still needs to create their login (Employee Management → edit → set a password). Passwords themselves are never stored on the employee row. */
  auth_user_id: string | null;

  /** The employee's own profile photo (uploaded from the profile drawer). */
  profile_image_url?: string | null;

  created_at: string;
  updated_at: string;
}

export type EmployeeForm = Omit<
  Employee,
  "id" | "created_at" | "updated_at" | "auth_user_id"
> & {
  /**
   * Only present in the create/edit form — never stored on the employee
   * row and never returned by queries. On create it becomes the
   * employee's initial login password (set on their Supabase Auth
   * login by the provisioning edge function). On edit, leave blank to
   * keep the existing password unchanged.
   */
  password?: string;
};
