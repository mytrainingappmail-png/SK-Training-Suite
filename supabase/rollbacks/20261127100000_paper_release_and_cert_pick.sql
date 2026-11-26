-- Undo 20261127100000_paper_release_and_cert_pick.sql: drops the new columns and helper functions. Re-run the earlier definitions of issue_my_certificate, issue_certificate_for_participant, issue_exam_certificate, get_quiz_player_settings and get_my_answer_review (migrations 20261027100000 / 20260920100000) to restore their old behaviour.
drop trigger if exists trg_quiz_sessions_paper_mode on public.quiz_sessions;
drop function if exists public.quiz_sessions_set_paper_mode();
drop function if exists public.release_quiz_paper(uuid, boolean, integer);
