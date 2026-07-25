-- Lessons had no thumbnail column anywhere (unlike courses/modules/
-- learning_paths, which already had one) — needed so lesson cards can
-- show a real image like the rest of the video-library-style grids.
alter table lessons add column if not exists thumbnail text not null default '';
