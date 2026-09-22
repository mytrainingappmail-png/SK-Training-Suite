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

/**
 * Renames a company's display name and/or its login code (the value employees type as
 * "Company Code" at login, and quiz admins use for the Live Quiz side login too). Both live
 * in a single column on `companies` — nothing else stores a copy of the code, so changing it
 * here is the one and only place that needs to happen; every employee login, branding lookup
 * and the Live Quiz admin login already read it live off this row.
 *
 * Existing sessions already signed in keep working (they don't re-check the code), but
 * anyone signing in fresh must use the new code from that point on — the caller's UI should
 * make that plain before this runs.
 */
export async function renameCompanyProfile(
  id: string,
  companyName: string,
  companyCode: string
): Promise<Company> {
  const name = companyName.trim();
  const code = companyCode.trim().toUpperCase();
  if (!name) throw new Error("Company name is required.");
  if (!code) throw new Error("Company code is required.");
  if (!/^[A-Z0-9-]+$/.test(code)) throw new Error("Company code can only contain letters, numbers and hyphens.");

  try {
    return await updateCompany(id, { company_name: name, company_code: code });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/duplicate key|unique constraint|company_code/i.test(message)) {
      throw new Error(`"${code}" is already used by another company — pick a different code.`);
    }
    throw err;
  }
}

// Only ever call this after the UI has confirmed the admin means it —
// permanent, cascades through 60+ tables, cannot be undone.
export async function removeCompany(id: string): Promise<void> {
  await deleteCompany(id);
}