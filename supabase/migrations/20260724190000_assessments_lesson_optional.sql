-- Project "Test" sections author their own assessment inline (no course
-- lesson involved), so lesson_id must be optional for that path while
-- staying required in spirit for course-linked assessments (enforced in
-- the app layer, not the DB, since course assessments always set it).
alter table assessments alter column lesson_id drop not null;
