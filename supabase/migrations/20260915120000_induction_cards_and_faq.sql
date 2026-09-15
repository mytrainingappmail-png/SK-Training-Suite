-- Induction rebuild, round 2 — brings Induction Days up to full parity
-- with Real Estate Projects (their explicit design template): a real
-- thumbnail per Day (so the employee view can use the same card grid as
-- Projects, via ThumbnailCard), and FAQ as a third section type
-- alongside the existing Page/Test (matching real_estate_project_sections'
-- exact shape: section_type in ('page','test','faq') + faq_items jsonb).
--
-- "Configurable test attempts" needs no new column here — it already
-- exists on assessments.maximum_attempts (set per-Assessment in Admin ->
-- Assessments) and is already enforced by the existing assessment-player
-- attempt-counting logic; a Day's Test section already just links to an
-- Assessment id, so it inherits that Assessment's attempts limit for free.
--
-- Date-based day-unlock gating (a day not opening until the calendar day
-- AFTER the previous one was completed) also needs no new column —
-- induction_day_completions.completed_at already has what's needed to
-- compute each day's earliest-unlock date client-side.

alter table induction_days
  add column thumbnail_url text;

alter table induction_day_sections
  drop constraint induction_day_sections_section_type_check,
  add constraint induction_day_sections_section_type_check check (section_type in ('page', 'test', 'faq')),
  add column faq_items jsonb not null default '[]'::jsonb;
