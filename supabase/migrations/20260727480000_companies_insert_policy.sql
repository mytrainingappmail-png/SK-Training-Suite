-- companies had SELECT (authenticated_see_own_company, restricted to the
-- caller's own company) and two UPDATE policies but no INSERT policy at
-- all, so RLS silently rejected every insert -- the new Add Company
-- wizard's createCompany() call always failed. Only a platform operator
-- may create new companies.
create policy companies_insert_platform_operator
  on companies
  for insert
  to authenticated
  with check (current_company_is_platform_operator());

-- Postgres enforces SELECT-policy visibility on the RETURNING clause of
-- INSERT/UPDATE (and on PostgREST's .select() after a write): a row that
-- the SELECT policy wouldn't show is reported as a row-level security
-- violation on the write itself, not silently omitted. Since
-- authenticated_see_own_company only shows a user their own company, a
-- platform operator's createCompany() insert of a brand-new company (not
-- their own) always failed here too, even with the INSERT policy above
-- in place -- this also means getCompanies() (used by Plans, Company
-- Licenses, Company Modules, and this wizard's duplicate-code check) has
-- only ever been able to see the caller's own company, silently hiding
-- every other company from those platform-operator screens. Platform
-- operators need to see every company.
create policy companies_select_platform_operator
  on companies
  for select
  to authenticated
  using (current_company_is_platform_operator());
