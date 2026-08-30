-- White-label attribution text shown in the Market Analytics dashboard
-- footer (e.g. "Data compiled from RERA filings and internal broker
-- network"). Free-text, tenant-editable via the existing
-- companies_update_own RLS policy — no new policy needed, this is just
-- another column on the same row a company's own admin can already update.

alter table companies add column if not exists market_analytics_source_note text;
