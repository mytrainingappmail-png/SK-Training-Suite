do $$
declare
  v_rec record;
begin
  for v_rec in
    select p.id, p.project_name, p.company_id, p.active,
      (select count(*) from real_estate_project_sections s where s.project_id = p.id) as section_count
    from real_estate_projects p
    where p.company_id = 'b259bfa8-bf5b-464f-b9a5-008d00efa1e4'
  loop
    raise notice 'PROJECT: id=% name=% active=% sections=%', v_rec.id, v_rec.project_name, v_rec.active, v_rec.section_count;
  end loop;
end $$;
