-- Same gap as 20260727490000: company_licenses only had a policy scoped to
-- the caller's own company, which blocked the Add Company wizard's optional
-- "issue a license right now" step (saveNewCompanyLicense) for the
-- newly-onboarded company.
create policy company_licenses_platform_operator_all
  on company_licenses for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());
