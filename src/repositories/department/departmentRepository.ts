import { supabase } from "../../lib/supabase";
import type { Department } from "../../types/department";
import { getMyCompanyId } from "../../services/company/currentCompanyContext";

// Explicitly filtered by the caller's own company_id — see branchRepository.ts.
export async function getDepartments(): Promise<Department[]> {
  const companyId = await getMyCompanyId();
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .eq("company_id", companyId)
    .order("department_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function searchDepartments(
  keyword: string
): Promise<Department[]> {
  const companyId = await getMyCompanyId();
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .eq("company_id", companyId)
    .or(
      `department_name.ilike.%${keyword}%,department_code.ilike.%${keyword}%,description.ilike.%${keyword}%`
    )
    .order("department_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createDepartment(
  department: Partial<Department>
): Promise<Department> {
  const { data, error } = await supabase
    .from("departments")
    .insert(department)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateDepartment(
  id: string,
  department: Partial<Department>
): Promise<Department> {
  const { data, error } = await supabase
    .from("departments")
    .update(department)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteDepartment(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function toggleDepartmentStatus(
  id: string,
  active: boolean
): Promise<void> {
  const { error } = await supabase
    .from("departments")
    .update({
      active,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

// FILE COMPLETE
