-- Rolls the schema pieces back; re-apply the previous definitions of create_exam_session / submit_quiz_answer /
-- submit_quiz_hotspot_answer from migrations 20261001140000 / 20261001220000 if the functions must also be reverted.
drop policy if exists quiz_answers_visible on quiz_answers;
create policy quiz_answers_visible on quiz_answers for select using (
  quiz_session_company_id(session_id) = current_quiz_admin_company_id() or is_my_quiz_participant(participant_id)
);
drop function if exists quiz_answers_open_to_player(uuid);
alter table quiz_sessions drop column if exists reveal_answers;
alter table quiz_settings drop column if exists quiz_reveal_answers;
alter table quizzes drop column if exists reveal_answers;
