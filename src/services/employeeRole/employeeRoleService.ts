import type { EmployeeRole } from "../../types/employeeRole";
import type { EmployeeRoleForm } from "../../types/employeeRole";

import {
  getEmployeeRoles,
  createEmployeeRole as repositoryCreate,
  updateEmployeeRole,
  deleteEmployeeRole,
  toggleActive as repositoryToggleActive,
} from "../../repositories/employeeRole/employeeRoleRepository";

export async function loadEmployeeRoles(): Promise<EmployeeRole[]> {
  return await getEmployeeRoles();
}

export async function createEmployeeRole(
  data: EmployeeRoleForm
): Promise<EmployeeRole> {
  validateForm(data);

  const existing = await getEmployeeRoles();
  assertNoDuplicate(data, existing);

  return await repositoryCreate(data);
}

export async function saveEmployeeRole(
  id: string,
  data: EmployeeRoleForm
): Promise<EmployeeRole> {
  if (!id) throw new Error("Invalid Employee Role ID.");
  validateForm(data);

  const existing = await getEmployeeRoles();
  assertNoDuplicate(data, existing, id);

  return await updateEmployeeRole(id, data);
}

export async function removeEmployeeRole(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Employee Role ID.");
  await deleteEmployeeRole(id);
}

export async function toggleActive(
  id: string,
  active: boolean
): Promise<EmployeeRole> {
  if (!id) throw new Error("Invalid Employee Role ID.");
  return await repositoryToggleActive(id, active);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(data: EmployeeRoleForm): void {
  if (!data.employee_id) {
    throw new Error("Employee is required.");
  }

  if (!data.role_id) {
    throw new Error("Role is required.");
  }

  if (!data.assigned_date) {
    throw new Error("Assigned Date is required.");
  }
}

function assertNoDuplicate(
  data: EmployeeRoleForm,
  existing: EmployeeRole[],
  excludeId?: string
): void {
  const duplicate = existing.find(
    (er) =>
      er.employee_id === data.employee_id &&
      er.role_id     === data.role_id &&
      (excludeId === undefined || er.id !== excludeId)
  );

  if (duplicate) {
    throw new Error(
      "This role is already assigned to the selected employee."
    );
  }
}
