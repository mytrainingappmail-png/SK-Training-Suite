-- Undo 20261003110000_induction_standalone_part.sql
alter table public.induction_days drop column if exists standalone;
