do $$
declare
  v_rec record;
  v_qcount int;
begin
  for v_rec in
    select id, section_type, title, assessment_id
    from real_estate_project_sections
    where project_id = 'ea217eca-7a03-4699-965a-141658b69db8'
  loop
    raise notice 'section type=% title=% assessment=%', v_rec.section_type, v_rec.title, v_rec.assessment_id;
    if v_rec.assessment_id is not null then
      select count(*) into v_qcount from question_bank where assessment_id = v_rec.assessment_id;
      raise notice '  question count=%', v_qcount;
    end if;
  end loop;
end $$;
