-- Rollback: removes the open-link feature. Re-apply the earlier quiz_move_ahead / quiz_participant_heartbeat bodies (20261019100000 / base) afterwards.
drop trigger if exists trg_open_exam_attempt_release on public.exam_sessions;
drop trigger if exists trg_open_exam_attempt_finish on public.exam_participants;
drop function if exists public.open_exam_attempt_release();
drop function if exists public.open_exam_attempt_finish();
drop function if exists public.open_test_sweep(uuid);
drop function if exists public.get_open_test_attempts(uuid);
drop function if exists public.start_open_test(text, text);
drop function if exists public.get_open_test_info(text);
delete from quiz_sessions where open_link_id is not null;
delete from exam_sessions where open_link_id is not null;
alter table public.quiz_sessions drop column if exists open_link_id;
alter table public.exam_sessions drop column if exists open_link_id;
drop table if exists public.quiz_open_links;
