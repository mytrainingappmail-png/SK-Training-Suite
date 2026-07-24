do $$
declare
  r record;
begin
  for r in
    select c.company_code, cat.category_name, p.project_name, p.created_at,
           (select count(*) from real_estate_project_brochures b where b.project_id = p.id) as brochure_count,
           (select count(*) from real_estate_project_sections s where s.project_id = p.id) as section_count
    from real_estate_projects p
    join real_estate_project_categories cat on cat.id = p.category_id
    join companies c on c.id = p.company_id
    order by p.created_at asc
  loop
    raise notice 'company=% category=% project=% created=% brochures=% sections=%',
      r.company_code, r.category_name, r.project_name, r.created_at, r.brochure_count, r.section_count;
  end loop;
end $$;
