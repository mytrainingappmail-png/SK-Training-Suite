-- Rollback for 20261013110000_quiz_live_control
drop trigger if exists trg_quiz_block_stopped_answers on quiz_answers;
drop function if exists quiz_block_stopped_answers();
drop function if exists stop_quiz_participant(uuid, text);
drop function if exists resume_quiz_participant(uuid);
drop function if exists get_quiz_my_control(uuid);
drop function if exists get_quiz_live_admin(uuid);
alter table quiz_participants drop column if exists stopped_at;
alter table quiz_participants drop column if exists stop_reason;
