-- Rollback for 20261010120000_recycle_bin (anything still in the bin is lost)
drop trigger if exists trg_recycle_quiz on quizzes;
drop trigger if exists trg_recycle_quiz_session on quiz_sessions;
drop trigger if exists trg_recycle_exam_session on exam_sessions;
drop trigger if exists trg_recycle_survey on surveys;
drop function if exists recycle_quiz();
drop function if exists recycle_quiz_session();
drop function if exists recycle_exam_session();
drop function if exists recycle_survey();
drop function if exists restore_from_recycle_bin(uuid);
drop function if exists purge_recycle_bin();
drop table if exists recycle_bin;
