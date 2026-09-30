// supabase/functions/update-employee-auth-password/index.ts
//
// Lets a company administrator reset an employee's login password (Employee
// Management → Reset Password). Employees changing their OWN password do that
// directly with supabase.auth.updateUser and never come through here.
//
// Runs with the SERVICE ROLE key, so the caller is authenticated: they must be
// an administrator of the target employee's company (or of the platform-
// operator company). Without this check, anybody holding the public anon key
// and an employee's auth id could take over that account.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import {
  assertCanAdminister,
  corsHeaders,
  HttpError,
  jsonResponse,
  requireEmployeeCaller,
  serviceClient,
} from "../_shared/auth.ts";

interface UpdateRequest {
  authUserId: string;
  newPassword: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = serviceClient();
    const caller = await requireEmployeeCaller(req, admin);

    const payload: UpdateRequest = await req.json();
    if (!payload.authUserId || !payload.newPassword) {
      throw new HttpError(400, "authUserId and newPassword are both required.");
    }
    if (payload.newPassword.length < 6) {
      throw new HttpError(400, "Password must be at least 6 characters.");
    }

    const { data: target, error: targetError } = await admin
      .from("employees")
      .select("id, company_id")
      .eq("auth_user_id", payload.authUserId)
      .maybeSingle();
    if (targetError) throw new HttpError(500, "Could not load the employee.");
    if (!target) throw new HttpError(404, "Employee not found.");

    assertCanAdminister(caller, target.company_id as string);

    const { error } = await admin.auth.admin.updateUserById(payload.authUserId, {
      password: payload.newPassword,
    });
    if (error) throw new HttpError(400, error.message);

    await admin
      .from("employees")
      .update({ password_changed_at: new Date().toISOString() })
      .eq("id", target.id);

    return jsonResponse({ success: true });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse({ success: false, error: err.message }, err.status);
    }
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, 400);
  }
});
