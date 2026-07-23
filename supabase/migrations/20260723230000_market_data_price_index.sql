-- Property Price Index (inspired by published real-estate price indices —
-- a normalized "base 100" index number tracked over time, not any specific
-- provider's proprietary numbers or branding). Optional and editable: if an
-- admin leaves it at 0, the dashboard computes a sensible default (100 at
-- the city's first entered quarter, scaled by avg_rate since); entering a
-- non-zero value here overrides that computed default for that quarter.

alter table market_data_entries add column if not exists price_index numeric not null default 0;
