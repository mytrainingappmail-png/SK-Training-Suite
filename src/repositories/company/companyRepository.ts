import { supabase } from "../../lib/supabase";
import type { Company } from "../../types/company";

export async function getCompany(): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .limit(1)
    .single();

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