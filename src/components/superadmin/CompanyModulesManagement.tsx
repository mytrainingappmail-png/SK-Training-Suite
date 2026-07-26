// Lets the platform operator customize which sections/add-ons each
// subscribing company actually has access to — e.g. a company outside real
// estate can have "Real Estate Project Management" switched off while
// keeping everything else on. Backed by the app_modules registry +
// company_modules override table (see
// supabase/migrations/20260726390000_app_modules_registry.sql). Shipping a
// future feature/add-on is one new row in app_modules — it appears here
// automatically, with no changes to this file.

import { useEffect, useMemo, useState } from "react";
import { loadCompanies } from "../../services/company/companyService";
import {
  getCompanyModuleStates,
  setCompanyModule,
  clearCompanyModuleOverride,
} from "../../services/company/appModuleService";
import type { Company } from "../../types/company";
import type { CompanyModuleState } from "../../types/appModule";

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-indigo-600" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white transition ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function CompanyModulesManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [activeCompanyId, setActiveCompanyId] = useState("");
  const [states, setStates] = useState<CompanyModuleState[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingModules, setLoadingModules] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCompanies()
      .then((rows) => {
        setCompanies(rows);
        setActiveCompanyId(rows[0]?.id ?? "");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load companies."))
      .finally(() => setLoadingCompanies(false));
  }, []);

  useEffect(() => {
    if (!activeCompanyId) {
      setStates([]);
      return;
    }
    setLoadingModules(true);
    getCompanyModuleStates(activeCompanyId)
      .then(setStates)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load modules."))
      .finally(() => setLoadingModules(false));
  }, [activeCompanyId]);

  async function handleToggle(moduleKey: string, next: boolean) {
    if (!activeCompanyId) return;
    setSavingKey(moduleKey);
    setStates((prev) => prev.map((s) => (s.key === moduleKey ? { ...s, enabled: next, hasOverride: true } : s)));
    try {
      await setCompanyModule(activeCompanyId, moduleKey, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
      getCompanyModuleStates(activeCompanyId).then(setStates);
    } finally {
      setSavingKey(null);
    }
  }

  async function handleResetToDefault(moduleKey: string) {
    if (!activeCompanyId) return;
    setSavingKey(moduleKey);
    try {
      await clearCompanyModuleOverride(activeCompanyId, moduleKey);
      const fresh = await getCompanyModuleStates(activeCompanyId);
      setStates(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset.");
    } finally {
      setSavingKey(null);
    }
  }

  const filteredCompanies = useMemo(() => {
    const kw = companySearch.trim().toLowerCase();
    if (!kw) return companies;
    return companies.filter((c) => c.company_name.toLowerCase().includes(kw));
  }, [companies, companySearch]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, CompanyModuleState[]>();
    for (const s of states) {
      if (!byCategory.has(s.category)) byCategory.set(s.category, []);
      byCategory.get(s.category)!.push(s);
    }
    return Array.from(byCategory.entries());
  }, [states]);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? null;
  const enabledCount = states.filter((s) => s.enabled).length;

  if (loadingCompanies) return <div className="text-sm text-slate-400">Loading companies…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Company Modules</h2>
        <p className="text-sm text-slate-500">
          Switch sections and add-ons on or off per company — customize what each subscriber gets.
        </p>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        {/* Company picker */}
        <div className="rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <p className="mb-3 text-sm font-bold text-slate-800">Companies</p>
          <input
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            placeholder="Search company…"
            className="mb-2 w-full rounded-lg bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400/40"
          />
          <div className="max-h-[500px] space-y-1 overflow-y-auto">
            {filteredCompanies.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCompanyId(c.id)}
                className={`block w-full truncate rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                  activeCompanyId === c.id ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {c.company_name}
              </button>
            ))}
            {filteredCompanies.length === 0 && <p className="px-2 py-4 text-center text-sm text-slate-400">No companies found.</p>}
          </div>
        </div>

        {/* Module toggle grid */}
        <div className="space-y-4">
          {!activeCompany ? (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm">Select a company.</div>
          ) : loadingModules ? (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm">Loading modules…</div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-sm">
                <span className="text-sm font-semibold text-slate-800">{activeCompany.company_name}</span>
                <span className="text-xs text-slate-500">{enabledCount} of {states.length} modules enabled</span>
              </div>

              {groups.map(([category, items]) => (
                <div key={category} className="rounded-2xl bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-5 py-3">
                    <h3 className="text-sm font-bold text-slate-800">{category}</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {items.map((m) => (
                      <div key={m.key} className="flex items-center gap-3 px-5 py-3.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800">{m.label}</p>
                            {m.is_addon && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Paid Add-on</span>
                            )}
                            {m.hasOverride && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Customized</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">{m.description}</p>
                        </div>
                        {m.hasOverride && (
                          <button
                            onClick={() => handleResetToDefault(m.key)}
                            disabled={savingKey === m.key}
                            className="flex-shrink-0 text-xs font-semibold text-slate-400 hover:text-slate-600 disabled:opacity-50"
                          >
                            Reset
                          </button>
                        )}
                        <Toggle on={m.enabled} onChange={() => handleToggle(m.key, !m.enabled)} disabled={savingKey === m.key} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CompanyModulesManagement;
