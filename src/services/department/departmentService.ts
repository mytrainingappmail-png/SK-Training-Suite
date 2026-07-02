import type { Department } from "../../types/department";

import {
  getDepartments,
  searchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  toggleDepartmentStatus,
} from "../../repositories/department/departmentRepository";

class DepartmentService {
  async getAll(): Promise<Department[]> {
    return await getDepartments();
  }

  async search(keyword: string): Promise<Department[]> {
    const value = keyword.trim();

    if (!value) {
      return await getDepartments();
    }

    return await searchDepartments(value);
  }

  async create(department: Partial<Department>): Promise<Department> {
    this.validate(department);

    return await createDepartment(department);
  }

  async update(id: string, department: Partial<Department>): Promise<Department> {
    this.validate(department);

    return await updateDepartment(id, department);
  }

  async delete(id: string): Promise<void> {
    if (!id) {
      throw new Error("Invalid Department ID.");
    }

    await deleteDepartment(id);
  }

  async setStatus(id: string, active: boolean): Promise<void> {
    if (!id) {
      throw new Error("Invalid Department ID.");
    }

    await toggleDepartmentStatus(id, active);
  }

  private validate(department: Partial<Department>): void {
    if (!department.company_id) {
      throw new Error("Company is required.");
    }

    if (!department.branch_id) {
      throw new Error("Branch is required.");
    }

    if (!department.department_code?.trim()) {
      throw new Error("Department Code is required.");
    }

    if (!department.department_name?.trim()) {
      throw new Error("Department Name is required.");
    }
  }
}

export const departmentService = new DepartmentService();

// FILE COMPLETE
