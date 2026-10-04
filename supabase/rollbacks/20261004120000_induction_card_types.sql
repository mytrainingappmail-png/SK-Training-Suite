-- Undo 20261004120000_induction_card_types.sql
-- (cards of the new kinds are removed first, otherwise the old constraint cannot be restored)
delete from public.induction_day_sections where section_type in ('acknowledge', 'feedback', 'task', 'contact');

drop table if exists public.induction_card_responses;
drop function if exists public.induction_card_responses_touch();

alter table public.induction_day_sections drop constraint if exists induction_day_sections_section_type_check;
alter table public.induction_day_sections
  add constraint induction_day_sections_section_type_check check (section_type in ('page', 'test', 'faq', 'projects'));
alter table public.induction_day_sections drop constraint if exists induction_day_sections_requirement_check;
alter table public.induction_day_sections drop column if exists requirement;
alter table public.induction_day_sections drop column if exists config;
