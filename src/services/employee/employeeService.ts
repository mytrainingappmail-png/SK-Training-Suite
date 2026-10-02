import type { Employee } from "../../types/employee";

import {
  getEmployees,
  searchEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  toggleEmployeeStatus,
  syncEmployeeAuthPassword,
  provisionEmployeeLogin,
  ensureLiveSession,
} from "../../repositories/employee/employeeRepository";

class EmployeeService {
  async getAll(): Promise<Employee[]> {
    return await getEmployees();
  }

  async search(keyword: string): Promise<Employee[]> {
    const value = keyword.trim();

    if (!value) {
      return await getEmployees();
    }

    return await searchEmployees(value);
  }

  /** Creates the employee and, when a password is supplied, their real login.
   * If the login can't be created the new employee row is removed again, so
   * nobody is left in the list who can't sign in and doesn't know why. */
  async create(employee: Partial<Employee> & { password?: string }): Promise<Employee> {
    this.validate(employee);

    const password = employee.password?.trim();
    // Check the sign-in first, so a dead session is reported BEFORE anything is saved.
    if (password) await ensureLiveSession();
    const created = await createEmployee(employee);

    if (password) {
      try {
        await provisionEmployeeLogin(created.id, password);
      } catch (err) {
        await deleteEmployee(created.id).catch(() => undefined);
        const reason = err instanceof Error ? err.message : "unknown error";
        throw new Error(`Could not create this employee's login (${reason}). Nothing was saved — please try again.`);
      }
    }

    return created;
  }

  /** Gives an existing employee who has no login yet (auth_user_id empty) a
   * login with the given password. */
  async createLogin(employeeId: string, password: string): Promise<void> {
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }
    await provisionEmployeeLogin(employeeId, password);
  }

  async update(id: string, employee: Partial<Employee> & { password?: string }): Promise<Employee> {
    this.validate(employee);

    return await updateEmployee(id, employee);
  }

  async delete(id: string): Promise<void> {
    if (!id) {
      throw new Error("Invalid Employee ID.");
    }

    await deleteEmployee(id);
  }

  async resetPassword(authUserId: string, newPassword: string): Promise<void> {
    if (newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }
    await syncEmployeeAuthPassword(authUserId, newPassword);
  }

  async setStatus(id: string, active: boolean): Promise<void> {
    if (!id) {
      throw new Error("Invalid Employee ID.");
    }

    await toggleEmployeeStatus(id, active);
  }

  private validate(employee: Partial<Employee>): void {
    if (!employee.company_id) {
      throw new Error("Company is required.");
    }

    if (!employee.branch_id) {
      throw new Error("Branch is required.");
    }

    if (!employee.department_id) {
      throw new Error("Department is required.");
    }

    if (!employee.designation_id) {
      throw new Error("Designation is required.");
    }

    if (!employee.employee_code?.trim()) {
      throw new Error("Employee Code is required.");
    }

    if (!employee.first_name?.trim()) {
      throw new Error("First Name is required.");
    }

    if (!employee.joining_date?.trim()) {
      throw new Error("Joining Date is required.");
    }
  }
}

export const employeeService = new EmployeeService();

// FILE COMPLETE
