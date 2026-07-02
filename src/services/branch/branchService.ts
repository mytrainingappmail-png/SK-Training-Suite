import type { Branch } from "../../types/branch";

import {
  getBranches,
  searchBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  toggleBranchStatus,
  toggleHeadOffice,
} from "../../repositories/branch/branchRepository";

class BranchService {
  async getAll(): Promise<Branch[]> {
    return await getBranches();
  }

  async search(keyword: string): Promise<Branch[]> {
    const value = keyword.trim();

    if (!value) {
      return await getBranches();
    }

    return await searchBranches(value);
  }

  async create(branch: Partial<Branch>): Promise<Branch> {
    this.validate(branch);

    return await createBranch(branch);
  }

  async update(id: string, branch: Partial<Branch>): Promise<Branch> {
    this.validate(branch);

    return await updateBranch(id, branch);
  }

  async delete(id: string): Promise<void> {
    if (!id) {
      throw new Error("Invalid Branch ID.");
    }

    await deleteBranch(id);
  }

  async setStatus(id: string, active: boolean): Promise<void> {
    if (!id) {
      throw new Error("Invalid Branch ID.");
    }

    await toggleBranchStatus(id, active);
  }

  async setHeadOffice(id: string, value: boolean): Promise<void> {
    if (!id) {
      throw new Error("Invalid Branch ID.");
    }

    await toggleHeadOffice(id, value);
  }

  private validate(branch: Partial<Branch>): void {
    if (!branch.branch_name?.trim()) {
      throw new Error("Branch Name is required.");
    }

    if (!branch.branch_code?.trim()) {
      throw new Error("Branch Code is required.");
    }

    if (!branch.company_id) {
      throw new Error("Company is required.");
    }
  }
}

export const branchService = new BranchService();