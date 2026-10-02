-- Linking copies that already exist.
--
-- Content the owner built inside a company (for example RMT001) and later copied into the PLATFORM master
-- has no memory of being "the same thing". This links such pairs, ONLY when the two are identical in
-- structure (same chapters / sections / lessons / files / questions, same titles, same order), so that
-- later corrections made in the master also reach the company's existing items. A pair that differs in any
-- way is left alone and reported, so nothing can be duplicated or mixed up.

create or replace function public._pcm_link(p_kind text, p_src uuid, p_dst uuid, p_company uuid, p_parent uuid) returns void
language sql security definer set search_path = public as $$
  insert into platform_content_map (kind, source_id, target_id, target_company_id, parent_target_id)
  values (p_kind, p_src, p_dst, p_company, p_parent) on conflict (kind, target_id) do nothing;
$$;

create or replace function public._pcm_link_assessment(p_src uuid, p_dst uuid, p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
declare qs uuid[]; qd uuid[]; os uuid[]; od uuid[]; i integer; j integer;
begin
  select array_agg(id order by display_order, question_text) into qs from question_bank where assessment_id = p_src;
  select array_agg(id order by display_order, question_text) into qd from question_bank where assessment_id = p_dst;
  if coalesce(array_length(qs, 1), 0) <> coalesce(array_length(qd, 1), 0) then raise exception 'test has a different number of questions'; end if;
  perform _pcm_link('assessment', p_src, p_dst, p_company, null);
  for i in 1 .. coalesce(array_length(qs, 1), 0) loop
    if (select question_text from question_bank where id = qs[i]) is distinct from (select question_text from question_bank where id = qd[i]) then
      raise exception 'a test question differs';
    end if;
    perform _pcm_link('question', qs[i], qd[i], p_company, p_dst);
    select array_agg(id order by display_order, option_text) into os from question_options where question_id = qs[i];
    select array_agg(id order by display_order, option_text) into od from question_options where question_id = qd[i];
    if coalesce(array_length(os, 1), 0) <> coalesce(array_length(od, 1), 0) then raise exception 'a test question has different answers'; end if;
    for j in 1 .. coalesce(array_length(os, 1), 0) loop
      if (select option_text from question_options where id = os[j]) is distinct from (select option_text from question_options where id = od[j]) then
        raise exception 'a test answer differs';
      end if;
      perform _pcm_link('option', os[j], od[j], p_company, qd[i]);
    end loop;
  end loop;
end $$;

create or replace function public._pcm_link_course(p_src uuid, p_dst uuid, p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ms uuid[]; md uuid[]; ls uuid[]; ld uuid[]; rs uuid[]; rd uuid[]; i integer; j integer; k integer; a_s uuid; a_d uuid;
begin
  perform _pcm_link('course', p_src, p_dst, p_company, null);
  select array_agg(id order by module_order, module_name) into ms from modules where course_id = p_src;
  select array_agg(id order by module_order, module_name) into md from modules where course_id = p_dst;
  if coalesce(array_length(ms, 1), 0) <> coalesce(array_length(md, 1), 0) then raise exception 'different number of chapters'; end if;
  for i in 1 .. coalesce(array_length(ms, 1), 0) loop
    if (select module_name from modules where id = ms[i]) is distinct from (select module_name from modules where id = md[i]) then raise exception 'a chapter differs'; end if;
    perform _pcm_link('module', ms[i], md[i], p_company, p_dst);
    select array_agg(id order by display_order, lesson_title) into ls from lessons where module_id = ms[i];
    select array_agg(id order by display_order, lesson_title) into ld from lessons where module_id = md[i];
    if coalesce(array_length(ls, 1), 0) <> coalesce(array_length(ld, 1), 0) then raise exception 'different number of lessons'; end if;
    for j in 1 .. coalesce(array_length(ls, 1), 0) loop
      if (select lesson_title || '|' || lesson_type from lessons where id = ls[j]) is distinct from (select lesson_title || '|' || lesson_type from lessons where id = ld[j]) then raise exception 'a lesson differs'; end if;
      perform _pcm_link('lesson', ls[j], ld[j], p_company, md[i]);
      select array_agg(id order by display_order, resource_title) into rs from learning_resources where lesson_id = ls[j];
      select array_agg(id order by display_order, resource_title) into rd from learning_resources where lesson_id = ld[j];
      if coalesce(array_length(rs, 1), 0) <> coalesce(array_length(rd, 1), 0) then raise exception 'different number of files'; end if;
      for k in 1 .. coalesce(array_length(rs, 1), 0) loop
        perform _pcm_link('resource', rs[k], rd[k], p_company, ld[j]);
      end loop;
      select id into a_s from assessments where lesson_id = ls[j] limit 1;
      select id into a_d from assessments where lesson_id = ld[j] limit 1;
      if (a_s is null) <> (a_d is null) then raise exception 'a lesson test differs'; end if;
      if a_s is not null then perform _pcm_link_assessment(a_s, a_d, p_company); end if;
    end loop;
  end loop;
end $$;

create or replace function public._pcm_link_day(p_src uuid, p_dst uuid, p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ss uuid[]; sd uuid[]; i integer; a_s uuid; a_d uuid;
begin
  perform _pcm_link('induction_day', p_src, p_dst, p_company, null);
  select array_agg(id order by display_order, title) into ss from induction_day_sections where day_id = p_src;
  select array_agg(id order by display_order, title) into sd from induction_day_sections where day_id = p_dst;
  if coalesce(array_length(ss, 1), 0) <> coalesce(array_length(sd, 1), 0) then raise exception 'different number of sections'; end if;
  for i in 1 .. coalesce(array_length(ss, 1), 0) loop
    if (select title || '|' || section_type from induction_day_sections where id = ss[i]) is distinct from (select title || '|' || section_type from induction_day_sections where id = sd[i]) then raise exception 'a section differs'; end if;
    perform _pcm_link('induction_section', ss[i], sd[i], p_company, p_dst);
    select assessment_id into a_s from induction_day_sections where id = ss[i];
    select assessment_id into a_d from induction_day_sections where id = sd[i];
    if (a_s is null) <> (a_d is null) then raise exception 'a section test differs'; end if;
    if a_s is not null then perform _pcm_link_assessment(a_s, a_d, p_company); end if;
  end loop;
end $$;

create or replace function public._pcm_link_project(p_src uuid, p_dst uuid, p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ss uuid[]; sd uuid[]; bs uuid[]; bd uuid[]; i integer; a_s uuid; a_d uuid;
begin
  perform _pcm_link('project', p_src, p_dst, p_company, null);
  select array_agg(id order by display_order, title) into ss from real_estate_project_sections where project_id = p_src;
  select array_agg(id order by display_order, title) into sd from real_estate_project_sections where project_id = p_dst;
  if coalesce(array_length(ss, 1), 0) <> coalesce(array_length(sd, 1), 0) then raise exception 'different number of sections'; end if;
  for i in 1 .. coalesce(array_length(ss, 1), 0) loop
    if (select title || '|' || section_type from real_estate_project_sections where id = ss[i]) is distinct from (select title || '|' || section_type from real_estate_project_sections where id = sd[i]) then raise exception 'a section differs'; end if;
    perform _pcm_link('project_section', ss[i], sd[i], p_company, p_dst);
    select assessment_id into a_s from real_estate_project_sections where id = ss[i];
    select assessment_id into a_d from real_estate_project_sections where id = sd[i];
    if (a_s is null) <> (a_d is null) then raise exception 'a section test differs'; end if;
    if a_s is not null then perform _pcm_link_assessment(a_s, a_d, p_company); end if;
  end loop;
  select array_agg(id order by title, file_url) into bs from real_estate_project_brochures where project_id = p_src;
  select array_agg(id order by title, file_url) into bd from real_estate_project_brochures where project_id = p_dst;
  if coalesce(array_length(bs, 1), 0) <> coalesce(array_length(bd, 1), 0) then raise exception 'different number of brochures'; end if;
  for i in 1 .. coalesce(array_length(bs, 1), 0) loop
    perform _pcm_link('brochure', bs[i], bd[i], p_company, p_dst);
  end loop;
end $$;

revoke all on function public._pcm_link(text, uuid, uuid, uuid, uuid), public._pcm_link_assessment(uuid, uuid, uuid), public._pcm_link_course(uuid, uuid, uuid),
  public._pcm_link_day(uuid, uuid, uuid), public._pcm_link_project(uuid, uuid, uuid) from public, anon, authenticated;

-- Finds the company's existing twin of each of the owner's items (same code / same title) and links the identical ones.
create or replace function public.platform_link_existing_copies(p_target_company uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.current_employee_company_id(); r record; v_dst uuid; v_n integer; v_linked integer := 0; v_skipped jsonb := '[]'::jsonb;
begin
  if not public.current_company_is_platform_operator() then
    raise exception 'Only the platform owner can do this.' using errcode = '42501';
  end if;

  -- courses: the master's code is "PLT-<code>"
  for r in select id, course_name, course_code from courses c where c.company_id = v_me and c.course_code like 'PLT-%'
           and not exists (select 1 from platform_content_map m where m.kind = 'course' and m.source_id = c.id and m.target_company_id = p_target_company) loop
    select count(*), min(id::text)::uuid into v_n, v_dst from courses where company_id = p_target_company and course_code = substr(r.course_code, 5);
    if v_n = 1 and not exists (select 1 from platform_content_map where kind = 'course' and target_id = v_dst) then
      begin
        perform _pcm_link_course(r.id, v_dst, p_target_company);
        update platform_content_map set root_fingerprint = _pcm_fingerprint('course', r.id) where kind = 'course' and target_id = v_dst;
        v_linked := v_linked + 1;
      exception when others then v_skipped := v_skipped || to_jsonb('Course ' || r.course_name || ': ' || sqlerrm); end;
    end if;
  end loop;

  for r in select id, title from induction_days d where d.company_id = v_me and d.branch_id is null
           and not exists (select 1 from platform_content_map m where m.kind = 'induction_day' and m.source_id = d.id and m.target_company_id = p_target_company) loop
    select count(*), min(id::text)::uuid into v_n, v_dst from induction_days where company_id = p_target_company and title = r.title and branch_id is null;
    if v_n = 1 and not exists (select 1 from platform_content_map where kind = 'induction_day' and target_id = v_dst) then
      begin
        perform _pcm_link_day(r.id, v_dst, p_target_company);
        update platform_content_map set root_fingerprint = _pcm_fingerprint('induction_day', r.id) where kind = 'induction_day' and target_id = v_dst;
        v_linked := v_linked + 1;
      exception when others then v_skipped := v_skipped || to_jsonb('Induction day ' || r.title || ': ' || sqlerrm); end;
    end if;
  end loop;

  for r in select id, project_name from real_estate_projects p where p.company_id = v_me and p.branch_id is null
           and not exists (select 1 from platform_content_map m where m.kind = 'project' and m.source_id = p.id and m.target_company_id = p_target_company) loop
    select count(*), min(id::text)::uuid into v_n, v_dst from real_estate_projects where company_id = p_target_company and project_name = r.project_name and branch_id is null;
    if v_n = 1 and not exists (select 1 from platform_content_map where kind = 'project' and target_id = v_dst) then
      begin
        perform _pcm_link_project(r.id, v_dst, p_target_company);
        update platform_content_map set root_fingerprint = _pcm_fingerprint('project', r.id) where kind = 'project' and target_id = v_dst;
        v_linked := v_linked + 1;
      exception when others then v_skipped := v_skipped || to_jsonb('Project ' || r.project_name || ': ' || sqlerrm); end;
    end if;
  end loop;

  for r in select id, title, video_url from library_videos v where v.company_id = v_me
           and not exists (select 1 from platform_content_map m where m.kind = 'video' and m.source_id = v.id and m.target_company_id = p_target_company) loop
    select count(*), min(id::text)::uuid into v_n, v_dst from library_videos where company_id = p_target_company and title = r.title and video_url = r.video_url;
    if v_n = 1 and not exists (select 1 from platform_content_map where kind = 'video' and target_id = v_dst) then
      perform _pcm_link('video', r.id, v_dst, p_target_company, null);
      update platform_content_map set root_fingerprint = _pcm_fingerprint('video', r.id) where kind = 'video' and target_id = v_dst;
      v_linked := v_linked + 1;
    end if;
  end loop;

  return jsonb_build_object('linked', v_linked, 'skipped', v_skipped);
end $$;

revoke all on function public.platform_link_existing_copies(uuid) from public, anon;
grant execute on function public.platform_link_existing_copies(uuid) to authenticated;
