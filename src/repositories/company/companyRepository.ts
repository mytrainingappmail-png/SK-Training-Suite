import { supabase } from "../../lib/supabase";
import type { Company, CompanyForm } from "../../types/company";

// Resolves via get_my_company() (SECURITY DEFINER, keyed off
// current_employee_company_id()) rather than a bare table select — a
// platform operator can see every company's row under RLS, so a plain
// `.limit(1)` with no filter would return an arbitrary one instead of
// reliably "my own company".
export async function getCompany(): Promise<Company | null> {
  const { data, error } = await supabase.rpc("get_my_company");

  if (error) {
    console.error(error);
    return null;
  }

  return data;
}

export async function getCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("company_name", { ascending: true });

  if (error) {
    console.error(error);
    throw error;
  }

  return data ?? [];
}

export async function createCompany(company: CompanyForm): Promise<Company> {
  const { data, error } = await supabase
    .from("companies")
    .insert(company)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}

export async function updateCompany(
  id: string,
  company: Partial<Company>
): Promise<Company> {
  const { data, error } = await supabase
    .from("companies")
    .update(company)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return data;
}