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

// Permanently erases a company and (via 60+ `on delete cascade` foreign
// keys already in the schema) every row it owns — employees, courses,
// enrollments, certificates, license/billing history, everything.
// Irreversible. Two tables reference companies WITHOUT cascade
// (`assessment_assignments`, `learning_path_enrollments` — both
// RESTRICT/NO ACTION) and would otherwise make the final delete fail
// with a raw foreign-key-violation error, so their rows for this company
// are cleared explicitly first.
export async function deleteCompany(id: string): Promise<void> {
  const cleanup = await Promise.all([
    supabase.from("assessment_assignments").delete().eq("company_id", id),
    supabase.from("learning_path_enrollments").delete().eq("company_id", id),
  ]);
  for (const { error } of cleanup) {
    if (error) throw error;
  }

  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) {
    console.error(error);
    throw error;
  }
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