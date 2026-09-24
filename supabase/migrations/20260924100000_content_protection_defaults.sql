-- Company-wide content-protection defaults (platform operator only) — set once, then every
-- NEW piece of content (Induction page, Project section, Course) starts with these settings
-- instead of "off", and a one-click "Apply to all" can stamp them onto everything that
-- already exists. Any individual item can still be switched off afterward via its own
-- existing per-item control — this only changes the starting point, never locks it.
alter table companies add column if not exists default_watermark_enabled boolean not null default false;
alter table companies add column if not exists default_watermark_text text;
alter table companies add column if not exists default_watermark_orientation text not null default 'diagonal'
  check (default_watermark_orientation in ('horizontal', 'vertical', 'diagonal'));
alter table companies add column if not exists default_watermark_opacity int not null default 12 check (default_watermark_opacity between 3 and 40);
alter table companies add column if not exists default_no_copy boolean not null default false;
