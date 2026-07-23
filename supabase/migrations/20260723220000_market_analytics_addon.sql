-- ============================================================================
-- MARKET ANALYTICS ADD-ON
--
-- Optional, paid, per-company feature (companies.market_analytics_enabled) —
-- an employee-facing real-estate market analytics dashboard, inspired by
-- the user's own PropAnalytics dashboard (ownership confirmed). The admin
-- enters only a handful of RAW numbers per city per quarter; every QoQ/YoY
-- percentage, trend line, and the investment score are COMPUTED from the
-- history of entries, never typed in by hand.
--
-- Only the platform operator can flip market_analytics_enabled for a
-- company (this is the "extra cost" toggle you turn on after a client
-- pays for it) — companies_update_platform_operator adds a second path
-- alongside the existing companies_update_own policy (RLS policies for the
-- same command are OR'd together, so a company keeps editing its own
-- branding/address as before).
-- ============================================================================

alter table companies add column if not exists market_analytics_enabled boolean not null default false;

drop policy if exists companies_update_platform_operator on companies;
create policy companies_update_platform_operator on companies
  for update
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create table if not exists market_data_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  city_name text not null,
  state_name text not null default '',
  year int not null,
  quarter int not null check (quarter between 1 and 4),
  segment text not null default '',
  trend text not null default '',
  avg_rate numeric not null default 0,       -- ₹ per sqft, this quarter
  rental_avg numeric not null default 0,     -- ₹ per month, this quarter
  demand_index numeric not null default 0,   -- 0-100 relative demand score, this quarter
  supply_index numeric not null default 0,   -- 0-100 relative supply score, this quarter
  bhk_demand jsonb not null default '{}'::jsonb,      -- optional: {"1BHK":38,"2BHK":42,...}
  price_segment jsonb not null default '{}'::jsonb,   -- optional: {"< ₹30L":5,...}
  micromarkets jsonb not null default '[]'::jsonb,    -- optional: [{"name":"Whitefield","rate":12400,"demand":"High"}]
  created_by uuid references employees(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, city_name, year, quarter)
);

create index if not exists idx_market_data_company_city on market_data_entries (company_id, city_name, year, quarter);

alter table market_data_entries enable row level security;
create policy market_data_entries_company_scoped on market_data_entries
  for all using (company_id = current_employee_company_id())
  with check (company_id = current_employee_company_id());
