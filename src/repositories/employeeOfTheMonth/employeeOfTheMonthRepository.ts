import { supabase } from "../../lib/supabase";
import type { EmployeeOfTheMonth, EmployeeOfTheMonthForm } from "../../types/employeeOfTheMonth";

export async function getAll(): Promise<EmployeeOfTheMonth[]> {
  const { data, error } = await supabase
    .from("employee_of_the_month")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function create(
  form: EmployeeOfTheMonthForm & { company_id: string; created_by: string | null }
): Promise<EmployeeOfTheMonth> {
  const { data, error } = await supabase.from("employee_of_the_month").insert(form).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function update(id: string, form: Partial<EmployeeOfTheMonthForm>): Promise<EmployeeOfTheMonth> {
  const { data, error } = await supabase.from("employee_of_the_month").update(form).eq("id", id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from("employee_of_the_month").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
