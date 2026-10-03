-- Undo 20261003100000_induction_day_label.sql
alter table public.induction_days drop column if exists day_label;
