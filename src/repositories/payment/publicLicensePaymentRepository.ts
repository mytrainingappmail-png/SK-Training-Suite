import { supabase } from "../../lib/supabase";

export interface PublicLicensePaymentInfo {
  company_id: string;
  company_name: string;
  company_email: string;
  plan_id: string;
  plan_name: string;
  amount_in_rupees: number;
  billing_cycle: "monthly" | "yearly";
  status: string;
}

// Works with no session (anon) — get_public_license_payment_info() is a
// SECURITY DEFINER function scoped to exactly one license id, safe to call
// pre-login from the public /pay/:licenseId page.
export async function getPublicLicensePaymentInfo(licenseId: string): Promise<PublicLicensePaymentInfo | null> {
  const { data, error } = await supabase.rpc("get_public_license_payment_info", { p_license_id: licenseId });

  if (error) {
    console.error("[publicLicensePaymentRepository] getPublicLicensePaymentInfo:", error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}
