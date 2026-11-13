-- "Count each person's attempts on this test" - a switch per quiz / exam (both are rows of `quizzes`).
-- Off by default: tests that are run again and again on the floor are not counted. When it is on, the results screens
-- number each person's attempts (the same name, across the sessions of that test) and show on which attempt they passed.
-- Nothing else is stored: the attempts are worked out from the results that already exist.

alter table quizzes add column if not exists track_attempts boolean not null default false;
