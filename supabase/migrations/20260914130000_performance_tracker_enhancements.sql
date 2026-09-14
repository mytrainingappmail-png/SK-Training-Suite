-- Performance Tracker v2 — manager feedback on evening reports, and
-- admin-editable reminder copy (nothing hardcoded — same principle as
-- Induction's admin-editable lock message).
-- Safe to run once; every statement is idempotent.

alter table pt_reports
  add column if not exists manager_comment text,
  add column if not exists manager_comment_by uuid references employees(id) on delete set null,
  add column if not exists manager_comment_at timestamptz;

alter table pt_settings
  add column if not exists morning_reminder_title text not null default 'Morning Commitment pending',
  add column if not exists morning_reminder_message text not null default 'You haven''t submitted today''s Morning Commitment on Performance Tracker yet.',
  add column if not exists evening_reminder_title text not null default 'Evening Report pending',
  add column if not exists evening_reminder_message text not null default 'You haven''t submitted today''s Evening Report on Performance Tracker yet.';

notify pgrst, 'reload schema';
