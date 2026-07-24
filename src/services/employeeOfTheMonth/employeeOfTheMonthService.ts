import {
  getAll,
  create as repoCreate,
  update,
  remove,
} from "../../repositories/employeeOfTheMonth/employeeOfTheMonthRepository";
import { getCurrentUser } from "../auth/session";
import type { EmployeeOfTheMonth, EmployeeOfTheMonthForm } from "../../types/employeeOfTheMonth";

export async function loadAll(): Promise<EmployeeOfTheMonth[]> {
  return getAll();
}

export async function loadCurrent(): Promise<EmployeeOfTheMonth | null> {
  const all = await getAll();
  return all[0] ?? null;
}

function validateForm(form: EmployeeOfTheMonthForm): void {
  if (!form.employee_id) throw new Error("Employee is required.");
  if (!form.month || form.month < 1 || form.month > 12) throw new Error("Invalid month.");
  if (!form.year) throw new Error("Year is required.");
}

export async function saveEntry(form: EmployeeOfTheMonthForm): Promise<EmployeeOfTheMonth> {
  validateForm(form);
  const user = getCurrentUser();
  if (!user?.companyId) throw new Error("No active company.");
  return repoCreate({ ...form, company_id: user.companyId, created_by: user.id ?? null });
}

export async function editEntry(id: string, form: Partial<EmployeeOfTheMonthForm>): Promise<EmployeeOfTheMonth> {
  if (!id) throw new Error("Invalid entry ID.");
  return update(id, form);
}

export async function removeEntry(id: string): Promise<void> {
  await remove(id);
}
