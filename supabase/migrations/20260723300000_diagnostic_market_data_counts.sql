do $$
declare
  r record;
begin
  for r in
    select c.company_code, count(m.id) as entries
    from companies c
    left join market_data_entries m on m.company_id = c.id
    group by c.company_code
    order by c.company_code
  loop
    raise notice 'company=% market_data_entries=%', r.company_code, r.entries;
  end loop;
end $$;
