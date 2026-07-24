do $$
declare
  v_rec record;
begin
  for v_rec in
    select e.id as employee_id, e.employee_code, e.company_id
    from employees e
    where e.employee_code = 'AMIT01'
  loop
    raise notice 'employee_id=% code=% company_id=%', v_rec.employee_id, v_rec.employee_code, v_rec.company_id;
  end loop;
end $$;
