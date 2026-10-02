import { supabase } from "../../lib/supabase";
import type { Employee } from "../../types/employee";
import { getMyCompanyId } from "../../services/company/currentCompanyContext";

// Explicitly filtered by the caller's own company_id — see branchRepository.ts.
// Especially important here: this table holds employee PII (names, phone,
// email) across every company.
export async function getEmployees(): Promise<Employee[]> {
  const companyId = await getMyCompanyId();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("company_id", companyId)
    .order("first_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function searchEmployees(
  keyword: string
): Promise<Employee[]> {
  const companyId = await getMyCompanyId();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("company_id", companyId)
    .or(
      `employee_code.ilike.%${keyword}%,first_name.ilike.%${keyword}%,last_name.ilike.%${keyword}%,mobile.ilike.%${keyword}%,email.ilike.%${keyword}%`
    )
    .order("first_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

/** The password is never written to the employees table — it only ever
 * exists on the Supabase Auth login (see provisionEmployeeLogin). Any
 * `password` field on the payload is dropped here as a safety net. */
function withoutPassword<T extends object>(employee: T): Omit<T, "password"> {
  const { password: _ignored, ...rest } = employee as T & { password?: unknown };
  return rest;
}

export async function createEmployee(
  employee: Partial<Employee>
): Promise<Employee> {
  const { data, error } = await supabase
    .from("employees")
    .insert(withoutPassword(employee))
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateEmployee(
  id: string,
  employee: Partial<Employee>
): Promise<Employee> {
  const { data, error } = await supabase
    .from("employees")
    .update(withoutPassword(employee))
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/** For an employee already migrated to real Supabase Auth (auth_user_id
 * set) — keeps their real login password in sync whenever it's changed
 * from the admin side (Employee Management's "Reset Password"), since
 * that flow can't sign in AS the employee to change it directly. Uses a
 * service-role Edge Function; never callable with just the anon key. */
export async function syncEmployeeAuthPassword(authUserId: string, newPassword: string): Promise<void> {
  await ensureLiveSession();
  const { data, error } = await supabase.functions.invoke("update-employee-auth-password", {
    body: { authUserId, newPassword },
  });

  if (error) {
    throw new Error(await readFunctionError(error));
  }
  if (data?.success === false) {
    throw new Error(data.error ?? "Could not update the employee's login password.");
  }
}

/** Creates the employee's real login with the given password (admin only —
 * the edge function checks the caller). For an employee that has no login yet. */
export async function provisionEmployeeLogin(employeeDbId: string, password: string): Promise<void> {
  await ensureLiveSession();
  const { data, error } = await supabase.functions.invoke("provision-employee-auth", {
    body: { employeeDbId, password },
  });

  if (error) {
    throw new Error(await readFunctionError(error));
  }
  if (data?.success === false) {
    throw new Error(data.error ?? "Could not create the employee's login.");
  }
}

// supabase.functions.invoke reports any non-2xx as a generic message; the
// useful reason is in the response body.
async function readFunctionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) return friendlySessionMessage(String(body.error));
    } catch {
      // fall through
    }
  }
  return error instanceof Error ? error.message : "Request failed.";
}

const SESSION_ENDED_MESSAGE =
  "Your sign-in session has ended (for example you signed out or signed in somewhere else). Please log out, sign in again, then retry.";

function friendlySessionMessage(message: string): string {
  return /session is not valid|sign in to continue|sign in again/i.test(message) ? SESSION_ENDED_MESSAGE : message;
}

/** Asks the sign-in service whether this browser's session is still alive (and refreshes it if it can).
 *  Used BEFORE actions that need the server to know who you are, so the problem is explained up front
 *  instead of after a half-finished save. */
export async function ensureLiveSession(): Promise<void> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error(SESSION_ENDED_MESSAGE);
}

export async function deleteEmployee(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function toggleEmployeeStatus(
  id: string,
  active: boolean
): Promise<void> {
  const { error } = await supabase
    .from("employees")
    .update({
      active,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

// FILE COMPLETE
