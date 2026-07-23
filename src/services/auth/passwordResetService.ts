import { requestPasswordReset as repositoryRequestPasswordReset } from "../../repositories/auth/passwordResetRepository";

export async function requestPasswordReset(companyCode: string, employeeCode: string): Promise<void> {
  if (!companyCode.trim() || !employeeCode.trim()) {
    throw new Error("Company Code and Employee ID are required.");
  }
  await repositoryRequestPasswordReset(companyCode.trim(), employeeCode.trim());
}
