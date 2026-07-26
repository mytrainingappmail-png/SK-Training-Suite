-- Which app_modules a subscription plan includes — so issuing/changing a
-- company's license (see CompanyLicenseManagement.tsx / licenseService.ts)
-- can automatically configure that company's module access to match the
-- plan, instead of the operator having to separately remember to flip
-- toggles in Company Modules every time. Mirrors subscription_plans' own
-- RLS pattern exactly (20260722130000_platform_operator_scoping.sql):
-- every authenticated user can read (the plan editor and the license
-- issuance flow both need this), only the platform operator can write.

create table if not exists plan_modules (
  plan_id uuid not null references subscription_plans(id) on delete cascade,
  module_key text not null references app_modules(key) on delete cascade,
  enabled boolean not null default true,
  primary key (plan_id, module_key)
);

alter table plan_modules enable row level security;

drop policy if exists plan_modules_read on plan_modules;
create policy plan_modules_read on plan_modules
  for select using (auth.uid() is not null);

drop policy if exists plan_modules_write on plan_modules;
create policy plan_modules_write on plan_modules
  for all using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());
