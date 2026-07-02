import type { Company } from "../../types/company";

import {
  getCompany,
  getCompanies,
  updateCompany,
} from "../../repositories/company/companyRepository";

export async function loadCompany(): Promise<Company | null> {
  return await getCompany();
}

export async function loadCompanies(): Promise<Company[]> {
  return await getCompanies();
}

export async function saveCompany(
  id: string,
  data: Partial<Company>
): Promise<Company> {
  return await updateCompany(id, data);
}