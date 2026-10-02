-- Undo 20261002140000_induction_open_mode_and_auto_send.sql
drop table if exists public.platform_auto_send_targets;
alter table public.induction_days drop column if exists unlock_mode;
