-- Tags each question with which quiz it originally came from when merged
-- (see mergeQuizzes) — merging itself already flattens the source quizzes'
-- questions into one list with no memory of where each one came from, so
-- there was previously no way to later say "remove just Project X's
-- questions" from an already-merged quiz. Null for a question created
-- directly (never merged).
alter table quiz_questions add column if not exists source_label text;
