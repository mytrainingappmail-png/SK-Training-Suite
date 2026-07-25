do $$
declare
  v_rec record;
begin
  for v_rec in
    select c.id, c.certificate_no, c.certificate_title, c.employee_id, c.assessment_id, c.active, c.generated, c.template_name
    from certificates c
    join employees e on e.id = c.employee_id
    where e.company_id = '3b74953b-d4b1-46d5-99c4-0f8efa959277'
  loop
    raise notice 'CERT: id=% no=% title=% emp=% assess=% active=% generated=% template=%',
      v_rec.id, v_rec.certificate_no, v_rec.certificate_title, v_rec.employee_id, v_rec.assessment_id, v_rec.active, v_rec.generated, v_rec.template_name;
  end loop;
end $$;
