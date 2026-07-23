-- The companies table has always had a read-only "authenticated_see_own_company"
-- policy (kept as-is during the earlier RLS hardening pass), but no policy
-- ever granted UPDATE — so Company Management's "Save Changes" has been
-- silently rejected by Postgres RLS (default-deny with no matching policy)
-- regardless of what the admin edits. This adds the missing UPDATE policy,
-- scoped to a company only ever being able to update its own row.

drop policy if exists companies_update_own on companies;
create policy companies_update_own on companies
  for update
  using (id = current_employee_company_id())
  with check (id = current_employee_company_id());
