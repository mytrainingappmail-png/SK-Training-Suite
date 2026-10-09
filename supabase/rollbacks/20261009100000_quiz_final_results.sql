-- Rollback for 20261009100000_quiz_final_results: removes the separate Final Result storage.
-- (Sessions filed via quiz_sessions.folder_id are untouched; the saved copies are lost.)
drop table if exists quiz_final_results;
