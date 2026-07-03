import type { Employee } from "../../types/employee";

import {
  getEmployees,
  searchEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  toggleEmployeeStatus,
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

  async create(employee: Partial<Employee>): Promise<Employee> {
    this.validate(employee);

    return await createEmployee(employee);
  }

  async update(id: string, employee: Partial<Employee>): Promise<Employee> {
    this.validate(employee);

    return await updateEmployee(id, employee);
  }

  async delete(id: string): Promise<void> {
    if (!id) {
      throw new Error("Invalid Employee ID.");
    }

    await deleteEmployee(id);
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
