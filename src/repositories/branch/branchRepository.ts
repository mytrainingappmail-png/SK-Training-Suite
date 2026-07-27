import { supabase } from "../../lib/supabase";
import type { Branch } from "../../types/branch";
import { getMyCompanyId } from "../../services/company/currentCompanyContext";

// Explicitly filtered by the caller's own company_id rather than relying
// on RLS alone — a platform operator can see every company's branches
// under RLS (needed for onboarding), so this would otherwise return
// every company's branches mixed together for that operator.
export async function getBranches(): Promise<Branch[]> {
  const companyId = await getMyCompanyId();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("company_id", companyId)
    .order("branch_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function searchBranches(
  keyword: string
): Promise<Branch[]> {
  const companyId = await getMyCompanyId();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("company_id", companyId)
    .or(
      `branch_name.ilike.%${keyword}%,branch_code.ilike.%${keyword}%,city.ilike.%${keyword}%`
    )
    .order("branch_name");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createBranch(
  branch: Partial<Branch>
): Promise<Branch> {
  const { data, error } = await supabase
    .from("branches")
    .insert(branch)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateBranch(
  id: string,
  branch: Partial<Branch>
): Promise<Branch> {
  const { data, error } = await supabase
    .from("branches")
    .update(branch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteBranch(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("branches")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function toggleBranchStatus(
  id: string,
  active: boolean
): Promise<void> {
  const { error } = await supabase
    .from("branches")
    .update({
      active,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function toggleHeadOffice(
  id: string,
  headOffice: boolean
): Promise<void> {
  const { error } = await supabase
    .from("branches")
    .update({
      head_office: headOffice,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}