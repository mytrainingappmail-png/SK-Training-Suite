// Closing, reopening and exporting a customer's account (platform owner only; the database
// functions check that again, so a normal user cannot call them even by hand).

import { supabase } from "../../lib/supabase";

function fail(label: string, error: { message: string }): never {
  console.error(`[accountLifecycleRepository] ${label}:`, error);
  throw new Error(error.message);
}

/** The company can no longer sign in. Nothing is deleted. */
export async function offboardCompany(companyId: string): Promise<void> {
  const { error } = await supabase.rpc("offboard_company", { p_company_id: companyId });
  if (error) fail("offboardCompany", error);
}

export async function reinstateCompany(companyId: string): Promise<void> {
  const { error } = await supabase.rpc("reinstate_company", { p_company_id: companyId });
  if (error) fail("reinstateCompany", error);
}

/** A portable copy of the company's core records, to hand back when it leaves. */
export async function exportCompanyData(companyId: string): Promise<unknown> {
  const { data, error } = await supabase.rpc("export_company_data", { p_company_id: companyId });
  if (error) fail("exportCompanyData", error);
  return data;
}
