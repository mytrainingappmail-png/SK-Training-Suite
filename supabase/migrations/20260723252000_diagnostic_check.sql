do $$
declare
  v_count int;
  v_row record;
begin
  select count(*) into v_count from companies;
  raise notice 'TOTAL COMPANIES: %', v_count;

  for v_row in select id, company_code, company_name from companies order by created_at loop
    raise notice 'COMPANY: id=% code=% name=%', v_row.id, v_row.company_code, v_row.company_name;
  end loop;
end $$;
