do $$
declare
  r record;
begin
  for r in select company_code, company_name, market_analytics_enabled from companies order by created_at asc loop
    raise notice 'company=% name=% market_analytics_enabled=%', r.company_code, r.company_name, r.market_analytics_enabled;
  end loop;
end $$;
