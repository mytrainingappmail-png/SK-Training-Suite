-- Rollback for 20261013100000_exam_live_control
drop trigger if exists trg_exam_block_stopped_answers on exam_answers;
drop trigger if exists trg_exam_block_stopped_submit on exam_participants;
drop function if exists exam_block_stopped_answers();
drop function if exists exam_block_stopped_submit();
drop function if exists stop_exam_participant(uuid, text);
drop function if exists resume_exam_participant(uuid);
drop function if exists get_exam_my_control(uuid);
drop function if exists get_exam_live_admin(uuid);
drop function if exists get_exam_live_questions(uuid);
alter table exam_participants drop column if exists stopped_at;
alter table exam_participants drop column if exists stop_reason;
