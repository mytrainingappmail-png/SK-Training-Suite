// File: src/services/auth/authService.ts
//
// Verified import paths from src/services/auth/:
//   ../../lib/supabase      → src/lib/supabase.ts             (exports: supabase)
//   ./session               → src/services/auth/session.ts    (exports: setCurrentUser)
//   ../../types/app         → src/types/app.ts                (exports: User, UserStatus)
//
// employees table columns used (auth-specific columns must be present in DB):
//   id, company_id, branch_id, department_id, designation_id,
//   employee_code, first_name, last_name, email, mobile, active,
//   password, failed_login_attempts, account_locked,
//   last_login, password_changed_at
//
// companies table columns used:
//   id, company_code, active
//
// employee_roles table columns used:
//   employee_id, role_id, active, assigned_date

import { supabase }       from "../../lib/supabase";
import { setCurrentUser } from "./session";

import type { User, UserStatus } from "../../types/app";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const MAX_FAILED_ATTEMPTS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginCredentials {
  companyCode: string;
  employeeId:  string;
  password:    string;
}

export type LoginResult =
  | { success: true;  user: User;  error: null  }
  | { success: false; user: null;  error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Public functions
// ─────────────────────────────────────────────────────────────────────────────

export async function login(
  credentials: LoginCredentials
): Promise<LoginResult> {
  const { companyCode, employeeId, password } = credentials;

  // ── 1. Validate inputs ─────────────────────────────────────────────────────
  if (!companyCode.trim()) {
    return fail("Company code is required.");
  }
  if (!employeeId.trim()) {
    return fail("Employee ID is required.");
  }
  if (!password) {
    return fail("Password is required.");
  }

  // ── 2. Resolve and validate company ───────────────────────────────────────
  const company = await fetchCompany(companyCode.trim());
  if (!company) {
    return fail("Invalid company code.");
  }
  if (!company.active) {
    return fail("This company account is inactive. Contact support.");
  }

  // ── 3. Fetch employee ──────────────────────────────────────────────────────
  const emp = await fetchEmployee(employeeId.trim(), company.id);
  if (!emp) {
    return fail("Invalid employee ID or password.");
  }

  // ── 4. Validate employee active status ────────────────────────────────────
  if (!emp.active) {
    return fail("Your account is inactive. Contact your administrator.");
  }

  // ── 5. Validate account not locked ────────────────────────────────────────
  if (emp.account_locked) {
    return fail(
      "Your account has been locked after too many failed login attempts. " +
      "Contact your administrator to unlock it."
    );
  }

  // ── 6. Validate password ──────────────────────────────────────────────────
  const passwordValid = emp.password === password;

  if (!passwordValid) {
    await handleFailedAttempt(emp.id, emp.failed_login_attempts ?? 0);
    // Generic message — do not reveal which field was wrong
    return fail("Invalid employee ID or password.");
  }

  // ── 7. Successful login — reset counters, update timestamps ───────────────
  await handleSuccessfulLogin(emp.id);

  // ── 8. Resolve active role ────────────────────────────────────────────────
  const roleId = await resolveRoleId(emp.id);

  // ── 9. Map to User interface ──────────────────────────────────────────────
  const user: User = {
    id:            emp.id            as string,
    employeeId:    emp.employee_code as string,
    companyId:     emp.company_id    as string,
    branchId:      (emp.branch_id     as string | null) ?? "",
    departmentId:  (emp.department_id as string | null) ?? "",
    designationId: (emp.designation_id as string | null) ?? "",
    roleId,
    firstName:     (emp.first_name as string | null) ?? "",
    lastName:      (emp.last_name  as string | null) ?? "",
    email:         (emp.email      as string | null) ?? "",
    mobile:        (emp.mobile     as string | null) ?? "",
    profileImage:  "",
    status:        "active" as UserStatus,
  };

  // ── 10. Store session ─────────────────────────────────────────────────────
  setCurrentUser(user);

  return { success: true, user, error: null };
}

export async function logout(): Promise<void> {
  const { logout: clearSession } = await import("./session");
  clearSession();
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

function fail(error: string): LoginResult {
  return { success: false, user: null, error };
}

interface CompanyRow {
  id:     string;
  active: boolean;
}

async function fetchCompany(companyCode: string): Promise<CompanyRow | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, active")
    .eq("company_code", companyCode)
    .maybeSingle();

  if (error) {
    console.error("[authService] fetchCompany:", error.message);
    return null;
  }

  return data ?? null;
}

interface EmployeeRow {
  id:                    string;
  company_id:            string;
  branch_id:             string | null;
  department_id:         string | null;
  designation_id:        string | null;
  employee_code:         string;
  first_name:            string | null;
  last_name:             string | null;
  email:                 string | null;
  mobile:                string | null;
  active:                boolean;
  password:              string | null;
  failed_login_attempts: number | null;
  account_locked:        boolean | null;
}

async function fetchEmployee(
  employeeCode: string,
  companyId:    string
): Promise<EmployeeRow | null> {
  const { data, error } = await supabase
    .from("employees")
    .select(
      "id, company_id, branch_id, department_id, designation_id, " +
      "employee_code, first_name, last_name, email, mobile, active, " +
      "password, failed_login_attempts, account_locked"
    )
    .eq("employee_code", employeeCode)
    .eq("company_id",    companyId)
    .maybeSingle();

  if (error) {
    console.error("[authService] fetchEmployee:", error.message);
    return null;
  }

  return (data as EmployeeRow | null) ?? null;
}

async function handleFailedAttempt(
  employeeId:     string,
  currentAttempts: number
): Promise<void> {
  const newAttempts = currentAttempts + 1;
  const shouldLock  = newAttempts >= MAX_FAILED_ATTEMPTS;

  const updates: Record<string, unknown> = {
    failed_login_attempts: newAttempts,
  };

  if (shouldLock) {
    updates.account_locked = true;
  }

  const { error } = await supabase
    .from("employees")
    .update(updates)
    .eq("id", employeeId);

  if (error) {
    console.error("[authService] handleFailedAttempt:", error.message);
  }
}

async function handleSuccessfulLogin(employeeId: string): Promise<void> {
  const { error } = await supabase
    .from("employees")
    .update({
      failed_login_attempts: 0,
      account_locked:        false,
      last_login:            new Date().toISOString(),
    })
    .eq("id", employeeId);

  if (error) {
    console.error("[authService] handleSuccessfulLogin:", error.message);
  }
}

async function resolveRoleId(employeeDbId: string): Promise<string> {
  const { data, error } = await supabase
    .from("employee_roles")
    .select("role_id")
    .eq("employee_id", employeeDbId)
    .eq("active", true)
    .order("assigned_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[authService] resolveRoleId:", error.message);
    return "";
  }

  return (data?.role_id as string | null) ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Password change — updates password_changed_at only when password changes
// ─────────────────────────────────────────────────────────────────────────────

export interface ChangePasswordPayload {
  employeeId:      string;
  currentPassword: string;
  newPassword:     string;
}

export type ChangePasswordResult =
  | { success: true;  error: null   }
  | { success: false; error: string };

export async function changePassword(
  payload: ChangePasswordPayload
): Promise<ChangePasswordResult> {
  const { employeeId, currentPassword, newPassword } = payload;

  if (!newPassword) {
    return { success: false, error: "New password is required." };
  }

  // Fetch current password to verify before changing
  const { data: emp, error: fetchError } = await supabase
    .from("employees")
    .select("id, password")
    .eq("id", employeeId)
    .maybeSingle();

  if (fetchError || !emp) {
    return { success: false, error: "Employee not found." };
  }

  if (emp.password !== currentPassword) {
    return { success: false, error: "Current password is incorrect." };
  }

  if (emp.password === newPassword) {
    return {
      success: false,
      error: "New password must be different from the current password.",
    };
  }

  const { error: updateError } = await supabase
    .from("employees")
    .update({
      password:             newPassword,
      password_changed_at:  new Date().toISOString(),
    })
    .eq("id", employeeId);

  if (updateError) {
    console.error("[authService] changePassword:", updateError.message);
    return { success: false, error: "Failed to update password. Please try again." };
  }

  return { success: true, error: null };
}
