-- Undo 20261002150000_induction_section_cards.sql
drop table if exists public.induction_section_views;
alter table public.induction_day_sections drop column if exists thumbnail_url;
