// File: src/services/auth/authService.ts
//
// SECURITY MIGRATION — Phase 2.
//
// Employees who have been migrated (employees.auth_user_id is set) now
// log in through REAL Supabase Auth (supabase.auth.signInWithPassword).
// This gives every subsequent database request a real, verifiable
// identity, which is what allows RLS policies to actually restrict
// data by company — something the old plaintext-password check could
// never support.
//
// Employees who have NOT been migrated yet (auth_user_id is still
// null) continue to log in exactly the old way, with zero change in
// behaviour — nobody is locked out during the gradual migration.
//
// The User object returned to the rest of the app, and the
// setCurrentUser() call, are UNCHANGED — every existing file that
// calls getCurrentUser() keeps working exactly as before.
//
// Verified import paths from src/services/auth/:
//   ../../lib/supabase      → src/lib/supabase.ts             (exports: supabase)
//   ./session               → src/services/auth/session.ts    (exports: setCurrentUser)
//   ../../types/app         → src/types/app.ts                (exports: User, UserStatus)

import { supabase }       from "../../lib/supabase";
import { setCurrentUser } from "./session";
import { getSettingNumber } from "../setting/settingService";

import type { User, UserStatus } from "../../types/app";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

// Default when no active "max_login_attempts" Setting exists — an admin can
// override this from Settings Management without any code change.
const DEFAULT_MAX_FAILED_ATTEMPTS = 5;

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
  // Company Code is optional — employee_code is only guaranteed unique
  // WITHIN a company, so without it every active company is searched for
  // a match instead. A code is still honored when typed (unchanged path),
  // useful if the same employee_code happens to exist in more than one
  // company, or an admin just prefers to scope it explicitly.
  if (!employeeId.trim()) {
    return fail("Employee ID is required.");
  }
  if (!password) {
    return fail("Password is required.");
  }

  // ── 2. Find every employee this could be ──────────────────────────────────
  let candidates: EmployeeRowWithCode[];

  if (companyCode.trim()) {
    const company = await fetchCompany(companyCode.trim());
    if (!company) {
      return fail("Invalid company code.");
    }
    if (!company.active) {
      return fail("This company account is inactive. Contact support.");
    }
    const emp = await fetchEmployee(employeeId.trim(), company.id);
    candidates = emp ? [{ ...emp, company_code: companyCode.trim() }] : [];
  } else {
    candidates = await fetchEmployeeAnyCompany(employeeId.trim());
  }

  if (candidates.length === 0) {
    return fail("Invalid employee ID or password.");
  }

  // ── 3. Try each candidate's password — real Supabase Auth if migrated,
  //      legacy check otherwise — until one matches. In the overwhelming
  //      majority of cases there's exactly one candidate anyway. ────────────
  let matched: EmployeeRowWithCode | null = null;
  for (const candidate of candidates) {
    const passwordValid = candidate.auth_user_id
      ? await validateViaSupabaseAuth(candidate.company_code, candidate.employee_code as string, password)
      : candidate.password === password;
    if (passwordValid) {
      matched = candidate;
      break;
    }
  }

  if (!matched) {
    await handleFailedAttempt(candidates[0].id, candidates[0].failed_login_attempts ?? 0);
    // Generic message — do not reveal which field was wrong
    return fail("Invalid employee ID or password.");
  }

  // ── 4. Validate the matched employee's active/locked status ───────────────
  if (!matched.active) {
    return fail("Your account is inactive. Contact your administrator.");
  }
  if (matched.account_locked) {
    return fail(
      "Your account has been locked after too many failed login attempts. " +
      "Contact your administrator to unlock it."
    );
  }

  // ── 5. Successful login — reset counters, update timestamps ───────────────
  await handleSuccessfulLogin(matched.id);

  // ── 6. Resolve active role ────────────────────────────────────────────────
  const roleId = await resolveRoleId(matched.id);

  // ── 7. Map to User interface ──────────────────────────────────────────────
  const user: User = {
    id:            matched.id            as string,
    employeeId:    matched.employee_code as string,
    companyId:     matched.company_id    as string,
    branchId:      (matched.branch_id     as string | null) ?? "",
    departmentId:  (matched.department_id as string | null) ?? "",
    designationId: (matched.designation_id as string | null) ?? "",
    roleId,
    firstName:     (matched.first_name as string | null) ?? "",
    lastName:      (matched.last_name  as string | null) ?? "",
    email:         (matched.email      as string | null) ?? "",
    mobile:        (matched.mobile     as string | null) ?? "",
    profileImage:  "",
    status:        "active" as UserStatus,
  };

  // ── 8. Store session ───────────────────────────────────────────────────────
  setCurrentUser(user);

  return { success: true, user, error: null };
}

