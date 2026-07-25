-- Admin-configurable page size for the Courses/Modules/Lessons card
-- grids (video-library style). Per-company since different companies
-- may want a denser or sparser catalog view.
alter table companies add column if not exists cards_per_page integer not null default 12;
