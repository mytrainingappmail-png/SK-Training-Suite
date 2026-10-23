-- Rollback: results go back to counting questions. Re-apply the previous bodies of quiz_session_results (20261022100000), get_my_result,
-- issue_my_certificate and issue_certificate_for_participant from earlier migrations, then:
drop trigger if exists trg_quiz_answers_marks on public.quiz_answers;
drop function if exists public.quiz_participant_refresh_marks();
-- (quiz_participants.marks_earned is kept: harmless)
