-- Content protection for Real Estate Project briefs and Induction pages — the two content
-- types actively at risk of being cloned to another company via Content Distribution and
-- then presented as that company's own original work.
--
-- Deliberately NOT gated by column-level RLS: this app has no such gate anywhere else
-- (market_analytics_enabled/live_quiz_enabled use the same convention), so this matches the
-- existing "operator-only" pattern — the ADMIN UI simply never shows these controls unless
-- the logged-in admin's own company has is_platform_operator = true. A clone copies every
-- column of the source row (see contentDistributionService.ts), so a watermark set on the
-- original survives being cloned automatically, with no special-case code needed there — the
-- receiving company's admin UI just never offers a way to see or change it.

alter table real_estate_project_sections add column if not exists watermark_enabled boolean not null default false;
alter table real_estate_project_sections add column if not exists watermark_text text;
alter table real_estate_project_sections add column if not exists watermark_orientation text not null default 'diagonal' check (watermark_orientation in ('horizontal', 'vertical', 'diagonal'));
alter table real_estate_project_sections add column if not exists watermark_opacity int not null default 12 check (watermark_opacity between 3 and 40);
alter table real_estate_project_sections add column if not exists no_copy boolean not null default false;

alter table induction_day_sections add column if not exists watermark_enabled boolean not null default false;
alter table induction_day_sections add column if not exists watermark_text text;
alter table induction_day_sections add column if not exists watermark_orientation text not null default 'diagonal' check (watermark_orientation in ('horizontal', 'vertical', 'diagonal'));
alter table induction_day_sections add column if not exists watermark_opacity int not null default 12 check (watermark_opacity between 3 and 40);
alter table induction_day_sections add column if not exists no_copy boolean not null default false;
