-- Rollback: removes practice-mode functions/columns. The patched functions (certificates, shuffle, recycle bin, view) keep working
-- because practice sessions simply stop existing; re-apply the previous versions from earlier migrations if you need the exact old bodies.
drop function if exists public.purge_practice_sessions();
drop function if exists public.practice_leave(text, uuid);
drop function if exists public.mark_exam_session_practice(uuid);
delete from quiz_sessions where is_practice;
delete from exam_sessions where is_practice;
alter table quiz_sessions drop column if exists practice_purge_at;
alter table exam_sessions drop column if exists practice_purge_at;
-- (is_practice columns are kept: the view quiz_session_results and several functions now refer to them)
