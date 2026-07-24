do $$
declare
  r record;
begin
  for r in
    select column_name, is_nullable, data_type
    from information_schema.columns
    where table_name = 'real_estate_projects'
    order by ordinal_position
  loop
    raise notice 'column=% nullable=% type=%', r.column_name, r.is_nullable, r.data_type;
  end loop;
end $$;
