-- Undo 20261004130000_induction_completion_certificate.sql
drop trigger if exists trg_induction_complete_on_day on public.induction_day_completions;
drop trigger if exists trg_induction_complete_on_pass on public.assessment_results;
drop function if exists public.induction_completion_trigger_day();
drop function if exists public.induction_completion_trigger_result();
drop function if exists public.induction_check_all_complete();
drop function if exists public.induction_finish_if_complete(uuid);
drop function if exists public.induction_program_complete(uuid, boolean);
drop function if exists public.induction_location_key(text, text);
drop function if exists public.induction_clean_text(text);
drop table if exists public.induction_settings;
-- certificates already issued by this feature (remarks 'induction:...') are left as they are
