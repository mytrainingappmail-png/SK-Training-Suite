-- Market Analytics data was seeded for Realty Smartz (RSPL001) only.
-- The user wants both companies at parity — copy the same real 13-city,
-- 6-quarter dataset to S&K Enterprise (SKE001) too, so neither company's
-- dashboard looks less complete than the other's.

insert into market_data_entries (
  company_id, city_name, state_name, year, quarter, segment, trend,
  avg_rate, rental_avg, demand_index, supply_index,
  bhk_demand, price_segment, micromarkets, price_index,
  created_by, created_by_name
)
select
  (select id from companies where company_code = 'SKE001'),
  m.city_name, m.state_name, m.year, m.quarter, m.segment, m.trend,
  m.avg_rate, m.rental_avg, m.demand_index, m.supply_index,
  m.bhk_demand, m.price_segment, m.micromarkets, m.price_index,
  null, 'System (copied for parity with Realty Smartz)'
from market_data_entries m
where m.company_id = (select id from companies where company_code = 'RSPL001')
  and not exists (
    select 1 from market_data_entries existing
    where existing.company_id = (select id from companies where company_code = 'SKE001')
      and existing.city_name = m.city_name
      and existing.year = m.year
      and existing.quarter = m.quarter
  );

update companies set market_analytics_enabled = true where company_code = 'SKE001';
