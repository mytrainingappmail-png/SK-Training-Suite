do $$
declare
  v_rec record;
  v_count int := 0;
begin
  for v_rec in
    select id, template_name, default_template
    from certificate_templates
  loop
    v_count := v_count + 1;
    raise notice 'TEMPLATE: id=% name=% default=%', v_rec.id, v_rec.template_name, v_rec.default_template;
  end loop;
  raise notice 'TOTAL: %', v_count;
end $$;
