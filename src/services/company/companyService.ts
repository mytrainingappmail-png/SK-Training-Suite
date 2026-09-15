import type { Company, CompanyForm } from "../../types/company";

import {
  getCompany,
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
} from "../../repositories/company/companyRepository";

export async function loadCompany(): Promise<Company | null> {
  return await getCompany();
}

export async function loadCompanies(): Promise<Company[]> {
  return await getCompanies();
}

export async function addCompany(form: CompanyForm): Promise<Company> {
  return await createCompany(form);
}

export async function saveCompany(
  id: string,
  data: Partial<Company>
): Promise<Company> {
  return await updateCompany(id, data);
}

// Only ever call this after the UI has confirmed the admin means it —
// permanent, cascades through 60+ tables, cannot be undone.
export async function removeCompany(id: string): Promise<void> {
  await deleteCompany(id);
}