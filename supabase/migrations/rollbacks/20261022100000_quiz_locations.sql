-- Rollback: removes the location columns and list. The results view keeps working after re-creating it without location_id (see 20261021100000).
drop trigger if exists trg_quiz_session_location on public.quiz_sessions;
drop trigger if exists trg_exam_session_location on public.exam_sessions;
drop function if exists public.session_take_quiz_location();
drop view if exists quiz_session_results cascade;
-- re-create quiz_session_results from migration 20261021100000 here, then:
alter table public.quiz_sessions drop column if exists location_id;
alter table public.exam_sessions drop column if exists location_id;
alter table public.quizzes drop column if exists location_id;
drop table if exists public.quiz_locations;
