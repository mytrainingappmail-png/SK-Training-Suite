-- Brings the existing course-level watermark (watermark_enabled/watermark_text, already
-- operator-only via the admin UI) up to the same controls as Induction/Real Estate Projects:
-- orientation, adjustable darkness, and an optional disable-copy toggle.
alter table courses add column if not exists watermark_orientation text not null default 'diagonal'
  check (watermark_orientation in ('horizontal', 'vertical', 'diagonal'));
alter table courses add column if not exists watermark_opacity int not null default 8 check (watermark_opacity between 3 and 40);
alter table courses add column if not exists no_copy boolean not null default false;
