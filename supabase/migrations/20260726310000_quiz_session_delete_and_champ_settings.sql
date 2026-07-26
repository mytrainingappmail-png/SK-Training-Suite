-- Results & Analytics needs to let an editing admin delete a stale/test
-- session (or "Delete All"), which quiz_sessions never had a delete policy
-- for. Cascades on quiz_participants/quiz_answers/quiz_certificates already
-- reference quiz_sessions with "on delete cascade", so one delete here
-- cleans up everything belonging to the session.
drop policy if exists quiz_sessions_delete on quiz_sessions;
create policy quiz_sessions_delete on quiz_sessions
  for delete using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
