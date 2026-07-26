import { supabase } from "../../lib/supabase";
import type { AppModule, CompanyModuleOverride } from "../../types/appModule";

/** The full module registry, in display order — adding a future feature/add-on is one row here, not a code change. */
export async function listAppModules(): Promise<AppModule[]> {
  const { data, error } = await supabase
    .from("app_modules")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[appModuleRepository] listAppModules:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function listCompanyModuleOverrides(companyId: string): Promise<CompanyModuleOverride[]> {
  const { data, error } = await supabase
    .from("company_modules")
    .select("*")
    .eq("company_id", companyId);

  if (error) {
    console.error("[appModuleRepository] listCompanyModuleOverrides:", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

/** Platform-operator only (enforced by RLS) — customizes one company's access to one module. */
export async function setCompanyModule(companyId: string, moduleKey: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from("company_modules")
    .upsert(
      { company_id: companyId, module_key: moduleKey, enabled, updated_at: new Date().toISOString() },
      { onConflict: "company_id,module_key" }
    );

  if (error) {
    console.error("[appModuleRepository] setCompanyModule:", error);
    throw new Error(error.message);
  }
}

/** Applies a whole set of module states to a company in one request — a single upsert statement covering every row is all-or-nothing at the database level, unlike calling setCompanyModule in a loop (which can leave a company half-applied if a later row in the loop fails). Used when a license/plan is assigned so a company's modules never end up in a partially-updated state. */
export async function setCompanyModules(
  companyId: string,
  entries: { moduleKey: string; enabled: boolean }[]
): Promise<void> {
  if (entries.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("company_modules")
    .upsert(
      entries.map((e) => ({ company_id: companyId, module_key: e.moduleKey, enabled: e.enabled, updated_at: now })),
      { onConflict: "company_id,module_key" }
    );

  if (error) {
    console.error("[appModuleRepository] setCompanyModules:", error);
    throw new Error(error.message);
  }
}

/** Removes an explicit override so the module falls back to its own default_enabled again. */
export async function clearCompanyModuleOverride(companyId: string, moduleKey: string): Promise<void> {
  const { error } = await supabase
    .from("company_modules")
    .delete()
    .eq("company_id", companyId)
    .eq("module_key", moduleKey);

  if (error) {
    console.error("[appModuleRepository] clearCompanyModuleOverride:", error);
    throw new Error(error.message);
  }
}
