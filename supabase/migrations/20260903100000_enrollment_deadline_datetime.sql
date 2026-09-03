-- Course assignment deadlines need hour-level precision ("complete within
-- 6 hours") not just a calendar date, since employees on the floor are
-- juggling training alongside real sales work. enrollments.due_date was a
-- plain `date` column (no time component) — widen it to timestamptz.
-- learning_path_enrollments.end_date is already timestamptz.
alter table enrollments alter column due_date type timestamptz using due_date::timestamptz;
