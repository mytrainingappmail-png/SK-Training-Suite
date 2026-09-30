// File: src/services/auth/authService.ts
//
// Every employee logs in through REAL Supabase Auth
// (supabase.auth.signInWithPassword). That gives each database request a
// verifiable identity, which is what lets RLS policies restrict data by
// company. There is no fallback password check any more: an employee without a
// login (auth_user_id) is told to contact their administrator, who creates the
// login from Employee Management.
//
// Before sign-in there is no session, so the lookups go through narrow
// SECURITY DEFINER RPCs that reveal only what the login screen needs
// (canonical codes, active/locked state) — never a password, id or personal
// details. Failed attempts are counted and locked on the SERVER
// (login_record_failed), never from client-supplied counters.
//
// The User object returned to the rest of the app, and the setCurrentUser()
// call, are unchanged — every file that calls getCurrentUser() keeps working.
//
// Verified import paths from src/services/auth/:
//   ../../lib/supabase      → src/lib/supabase.ts             (exports: supabase)
//   ./session               → src/services/auth/session.ts    (exports: setCurrentUser)
//   ../../types/app         → src/types/app.ts                (exports: User, UserStatus)

import { supabase }       from "../../lib/supabase";
import { setCurrentUser } from "./session";

import type { User, UserStatus } from "../../types/app";

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
  // a match instead. A code is still honored when typed.
  //
  // The "Employee ID" field also doubles as an email field — the lookup
  // matches employee_code OR email (case-insensitive).
  if (!employeeId.trim()) {
    return fail("Employee ID or email is required.");
  }
  if (!password) {
    return fail("Password is required.");
  }

  // ── 2. Find every employee this could be ──────────────────────────────────
  let candidates: LoginCandidate[];

  if (companyCode.trim()) {
    const company = await fetchCompany(companyCode.trim());
    if (!company) {
      return fail("Invalid company code.");
    }
    if (!company.active) {
      return fail("This company account is inactive. Contact support.");
    }
    candidates = await lookupCandidates(employeeId.trim(), companyCode.trim());
  } else {
    const allCandidates = await lookupCandidates(employeeId.trim(), null);
    // A Super Admin (the company owner's role) is the highest-value
    // account in each company, and employee_code is just a sequential
    // number — every company's owner ends up as "00001". Left in the
    // no-code fallback, that means one guessed password gets tried
    // against every company's owner at once. Super Admin accounts are
    // excluded from this path entirely; they must log in with a Company
    // Code (typed, or via the /:companyCode branded link) instead.
    const nonSuperAdmin = allCandidates.filter((c) => !c.is_super_admin);
    if (nonSuperAdmin.length === 0 && allCandidates.length > 0) {
      return fail("This account requires a Company Code. Please enter it above, or use your company's login link.");
    }
    candidates = nonSuperAdmin;
  }

  if (candidates.length === 0) {
    return fail("Invalid employee ID/email or password.");
  }

  // ── 3. Try each candidate's password against real Supabase Auth until one
  //      matches. Locked candidates are skipped without trying the password.
  //      In the overwhelming majority of cases there's exactly one. ─────────
  let signedInAs: LoginCandidate | null = null;
  let firstTried: LoginCandidate | null = null;
  let lockedCandidate: LoginCandidate | null = null;
  let anyWithoutLogin = false;

  for (const candidate of candidates) {
    if (!candidate.has_login) {
      anyWithoutLogin = true;
      continue;
    }
    if (candidate.is_locked) {
      lockedCandidate = lockedCandidate ?? candidate;
      continue;
    }
    firstTried = firstTried ?? candidate;
    if (await validateViaSupabaseAuth(candidate.company_code, candidate.employee_code, password)) {
      signedInAs = candidate;
      break;
    }
  }

  if (!signedInAs) {
    if (firstTried) {
      await recordFailedAttempt(firstTried);
      // Generic message — do not reveal which field was wrong
      return fail("Invalid employee ID/email or password.");
    }
    if (lockedCandidate) return fail(lockedMessage(lockedCandidate));
    if (anyWithoutLogin) {
      return fail("Your login has not been set up yet. Contact your administrator.");
    }
    return fail("Invalid employee ID/email or password.");
  }

  // ── 4. Load the signed-in employee's own row (row-level security lets
  //      them read it) and validate active status ────────────────────────────
  const { data: userData } = await supabase.auth.getUser();
  const authUserId = userData?.user?.id;
  const { data: matched, error: rowError } = authUserId
    ? await supabase.from("employees").select("*").eq("auth_user_id", authUserId).maybeSingle()
    : { data: null, error: null };

  if (rowError || !matched) {
    await supabase.auth.signOut();
    return fail("Could not load your profile. Please try again or contact your administrator.");
  }
  if (!matched.active) {
    await supabase.auth.signOut();
    return fail("Your account is inactive. Contact your administrator.");
  }
  if (matched.account_locked) {
    await supabase.auth.signOut();
    return fail(
      "Your account has been locked. Contact your administrator to unlock it."
    );
  }

  // ── 5. Successful login — reset counters, update timestamps ───────────────
  await recordSuccessfulLogin();

  // ── 6. Resolve active role ────────────────────────────────────────────────
  const roleId = await resolveRoleId(matched.id as string);

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

