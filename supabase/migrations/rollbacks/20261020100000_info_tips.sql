-- Rollback for 20261020100000_info_tips.sql
drop function if exists public.info_tips_is_owner();
drop table if exists public.info_tips;
drop function if exists public.info_tips_touch();
