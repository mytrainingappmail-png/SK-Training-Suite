// Cached resolver for "the current employee's own company_id" — used by
// list-fetching repository functions (getBranches, getDepartments,
// getEmployees, getRoles, ...) that must explicitly scope to the caller's
// own company rather than relying on RLS alone. A platform operator can
// see every company's rows under RLS (needed for onboarding/Company
// Licenses/Company Modules), so any "my company's X" list query that
// omits an explicit company_id filter would otherwise return every
// company's rows mixed together for that operator.
import { getCompany } from "../../repositories/company/companyRepository";

let cachedCompanyId: string | null | undefined;

export async function getMyCompanyId(): Promise<string | null> {
  if (cachedCompanyId !== undefined) return cachedCompanyId;
  const company = await getCompany();
  cachedCompanyId = company?.id ?? null;
  return cachedCompanyId;
}

export function invalidateMyCompanyId(): void {
  cachedCompanyId = undefined;
}
