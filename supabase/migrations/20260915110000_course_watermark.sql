-- Course watermark — a per-course, platform-operator-only toggle (frontend
-- gate: is_platform_operator, same pattern as Market Analytics/Live Quiz)
-- that overlays a faint brand mark on a course's WRITTEN/TEXT lesson
-- content only, never on video. Plain columns on `courses` rather than a
-- new table since it's one flag + one text per course, nothing relational.
--
-- No Content Distribution changes needed: cloneCourse() already spreads
-- every column it doesn't explicitly override (`...courseRest`), so these
-- two travel automatically into any company a course gets cloned into.

alter table courses
  add column watermark_enabled boolean not null default false,
  add column watermark_text text;
