-- A reading section / lesson can carry its own test and FAQ (instead of needing separate Test / FAQ cards):
-- the employee reads, then starts the test on the same card. Induction cards already have assessment_id, faq_items and a
-- config (config.test_required) - nothing to add there. Project sections and course lessons get the missing columns.
-- Only additive columns with defaults; nothing existing changes. The platform's copy / update / fingerprint functions copy
-- whole rows, so the new columns travel with every copy.

alter table public.real_estate_project_sections
  add column if not exists test_required boolean not null default true;

alter table public.lessons
  add column if not exists faq_items jsonb not null default '[]'::jsonb,
  add column if not exists test_required boolean not null default true;
