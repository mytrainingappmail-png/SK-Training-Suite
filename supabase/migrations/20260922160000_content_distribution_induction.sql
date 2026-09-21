-- Content Distribution can now also push Induction Days (with their sections) into another company.
-- Insert-only, same as courses/videos/projects (see 20260906151000): the operator can write a copy
-- into the target company but never read or modify what is already there.

drop policy if exists induction_days_platform_operator_insert on induction_days;
create policy induction_days_platform_operator_insert
  on induction_days for insert
  to authenticated
  with check (current_company_is_platform_operator());

drop policy if exists induction_day_sections_platform_operator_insert on induction_day_sections;
create policy induction_day_sections_platform_operator_insert
  on induction_day_sections for insert
  to authenticated
  with check (current_company_is_platform_operator());
