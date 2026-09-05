// Identity/access management for the Calling App — deliberately always
// through the main `supabase` (LMS) client, never supabaseCallingApp.
// Per calling_app_admins_write_employee RLS, granting/revoking access is
// a security boundary only a real LMS employee session can cross (same
// philosophy as aptitude_admins/quiz_admins provisioning).

import { supabase } from "../../lib/supabase";
import type { CallingAppAdmin, CallingAppAdminRole } from "../../types/callingApp";

export async function listCallingAppAdmins(companyId: string): Promise<CallingAppAdmin[]> {
  const { data, error } = await supabase
    .from("calling_app_admins")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[callingAppAdminRepository] listCallingAppAdmins:", error);
    throw new Error(error.message);
  }
  return data ?? [];
}

/** "Use existing LMS login" mode — no dedicated credential, just a grant
 * row linking an already-real employee. */
export async function grantEmployeeAccess(
  companyId: string,
  employeeId: string,
  displayName: string,
  email: string | null,
  opts: { isAdmin: boolean; canUpload: boolean; canDownload: boolean; canManageMasterSheet?: boolean; dailyTarget: number; role?: CallingAppAdminRole; reportsTo?: string | null }
): Promise<CallingAppAdmin> {
  const { data, error } = await supabase
    .from("calling_app_admins")
    .insert({
      company_id: companyId,
      employee_id: employeeId,
      display_name: displayName,
      email,
      is_admin: opts.isAdmin,
      can_upload: opts.canUpload,
      can_download: opts.canDownload,
      can_manage_master_sheet: opts.canManageMasterSheet ?? false,
      daily_target: opts.dailyTarget,
      role: opts.role ?? "agent",
      reports_to: opts.reportsTo ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[callingAppAdminRepository] grantEmployeeAccess:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function updateCallingAppAdmin(id: string, patch: Partial<Pick<CallingAppAdmin, "is_admin" | "can_upload" | "can_download" | "can_manage_master_sheet" | "daily_target" | "status" | "role" | "reports_to">>): Promise<CallingAppAdmin> {
  const { data, error } = await supabase
    .from("calling_app_admins")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[callingAppAdminRepository] updateCallingAppAdmin:", error);
    throw new Error(error.message);
  }
  return data;
}

export async function removeCallingAppAdmin(id: string): Promise<void> {
  const { error } = await supabase.from("calling_app_admins").delete().eq("id", id);
  if (error) {
    console.error("[callingAppAdminRepository] removeCallingAppAdmin:", error);
    throw new Error(error.message);
  }
}

/** Resolves the currently-signed-in LMS employee's own Calling App grant,
 * if any — powers the Sidebar link + the embedded /calling-app entry
 * point's access check. Null means "not granted access." */
export async function getMyEmployeeLinkedGrant(): Promise<CallingAppAdmin | null> {
  const { data: userData } = await supabase.auth.getUser();
  const authUserId = userData.user?.id;
  if (!authUserId) return null;

  const { data: employee } = await supabase.from("employees").select("id").eq("auth_user_id", authUserId).maybeSingle();
  if (!employee) return null;

  const { data, error } = await supabase
    .from("calling_app_admins")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("[callingAppAdminRepository] getMyEmployeeLinkedGrant:", error);
    return null;
  }
  return data;
}
