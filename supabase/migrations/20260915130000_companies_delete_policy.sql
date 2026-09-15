-- companies had SELECT/INSERT/UPDATE RLS policies but no DELETE policy at
-- all — under RLS's default-deny behavior that makes a `DELETE FROM
-- companies` silently affect zero rows (200 OK, empty result) for EVERY
-- caller, platform operator included, rather than erroring. Confirmed live:
-- a direct REST DELETE against a real company row returned status 200
-- with body `[]`. Adds the missing policy, scoped to the platform
-- operator only — same actor already allowed to insert/update companies
-- (companies_insert_platform_operator / companies_update_platform_operator).

create policy companies_delete_platform_operator on companies
  for delete using (current_company_is_platform_operator());
