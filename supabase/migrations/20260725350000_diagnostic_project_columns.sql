do $$
declare
  v_cols text;
begin
  select string_agg(column_name, ', ') into v_cols
  from information_schema.columns
  where table_name = 'real_estate_projects';
  raise notice 'COLUMNS: %', v_cols;
end $$;
