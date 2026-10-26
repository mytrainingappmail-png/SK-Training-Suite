-- Rollback: removes the rank-titles wording and the rank rows on certificates. Re-apply the earlier bodies of the three certificate functions,
-- get_quiz_player_settings and quiz_session_results from the earlier migrations afterwards.
drop function if exists public.get_my_exam_rank_title(uuid);
alter table public.quiz_settings drop column if exists rank_titles;
alter table public.quiz_settings drop column if exists rank_titles_enabled;
alter table public.quiz_certificates drop column if exists rank_no, drop column if exists title_override, drop column if exists achievement_override;
alter table public.exam_certificates drop column if exists rank_no, drop column if exists title_override, drop column if exists achievement_override;
