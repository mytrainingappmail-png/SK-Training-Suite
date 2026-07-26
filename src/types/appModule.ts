// Generic per-company module/add-on toggle system — see
// supabase/migrations/20260726390000_app_modules_registry.sql for the
// schema and the reasoning (replaces one-off booleans like
// companies.market_analytics_enabled with a real, extensible registry).

export interface AppModule {
  key: string;
  label: string;
  description: string;
  category: string;
  is_addon: boolean;
  default_enabled: boolean;
  display_order: number;
  created_at: string;
}

export interface CompanyModuleOverride {
  company_id: string;
  module_key: string;
  enabled: boolean;
  updated_at: string;
}

/** One row per registered module, with the company's effective on/off already resolved (its own override if one exists, else the module's default) — what the operator's toggle grid renders. */
export interface CompanyModuleState extends AppModule {
  enabled: boolean;
  hasOverride: boolean;
}
