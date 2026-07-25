do $$
declare
  v_rec record;
  v_count int := 0;
begin
  for v_rec in
    select id, employee_id, learning_path_id, company_id, active, status
    from learning_path_enrollments
    where employee_id = '53e54399-7ebe-477d-9ce9-d3d122b4652d'
  loop
    v_count := v_count + 1;
    raise notice 'ROW: id=% lp=% company_id=% active=% status=%', v_rec.id, v_rec.learning_path_id, v_rec.company_id, v_rec.active, v_rec.status;
  end loop;
  raise notice 'TOTAL ROWS: %', v_count;
end $$;
