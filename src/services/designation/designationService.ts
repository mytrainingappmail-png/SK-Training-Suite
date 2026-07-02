import type { Designation } from "../../types/designation";

import {
  getDesignations,
  searchDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
  toggleDesignationStatus,
} from "../../repositories/designation/designationRepository";

class DesignationService {
  async getAll(): Promise<Designation[]> {
    return await getDesignations();
  }

  async search(keyword: string): Promise<Designation[]> {
    const value = keyword.trim();

    if (!value) {
      return await getDesignations();
    }

    return await searchDesignations(value);
  }

  async create(designation: Partial<Designation>): Promise<Designation> {
    this.validate(designation);

    return await createDesignation(designation);
  }

  async update(id: string, designation: Partial<Designation>): Promise<Designation> {
    this.validate(designation);

    return await updateDesignation(id, designation);
  }

  async delete(id: string): Promise<void> {
    if (!id) {
      throw new Error("Invalid Designation ID.");
    }

    await deleteDesignation(id);
  }

  async setStatus(id: string, active: boolean): Promise<void> {
    if (!id) {
      throw new Error("Invalid Designation ID.");
    }

    await toggleDesignationStatus(id, active);
  }

  private validate(designation: Partial<Designation>): void {
    if (!designation.company_id) {
      throw new Error("Company is required.");
    }

    if (!designation.branch_id) {
      throw new Error("Branch is required.");
    }

    if (!designation.department_id) {
      throw new Error("Department is required.");
    }

    if (!designation.designation_code?.trim()) {
      throw new Error("Designation Code is required.");
    }

    if (!designation.designation_name?.trim()) {
      throw new Error("Designation Name is required.");
    }

    if (
      designation.hierarchy_level === undefined ||
      designation.hierarchy_level === null
    ) {
      throw new Error("Hierarchy Level is required.");
    }
  }
}

export const designationService = new DesignationService();

// FILE COMPLETE
