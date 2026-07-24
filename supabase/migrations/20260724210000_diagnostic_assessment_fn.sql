do $$
declare
  v_def text;
  v_col_count int;
begin
  select pg_get_functiondef('public.assessment_company_id(uuid)'::regprocedure) into v_def;
  raise notice 'FUNCTION DEF: %', v_def;

  select count(*) into v_col_count
  from information_schema.columns
  where table_name = 'assessments' and column_name = 'company_id';
  raise notice 'company_id column exists: %', v_col_count;
end $$;
