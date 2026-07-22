-- ============================================================================
-- PLATFORM OPERATOR SCOPING
--
-- Context: after the RLS hardening pass, a handful of tables were left as
-- "any logged-in employee, at any company, can read AND write" because
-- they have no company_id at all — they're platform-wide catalogs/config,
-- not per-tenant data: subscription_plans, discount_codes, payment_settings,
-- permissions, menus, settings, themes, certificate_templates,
-- learning_paths, admin_module_categories, admin_module_assignments.
--
-- That's fine for reading (every company needs to see the available plans,
-- render the menu, etc.) but wrong for writing — right now, an admin at ANY
-- tenant company could edit the platform's own Razorpay key, payment bank
-- details, discount codes, or the master permission/menu catalog.
--
-- Fix: mark exactly one company as the platform operator (the company that
-- runs this SaaS, as opposed to a company subscribing to it), and restrict
-- writes on these tables to employees of that company. Reads stay open to
-- any authenticated employee, matching current app behaviour.
--
-- Test on staging before applying to production, same as the previous
-- migration.
-- ============================================================================

alter table companies add column if not exists is_platform_operator boolean not null default false;

-- Mark the operating company. Today there is exactly one company in this
-- database (company_code 'SKE001', "Siddharth & Kunal Enterprise") — that's
-- the one running this platform, so it becomes the operator. Any company
-- onboarded later as a paying tenant will default to false and will only
-- get read access to these tables, not write.
update companies set is_platform_operator = true where company_code = 'SKE001';

create or replace function public.current_company_is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_platform_operator from companies where id = current_employee_company_id()),
    false
  )
$$;

-- ── discount_codes ──────────────────────────────────────────────────────────
drop policy if exists discount_codes_authenticated_only on discount_codes;
create policy discount_codes_read on discount_codes
  for select using (auth.uid() is not null);
create policy discount_codes_write on discount_codes
  for insert with check (current_company_is_platform_operator());
create policy discount_codes_update on discount_codes
  for update using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
create policy discount_codes_delete on discount_codes
  for delete using (current_company_is_platform_operator());

-- ── subscription_plans ──────────────────────────────────────────────────────
drop policy if exists subscription_plans_authenticated_only on subscription_plans;
create policy subscription_plans_read on subscription_plans
  for select using (auth.uid() is not null);
create policy subscription_plans_write on subscription_plans
  for insert with check (current_company_is_platform_operator());
create policy subscription_plans_update on subscription_plans
  for update using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
create policy subscription_plans_delete on subscription_plans
  for delete using (current_company_is_platform_operator());

-- ── payment_settings (bank details, Razorpay key — most sensitive of the group) ──
drop policy if exists payment_settings_authenticated_only on payment_settings;
create policy payment_settings_read on payment_settings
  for select using (auth.uid() is not null);
create policy payment_settings_write on payment_settings
  for insert with check (current_company_is_platform_operator());
create policy payment_settings_update on payment_settings
  for update using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
create policy payment_settings_delete on payment_settings
  for delete using (current_company_is_platform_operator());

-- ── permissions (master permission-code catalog) ────────────────────────────
drop policy if exists permissions_authenticated_only on permissions;
create policy permissions_read on permissions
  for select using (auth.uid() is not null);
create policy permissions_write on permissions
  for insert with check (current_company_is_platform_operator());
create policy permissions_update on permissions
  for update using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
create policy permissions_delete on permissions
  for delete using (current_company_is_platform_operator());

-- ── menus ────────────────────────────────────────────────────────────────────
drop policy if exists menus_authenticated_only on menus;
create policy menus_read on menus
  for select using (auth.uid() is not null);
create policy menus_write on menus
  for insert with check (current_company_is_platform_operator());
create policy menus_update on menus
  for update using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
create policy menus_delete on menus
  for delete using (current_company_is_platform_operator());

-- ── settings ─────────────────────────────────────────────────────────────────
drop policy if exists settings_authenticated_only on settings;
create policy settings_read on settings
  for select using (auth.uid() is not null);
create policy settings_write on settings
  for insert with check (current_company_is_platform_operator());
create policy settings_update on settings
  for update using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
create policy settings_delete on settings
  for delete using (current_company_is_platform_operator());

-- ── themes ───────────────────────────────────────────────────────────────────
drop policy if exists themes_authenticated_only on themes;
create policy themes_read on themes
  for select using (auth.uid() is not null);
create policy themes_write on themes
  for insert with check (current_company_is_platform_operator());
create policy themes_update on themes
  for update using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
create policy themes_delete on themes
  for delete using (current_company_is_platform_operator());

-- ── certificate_templates ────────────────────────────────────────────────────
drop policy if exists certificate_templates_authenticated_only on certificate_templates;
create policy certificate_templates_read on certificate_templates
  for select using (auth.uid() is not null);
create policy certificate_templates_write on certificate_templates
  for insert with check (current_company_is_platform_operator());
create policy certificate_templates_update on certificate_templates
  for update using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
create policy certificate_templates_delete on certificate_templates
  for delete using (current_company_is_platform_operator());

-- ── learning_paths ───────────────────────────────────────────────────────────
drop policy if exists learning_paths_authenticated_only on learning_paths;
create policy learning_paths_read on learning_paths
  for select using (auth.uid() is not null);
create policy learning_paths_write on learning_paths
  for insert with check (current_company_is_platform_operator());
create policy learning_paths_update on learning_paths
  for update using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
create policy learning_paths_delete on learning_paths
  for delete using (current_company_is_platform_operator());

-- ── admin_module_categories ──────────────────────────────────────────────────
drop policy if exists admin_module_categories_authenticated_only on admin_module_categories;
create policy admin_module_categories_read on admin_module_categories
  for select using (auth.uid() is not null);
create policy admin_module_categories_write on admin_module_categories
  for insert with check (current_company_is_platform_operator());
create policy admin_module_categories_update on admin_module_categories
  for update using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
create policy admin_module_categories_delete on admin_module_categories
  for delete using (current_company_is_platform_operator());

-- ── admin_module_assignments ─────────────────────────────────────────────────
drop policy if exists admin_module_assignments_authenticated_only on admin_module_assignments;
create policy admin_module_assignments_read on admin_module_assignments
  for select using (auth.uid() is not null);
create policy admin_module_assignments_write on admin_module_assignments
  for insert with check (current_company_is_platform_operator());
create policy admin_module_assignments_update on admin_module_assignments
  for update using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());
create policy admin_module_assignments_delete on admin_module_assignments
  for delete using (current_company_is_platform_operator());
