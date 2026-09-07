-- Lets the platform operator (Inder/IKB) push a copy of one of their own
-- courses/videos/real-estate-projects into another company's own data --
-- e.g. selling "premium training material" as an add-on. Once pushed, the
-- copy is that company's own row (new id, their company_id): they can
-- edit or delete it freely, and nothing about it ever writes back to the
-- operator's original. This only adds READ+WRITE access to the operator
-- across every company's rows on these tables, mirroring the exact same
-- pattern already used for onboarding a new company (see
-- 20260727490000_platform_operator_onboarding_policies.sql) -- regular
-- companies are completely unaffected, they still only see their own rows.

create policy courses_platform_operator_all
  on courses for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create policy modules_platform_operator_all
  on modules for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create policy lessons_platform_operator_all
  on lessons for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create policy library_videos_platform_operator_all
  on library_videos for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create policy real_estate_projects_platform_operator_all
  on real_estate_projects for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create policy real_estate_project_sections_platform_operator_all
  on real_estate_project_sections for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());

create policy real_estate_project_brochures_platform_operator_all
  on real_estate_project_brochures for all
  to authenticated
  using (current_company_is_platform_operator())
  with check (current_company_is_platform_operator());
