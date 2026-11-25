-- Undo 20261126100000_ai_summary.sql
delete from public.company_modules where module_key = 'ai_summary';
delete from public.app_modules where key = 'ai_summary';
drop table if exists public.content_summaries;
