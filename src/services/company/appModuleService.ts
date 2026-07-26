import * as appModuleRepo from "../../repositories/company/appModuleRepository";
import type { CompanyModuleState } from "../../types/appModule";

/** Merges the module registry with one company's overrides into a resolved list — what the operator's toggle grid renders. */
export async function getCompanyModuleStates(companyId: string): Promise<CompanyModuleState[]> {
  const [modules, overrides] = await Promise.all([
    appModuleRepo.listAppModules(),
    appModuleRepo.listCompanyModuleOverrides(companyId),
  ]);

  const overrideMap = new Map(overrides.map((o) => [o.module_key, o.enabled]));

  return modules.map((m) => ({
    ...m,
    enabled: overrideMap.get(m.key) ?? m.default_enabled,
    hasOverride: overrideMap.has(m.key),
  }));
}

/** A flat key -> enabled map for one company — what Sidebar.tsx/Admin.tsx check to gate a section, without the caller needing to know about overrides vs defaults. */
export async function loadCompanyModuleFlags(companyId: string): Promise<Record<string, boolean>> {
  const states = await getCompanyModuleStates(companyId);
  return Object.fromEntries(states.map((s) => [s.key, s.enabled]));
}

export async function setCompanyModule(companyId: string, moduleKey: string, enabled: boolean): Promise<void> {
  return appModuleRepo.setCompanyModule(companyId, moduleKey, enabled);
}

export async function setCompanyModules(
  companyId: string,
  entries: { moduleKey: string; enabled: boolean }[]
): Promise<void> {
  return appModuleRepo.setCompanyModules(companyId, entries);
}

export async function clearCompanyModuleOverride(companyId: string, moduleKey: string): Promise<void> {
  return appModuleRepo.clearCompanyModuleOverride(companyId, moduleKey);
}
