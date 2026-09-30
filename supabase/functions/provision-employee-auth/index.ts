// supabase/functions/provision-employee-auth/index.ts
//
// Creates an employee's real Supabase Auth login (internal email derived from
// company code + employee code) with the password an administrator chose, and
// links it to the employee row. Used when an admin creates an employee (single
// add, CSV import, company onboarding) and to migrate any legacy employee that
// has no login yet.
//
// Requires the SERVICE ROLE key internally, so the caller is authenticated
// here: they must be a company administrator (or an administrator of the
// platform-operator company), and the employee must not already have a login.
// Company code and employee code are read from the database, never trusted
// from the request.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import {
  assertCanAdminister,
  corsHeaders,
  HttpError,
  jsonResponse,
  requireEmployeeCaller,
  serviceClient,
} from "../_shared/auth.ts";

interface ProvisionRequest {
  employeeDbId: string;
  password: string;
  // Accepted for backwards compatibility with older clients; ignored.
  companyCode?: string;
  employeeCode?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = serviceClient();
    const caller = await requireEmployeeCaller(req, admin);

    const payload: ProvisionRequest = await req.json();
    if (!payload.employeeDbId || !payload.password) {
      throw new HttpError(400, "employeeDbId and password are required.");
    }
    if (payload.password.length < 6) {
      throw new HttpError(400, "Password must be at least 6 characters.");
    }

    const { data: target, error: targetError } = await admin
      .from("employees")
      .select("id, company_id, employee_code, auth_user_id, companies(company_code)")
      .eq("id", payload.employeeDbId)
      .maybeSingle();
    if (targetError) throw new HttpError(500, "Could not load the employee.");
    if (!target) throw new HttpError(404, "Employee not found.");

    assertCanAdminister(caller, target.company_id as string);

    if (target.auth_user_id) {
      throw new HttpError(409, "This employee already has a login. Use Reset Password instead.");
    }

    const companies = target.companies as { company_code: string } | { company_code: string }[] | null;
    const companyCode = (Array.isArray(companies) ? companies[0]?.company_code : companies?.company_code) ?? "";
    if (!companyCode) throw new HttpError(500, "Could not resolve the employee's company.");

    const internalEmail = `${companyCode.toLowerCase()}.${String(target.employee_code).toLowerCase()}@internal.sktraining`;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: internalEmail,
      password: payload.password,
      email_confirm: true,
    });
    if (createError) throw new HttpError(400, createError.message);

    const { error: linkError } = await admin
      .from("employees")
      .update({ auth_user_id: created.user.id, password_changed_at: new Date().toISOString() })
      .eq("id", target.id)
      .is("auth_user_id", null);

    if (linkError) {
      // Don't leave an orphan login that nobody can use or clean up.
      await admin.auth.admin.deleteUser(created.user.id);
      throw new HttpError(500, "Could not link the login to the employee.");
    }

    return jsonResponse({ success: true, authUserId: created.user.id, internalEmail });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse({ success: false, error: err.message }, err.status);
    }
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, 400);
  }
});
