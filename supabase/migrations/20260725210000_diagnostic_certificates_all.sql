do $$
declare
  v_rec record;
  v_count int := 0;
begin
  for v_rec in
    select c.id, c.certificate_no, c.certificate_title, c.employee_id, c.assessment_id, c.active, c.generated, c.template_name, e.company_id, e.employee_code
    from certificates c
    join employees e on e.id = c.employee_id
    order by c.created_at desc
    limit 20
  loop
    v_count := v_count + 1;
    raise notice 'CERT: no=% title=% emp_code=% company=% active=% generated=% template=%',
      v_rec.certificate_no, v_rec.certificate_title, v_rec.employee_code, v_rec.company_id, v_rec.active, v_rec.generated, v_rec.template_name;
  end loop;
  raise notice 'TOTAL: %', v_count;
end $$;
