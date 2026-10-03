-- Undo 20261003120000_induction_locations.sql
alter table public.induction_day_sections drop column if exists locations;
alter table public.induction_days drop column if exists locations;
