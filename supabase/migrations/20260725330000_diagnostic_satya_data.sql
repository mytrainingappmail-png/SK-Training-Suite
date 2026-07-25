do $$
declare
  v_rec record;
begin
  raise notice '--- SECTIONS ---';
  for v_rec in
    select id, section_type, title, assessment_id
    from real_estate_project_sections
    where project_id = '867af5f4-ba66-4cf9-8f6d-1dd0deecf895'
  loop
    raise notice 'section id=% type=% title=% assessment_id=%', v_rec.id, v_rec.section_type, v_rec.title, v_rec.assessment_id;
  end loop;

  raise notice '--- BROCHURES ---';
  for v_rec in
    select id, title, file_url
    from real_estate_project_brochures
    where project_id = '867af5f4-ba66-4cf9-8f6d-1dd0deecf895'
  loop
    raise notice 'brochure id=% title=% url=%', v_rec.id, v_rec.title, v_rec.file_url;
  end loop;
end $$;
