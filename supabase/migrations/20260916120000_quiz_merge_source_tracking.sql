-- Merging quizzes copies questions with no memory of which original
-- question each copy came from — source_label only records the source
-- QUIZ's title (for the existing "remove this project's questions"
-- feature), not a link to the actual source question row. That makes a
-- "pull the latest edit from the source" resync feature impossible today.
--
-- Nullable, self-referencing, ON DELETE SET NULL — deleting the original
-- question (or its whole quiz) should never take a merged copy down with
-- it; it just stops being resync-able.
alter table quiz_questions add column if not exists source_question_id uuid references quiz_questions(id) on delete set null;
