-- Every one of these tables only had a single company-scoped policy tying
-- reads/writes to the CALLER's own company_id (current_employee_company_id()).
-- That's correct for normal tenant isolation, but it also silently blocked
-- the platform operator from the Add Company wizard: onboarding a brand-new
-- company means writing branches/departments/designations/roles/employees
-- etc. for a company that is NOT the operator's own, and Postgres enforces
-- the SELECT-side of this same policy on the RETURNING clause of every
-- insert too (see the companies fix in 20260727480000) -- so every step
-- after "create the company row" failed here. A platform operator needs
-- full access to every company's rows on these tables, both to onboard a
-- new company and to manually finish/fix a partially-onboarded one (the
-- companyOnboardingService.ts failure message already tells operators to
-- do exactly that from these screens).
create policy branches_platform_operator_all
  on branches for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create policy departments_platform_operator_all
  on departments for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create policy designations_platform_operator_all
  on designations for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create policy roles_platform_operator_all
  on roles for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create policy employees_platform_operator_all
  on employees for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create policy employee_roles_platform_operator_all
  on employee_roles for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create policy role_permissions_platform_operator_all
  on role_permissions for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create policy menu_permissions_platform_operator_all
  on menu_permissions for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());
