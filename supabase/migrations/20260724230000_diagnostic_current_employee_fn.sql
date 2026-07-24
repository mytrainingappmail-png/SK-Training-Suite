do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.current_employee_company_id()'::regprocedure) into v_def;
  raise notice 'FUNCTION DEF: %', v_def;
end $$;
