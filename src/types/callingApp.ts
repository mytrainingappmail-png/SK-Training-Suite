// Calling App (premium add-on) — Phase 1 types.
// Deliberately separate from src/types/app.ts (User/Employee) — a
// calling_app_admins row is its own identity, not an employee record,
// even when it's linked to one via employee_id.

export type CallingAppAdminStatus = "active" | "disabled";
export type DispositionOutcome = "positive" | "neutral" | "negative";
export type CustomFieldType = "text" | "number" | "date" | "dropdown";

export interface CallingAppAdmin {
  id: string;
  company_id: string;
  employee_id: string | null;
  auth_user_id: string | null;
  username: string | null;
  display_name: string;
  email: string | null;
  is_admin: boolean;
  can_upload: boolean;
  can_download: boolean;
  daily_target: number;
  status: CallingAppAdminStatus;
  created_at: string;
}

export interface CallingAppDisposition {
  id: string;
  company_id: string;
  label: string;
  color: string;
  outcome_type: DispositionOutcome;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CallingAppCustomFieldDef {
  id: string;
  company_id: string;
  field_key: string;
  label: string;
  field_type: CustomFieldType;
  dropdown_options: string[] | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CallingAppCallList {
  id: string;
  company_id: string;
  name: string;
  row_count: number;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface CallingAppContact {
  id: string;
  company_id: string;
  list_id: string | null;
  name: string;
  mobile_no: string;
  email: string | null;
  project_name: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  disposition_id: string | null;
  remarks: string | null;
  attempt_count: number;
  next_call_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CallingAppContactForm = Pick<
  CallingAppContact,
  "list_id" | "name" | "mobile_no" | "email" | "project_name" | "assigned_to" | "disposition_id" | "remarks" | "next_call_at"
>;

export interface CallingAppCustomFieldValue {
  id: string;
  contact_id: string;
  field_def_id: string;
  value_text: string | null;
}

export interface MasterSheetListSummary {
  list: CallingAppCallList;
  total: number;
  assigned: number;
  unassigned: number;
}

export interface EmployeeDistributionSummary {
  admin: CallingAppAdmin;
  totalAssigned: number;
  pending: number; // attempt_count = 0, i.e. not yet worked
  firstAssignedAt: string | null;
  lastAssignedAt: string | null;
}

export interface DuplicateMobileMatch {
  mobile_no: string;
  existingContactId: string;
  existingName: string;
  assignedToAdminId: string | null;
}

export interface CallingAppCallLog {
  id: string;
  company_id: string;
  contact_id: string;
  admin_id: string;
  disposition_id: string | null;
  remarks: string | null;
  called_at: string;
}
