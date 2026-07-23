import { supabase } from "../../lib/supabase";

// Safe to call with no session — the request_password_reset SECURITY
// DEFINER RPC looks up the company/employee itself and never reveals
// whether either part was valid (same generic-failure principle as login).
export async function requestPasswordReset(companyCode: string, employeeCode: string): Promise<void> {
  const { error } = await supabase.rpc("request_password_reset", {
    p_company_code: companyCode,
    p_employee_code: employeeCode,
  });

  if (error) {
    console.error("[passwordResetRepository] requestPasswordReset:", error);
    throw new Error(error.message);
  }
}
