do $$
declare
  v_rec record;
begin
  for v_rec in
    select id, company_name, company_code
    from companies
    where id = 'b259bfa8-bf5b-464f-b9a5-008d00efa1e4'
  loop
    raise notice 'COMPANY: id=% name=% code=%', v_rec.id, v_rec.company_name, v_rec.company_code;
  end loop;

  for v_rec in
    select employee_code, first_name, last_name, auth_user_id
    from employees
    where company_id = 'b259bfa8-bf5b-464f-b9a5-008d00efa1e4' and employee_code = '00002'
  loop
    raise notice 'EMP: code=% name=% % auth_user_id=%', v_rec.employee_code, v_rec.first_name, v_rec.last_name, v_rec.auth_user_id;
  end loop;
end $$;
