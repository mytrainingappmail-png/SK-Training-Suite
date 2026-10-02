-- Undo 20261002130000_client_error_log.sql
drop function if exists public.report_client_error(text, text, text, text);
drop table if exists public.client_errors;