/** What the login screen is allowed to know about an employee before they
 * have proved who they are. Deliberately no id, password or personal data. */
interface LoginCandidate {
  company_code:   string;
  employee_code:  string;
  active:         boolean;
  is_locked:      boolean;
  locked_until:   string | null;
  is_super_admin: boolean;
  has_login:      boolean;
}

/** Searches by employee code or email — inside one company when a company
 * code is given, otherwise across every active company (normally one match;
 * a second only appears if two companies share the same employee code, in
 * which case login() tries each candidate's password in turn). */
async function lookupCandidates(
  employeeCodeOrEmail: string,
  companyCode: string | null
): Promise<LoginCandidate[]> {
  const { data, error } = await supabase.rpc("login_lookup", {
    p_employee_code: employeeCodeOrEmail,
    p_company_code:  companyCode,
  });

  if (error) {
    console.error("[authService] lookupCandidates:", error.message);
    return [];
  }

  return (data as LoginCandidate[] | null) ?? [];
}

function lockedMessage(candidate: LoginCandidate): string {
  if (candidate.locked_until) {
    const minutes = Math.max(1, Math.ceil((new Date(candidate.locked_until).getTime() - Date.now()) / 60000));
    return `Too many failed sign-in attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}, or contact your administrator.`;
  }
  return "Your account has been locked. Contact your administrator to unlock it.";
}

async function recordFailedAttempt(candidate: LoginCandidate): Promise<void> {
  // Still pre-session — a wrong password never establishes a Supabase Auth
  // session, so this goes through the RPC, which counts and locks on the
  // server (the lock threshold comes from the max_login_attempts setting).
  const { error } = await supabase.rpc("login_record_failed", {
    p_company_code:  candidate.company_code,
    p_employee_code: candidate.employee_code,
  });

  if (error) {
    console.error("[authService] recordFailedAttempt:", error.message);
  }
}

async function recordSuccessfulLogin(): Promise<void> {
  // Signed in by now; the RPC acts on the caller's own employee row only.
  const { error } = await supabase.rpc("login_record_success");

  if (error) {
    console.error("[authService] recordSuccessfulLogin:", error.message);
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
    .select("id, auth_user_id, employee_code, companies(company_code)")
    .eq("id", employeeId)
    .maybeSingle();

  if (fetchError || !emp) {
    return { success: false, error: "Employee not found." };
  }
  if (!emp.auth_user_id) {
    return { success: false, error: "Your login has not been set up yet. Contact your administrator." };
  }

  const companiesJoin = emp.companies as { company_code: string } | { company_code: string }[] | null;
  const companyCode = Array.isArray(companiesJoin) ? companiesJoin[0]?.company_code : companiesJoin?.company_code;
  if (!companyCode) {
    return { success: false, error: "Could not resolve your company. Please contact support." };
  }

  // Verify the current password by signing in with it, then change it on the
  // real login. (Nothing about the password is stored anywhere else.)
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

  const { error: updateError } = await supabase
    .from("employees")
    .update({ password_changed_at: new Date().toISOString() })
    .eq("id", employeeId);

  if (updateError) {
    // The password itself did change; only the timestamp failed.
    console.error("[authService] changePassword (timestamp):", updateError.message);
  }

  return { success: true, error: null };
}
