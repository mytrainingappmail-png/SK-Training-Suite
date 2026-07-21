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

  created_at: string;
  updated_at: string;
}

export type EmployeeForm = Omit<
  Employee,
  "id" | "created_at" | "updated_at"
> & {
  /**
   * Only present in the create/edit form — never part of the read
   * shape returned by list/detail queries. On create it sets the
   * employee's initial (temporary) login password. On edit, leave
   * blank to keep the existing password unchanged — the form only
   * sends this field to the update call when it has been filled in.
   */
  password?: string;
};
