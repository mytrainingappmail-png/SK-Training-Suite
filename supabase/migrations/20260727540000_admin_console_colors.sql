-- Per-company Admin Console appearance -- each subscribing company's own
-- admin can pick their own background/button/border colors for the Super
-- Admin Console's grouped cards, instead of one hardcoded look for every
-- company. Lives directly on companies (like logo/favicon/branding
-- already do) rather than the separate global `themes` table, since this
-- needs to vary PER COMPANY, not platform-wide.
alter table companies
  add column if not exists admin_console_bg_color text not null default '#1e3a8a',
  add column if not exists admin_console_button_color text not null default '#eab308',
  add column if not exists admin_console_border_color text not null default '#facc15';
