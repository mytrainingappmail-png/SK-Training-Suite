import { supabase } from "../../lib/supabase";
import type { EmployeeRole } from "../../types/employeeRole";
import type { EmployeeRoleForm } from "../../types/employeeRole";

export async function getEmployeeRoles(): Promise<EmployeeRole[]> {
  const { data, error } = await supabase
    .from("employee_roles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[employeeRoleRepository] getEmployeeRoles:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getEmployeeRole(id: string): Promise<EmployeeRole> {
  const { data, error } = await supabase
    .from("employee_roles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[employeeRoleRepository] getEmployeeRole:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function createEmployeeRole(
  item: EmployeeRoleForm
): Promise<EmployeeRole> {
  const { data, error } = await supabase
    .from("employee_roles")
    .insert(item)
    .select()
    .single();

  if (error) {
    console.error("[employeeRoleRepository] createEmployeeRole:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateEmployeeRole(
  id: string,
  item: Partial<EmployeeRoleForm>
): Promise<EmployeeRole> {
  const { data, error } = await supabase
    .from("employee_roles")
    .update(item)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[employeeRoleRepository] updateEmployeeRole:", error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteEmployeeRole(id: string): Promise<void> {
  const { error } = await supabase
    .from("employee_roles")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[employeeRoleRepository] deleteEmployeeRole:", error);
    throw new Error(error.message);
  }
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<EmployeeRole> {
  const { data, error } = await supabase
    .from("employee_roles")
    .update({ active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[employeeRoleRepository] toggleActive:", error);
    throw new Error(error.message);
  }

  return data;
}
