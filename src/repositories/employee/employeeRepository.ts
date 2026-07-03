import { supabase } from "../../lib/supabase";
import type { Employee } from "../../types/employee";

export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("first_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function searchEmployees(
  keyword: string
): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .or(
      `employee_code.ilike.%${keyword}%,first_name.ilike.%${keyword}%,last_name.ilike.%${keyword}%,mobile.ilike.%${keyword}%,email.ilike.%${keyword}%`
    )
    .order("first_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createEmployee(
  employee: Partial<Employee>
): Promise<Employee> {
  const { data, error } = await supabase
    .from("employees")
    .insert(employee)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateEmployee(
  id: string,
  employee: Partial<Employee>
): Promise<Employee> {
  const { data, error } = await supabase
    .from("employees")
    .update(employee)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteEmployee(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function toggleEmployeeStatus(
  id: string,
  active: boolean
): Promise<void> {
  const { error } = await supabase
    .from("employees")
    .update({
      active,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

// FILE COMPLETE
