do $$
declare v_id uuid;
begin
  select id into v_id from employees where employee_code = 'AMIT01' and active = true;
  raise notice 'NEW AMIT EMPLOYEE ID: %', v_id;
end $$;
