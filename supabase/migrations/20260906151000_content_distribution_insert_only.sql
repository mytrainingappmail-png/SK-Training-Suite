-- The previous migration's "_all" (SELECT+INSERT+UPDATE+DELETE) policies
-- were too broad: since Postgres RLS scopes plain SELECTs too, they meant
-- the operator's OWN everyday screens (Course Management, Video Library,
-- Real Estate Projects — none of which filter by company_id client-side,
-- they rely entirely on RLS) started showing every company's rows mixed
-- together the moment a company had is_platform_operator = true. Caught
-- this live-testing Content Distribution (Realty Smartz Pvt Ltd is ALSO
-- flagged is_platform_operator, so the leak was immediately visible: its
-- courses appeared in the operator's course picker).
--
-- Content Distribution only ever needs to INSERT a copy into the target
-- company -- never read or modify what's already there. Replacing the
-- "_all" policies with INSERT-only ones closes that read leak entirely
-- while still allowing the push. (The service layer also switched to
-- generating each cloned row's id client-side instead of relying on
-- INSERT...RETURNING, so it never needs SELECT visibility into the
-- target company's rows either.)

drop policy if exists courses_platform_operator_all on courses;
drop policy if exists modules_platform_operator_all on modules;
drop policy if exists lessons_platform_operator_all on lessons;
drop policy if exists library_videos_platform_operator_all on library_videos;
drop policy if exists real_estate_projects_platform_operator_all on real_estate_projects;
drop policy if exists real_estate_project_sections_platform_operator_all on real_estate_project_sections;
drop policy if exists real_estate_project_brochures_platform_operator_all on real_estate_project_brochures;

create policy courses_platform_operator_insert
  on courses for insert
  to authenticated
  with check (current_company_is_platform_operator());

create policy modules_platform_operator_insert
  on modules for insert
  to authenticated
  with check (current_company_is_platform_operator());

create policy lessons_platform_operator_insert
  on lessons for insert
  to authenticated
  with check (current_company_is_platform_operator());

create policy library_videos_platform_operator_insert
  on library_videos for insert
  to authenticated
  with check (current_company_is_platform_operator());

create policy real_estate_projects_platform_operator_insert
  on real_estate_projects for insert
  to authenticated
  with check (current_company_is_platform_operator());

create policy real_estate_project_sections_platform_operator_insert
  on real_estate_project_sections for insert
  to authenticated
  with check (current_company_is_platform_operator());

create policy real_estate_project_brochures_platform_operator_insert
  on real_estate_project_brochures for insert
  to authenticated
  with check (current_company_is_platform_operator());
