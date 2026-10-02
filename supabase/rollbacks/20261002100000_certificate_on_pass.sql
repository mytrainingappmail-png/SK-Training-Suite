-- Undo 20261002100000_certificate_on_pass.sql (certificates already issued by it are kept).
drop trigger if exists trg_issue_certificate_on_pass on public.assessment_results;
drop function if exists public.issue_certificate_on_pass();