export async function logout(): Promise<void> {
  // Also end the real Supabase Auth session (harmless no-op for
  // employees who were never migrated — signOut() just does nothing
  // if there was no real session to begin with).
  await supabase.auth.signOut();

  const { logout: clearSession } = await import("./session");
  clearSession();

  const { invalidateMyCompanyId } = await import("../company/currentCompanyContext");
  invalidateMyCompanyId();
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

function fail(error: string): LoginResult {
  return { success: false, user: null, error };
}

export function internalEmailFor(companyCode: string, employeeCode: string): string {
  return `${companyCode.toLowerCase()}.${employeeCode.toLowerCase()}@internal.sktraining`;
}

/**
 * Signs in through real Supabase Auth. On success, Supabase stores a
 * real, verifiable session on the shared client — every future
 * .from() call the app makes will carry this identity, which is what
 * lets RLS policies scope data to the employee's own company.
 */
async function validateViaSupabaseAuth(
  companyCode: string,
  employeeCode: string,
  password: string
): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({
    email: internalEmailFor(companyCode, employeeCode),
    password,
  });

  if (error) {
    console.error("[authService] validateViaSupabaseAuth:", error.message);
    return false;
  }

  return true;
}

interface CompanyRow {
  id:     string;
  active: boolean;
}

async function fetchCompany(companyCode: string): Promise<CompanyRow | null> {
  // Runs before any Supabase Auth session exists (that's the point of a
  // login call), so this goes through a SECURITY DEFINER RPC rather than
  // a direct table query — the anon key has no standing access to
  // `companies` at all now that RLS is enforced.
  const { data, error } = await supabase.rpc("get_company_for_login", {
    p_company_code: companyCode,
  });

  if (error) {
    console.error("[authService] fetchCompany:", error.message);
    return null;
  }

  return (data as CompanyRow[] | null)?.[0] ?? null;
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
  auth_user_id:          string | null;
}

async function fetchEmployee(
  employeeCode: string,
  companyId:    string
): Promise<EmployeeRow | null> {
  // Also pre-session (see fetchCompany above) — routed through a SECURITY
  // DEFINER RPC so `employees` (names, mobiles, password field) never needs
  // an anon-accessible policy.
  const { data, error } = await supabase.rpc("login_lookup_employee", {
    p_employee_code: employeeCode,
    p_company_id:    companyId,
  });

  if (error) {
    console.error("[authService] fetchEmployee:", error.message);
    return null;
  }

  return (data as EmployeeRow[] | null)?.[0] ?? null;
}

interface EmployeeRowWithCode extends EmployeeRow {
  company_code: string;
}

/** No company code typed — searches every active company for a matching
 * employee_code. Normally returns at most one row; a second only shows up
 * if two different companies happen to share the exact same employee
 * code, in which case login() tries each candidate's password in turn. */
async function fetchEmployeeAnyCompany(employeeCode: string): Promise<EmployeeRowWithCode[]> {
  const { data, error } = await supabase.rpc("login_lookup_employee_any_company", {
    p_employee_code: employeeCode,
  });

  if (error) {
    console.error("[authService] fetchEmployeeAnyCompany:", error.message);
    return [];
  }

  return (data as EmployeeRowWithCode[] | null) ?? [];
}

async function handleFailedAttempt(
  employeeId:     string,
  currentAttempts: number
): Promise<void> {
  const newAttempts = currentAttempts + 1;
  const maxAttempts = await getSettingNumber("max_login_attempts", DEFAULT_MAX_FAILED_ATTEMPTS);
  const shouldLock  = newAttempts >= maxAttempts;

  // Still pre-session — a wrong password never establishes a Supabase
  // Auth session, so this also has to go through the RPC.
  const { error } = await supabase.rpc("login_record_failed_attempt", {
    p_employee_id:  employeeId,
    p_new_attempts: newAttempts,
    p_lock:         shouldLock,
  });

  if (error) {
    console.error("[authService] handleFailedAttempt:", error.message);
  }
}

async function handleSuccessfulLogin(employeeId: string): Promise<void> {
  const { error } = await supabase.rpc("login_record_successful_login", {
    p_employee_id: employeeId,
  });

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
  if (newPassword.length < 6) {
    return { success: false, error: "New password must be at least 6 characters." };
  }
  if (currentPassword === newPassword) {
    return {
      success: false,
      error: "New password must be different from the current password.",
    };
  }

  const { data: emp, error: fetchError } = await supabase
    .from("employees")
    .select("id, password, auth_user_id, employee_code, companies(company_code)")
    .eq("id", employeeId)
    .maybeSingle();

  if (fetchError || !emp) {
    return { success: false, error: "Employee not found." };
  }

  // Migrated employees actually authenticate against real Supabase Auth,
  // not the legacy password column below — so verifying/changing their
  // password has to go through it too, or the column ends up saying one
  // thing while the real login still expects another (the exact bug that
  // was locking migrated employees out after any password change).
  if (emp.auth_user_id) {
    const companiesJoin = emp.companies as { company_code: string } | { company_code: string }[] | null;
    const companyCode = Array.isArray(companiesJoin) ? companiesJoin[0]?.company_code : companiesJoin?.company_code;
    if (!companyCode) {
      return { success: false, error: "Could not resolve your company. Please contact support." };
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: internalEmailFor(companyCode, emp.employee_code as string),
      password: currentPassword,
    });
    if (signInError) {
      return { success: false, error: "Current password is incorrect." };
    }

    const { error: updateAuthError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateAuthError) {
      console.error("[authService] changePassword (auth):", updateAuthError.message);
      return { success: false, error: "Failed to update password. Please try again." };
    }
  } else if (emp.password !== currentPassword) {
    return { success: false, error: "Current password is incorrect." };
  }

  // Kept in sync either way — still what non-migrated employees actually
  // log in with, and read/displayed elsewhere for migrated ones too.
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