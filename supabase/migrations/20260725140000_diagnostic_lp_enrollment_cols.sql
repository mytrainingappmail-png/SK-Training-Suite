do $$
declare
  v_cols text;
begin
  select string_agg(column_name || ':' || is_nullable, ', ') into v_cols
  from information_schema.columns
  where table_name = 'learning_path_enrollments';
  raise notice 'COLUMNS: %', v_cols;
end $$;
