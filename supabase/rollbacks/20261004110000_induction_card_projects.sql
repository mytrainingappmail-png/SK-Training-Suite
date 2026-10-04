-- Undo 20261004110000_induction_card_projects.sql
-- (projects that live inside induction cards are deleted with the column, so turn them into ordinary ones first? No:
--  they belong to the cards and are removed here; main Projects are untouched.)
delete from public.real_estate_projects where induction_section_id is not null;

drop function if exists public.copy_project_independent(uuid, uuid);
create or replace function public._pcm_sync_project(p_src uuid, p_dst uuid, p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s record; b record; v_t uuid; v_dst_a uuid;
begin
  perform _pcm_sync_row('real_estate_projects', p_src, p_dst, array['company_id', 'category_id', 'branch_id', 'source_id', 'display_order', 'active']);
  for s in select id, assessment_id from real_estate_project_sections where project_id = p_src order by display_order loop
    v_t := _pcm_child('project_section', s.id, p_dst);
    if v_t is null then
      perform _pcm_clone_project_section(s.id, p_dst, p_company);
    elsif _pcm_exists('real_estate_project_sections', v_t) then
      perform _pcm_sync_row('real_estate_project_sections', s.id, v_t, array['company_id', 'project_id', 'assessment_id']);
      if s.assessment_id is not null then
        select assessment_id into v_dst_a from real_estate_project_sections where id = v_t;
        if v_dst_a is not null and _pcm_exists('assessments', v_dst_a) then
          perform _pcm_sync_assessment(s.assessment_id, v_dst_a, p_company);
        elsif v_dst_a is null then
          update real_estate_project_sections set assessment_id = _pcm_clone_assessment(s.assessment_id, p_company, null) where id = v_t;
        end if;
      end if;
    end if;
  end loop;
  for b in select id from real_estate_project_brochures where project_id = p_src loop
    v_t := _pcm_child('brochure', b.id, p_dst);
    if v_t is null then
      perform _pcm_clone_row('real_estate_project_brochures', b.id, jsonb_build_object('project_id', p_dst), 'brochure', p_company, p_dst);
    elsif _pcm_exists('real_estate_project_brochures', v_t) then
      perform _pcm_sync_row('real_estate_project_brochures', b.id, v_t, array['project_id']);
    end if;
  end loop;
end $$;

create or replace function public._pcm_clone_day_section(p_src uuid, p_day uuid, p_company uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_test uuid; v_new uuid; v_a uuid;
begin
  select assessment_id into v_a from induction_day_sections where id = p_src;
  if v_a is not null then v_test := _pcm_clone_assessment(v_a, p_company, null); end if;
  v_new := _pcm_clone_row('induction_day_sections', p_src, jsonb_build_object('company_id', p_company, 'day_id', p_day, 'assessment_id', v_test), 'induction_section', p_company, p_day);
  return v_new;
end $$;

create or replace function public._pcm_sync_day(p_src uuid, p_dst uuid, p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s record; v_s uuid; v_src_a uuid; v_dst_a uuid;
begin
  perform _pcm_sync_row('induction_days', p_src, p_dst, array['company_id', 'branch_id', 'source_id', 'display_order', 'active']);
  for s in select id, assessment_id from induction_day_sections where day_id = p_src order by display_order loop
    v_s := _pcm_child('induction_section', s.id, p_dst);
    if v_s is null then
      perform _pcm_clone_day_section(s.id, p_dst, p_company);
    elsif _pcm_exists('induction_day_sections', v_s) then
      perform _pcm_sync_row('induction_day_sections', s.id, v_s, array['company_id', 'day_id', 'assessment_id']);
      if s.assessment_id is not null then
        select assessment_id into v_dst_a from induction_day_sections where id = v_s;
        if v_dst_a is not null and _pcm_exists('assessments', v_dst_a) then
          perform _pcm_sync_assessment(s.assessment_id, v_dst_a, p_company);
        elsif v_dst_a is null then
          update induction_day_sections set assessment_id = _pcm_clone_assessment(s.assessment_id, p_company, null) where id = v_s;
        end if;
      end if;
    end if;       -- card deleted by the company: stays deleted
  end loop;
end $$;

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

drop function if exists public._pcm_clone_card_projects(uuid, uuid, uuid);
drop function if exists public._pcm_sync_card_projects(uuid, uuid, uuid);
drop index if exists public.real_estate_projects_induction_section_idx;
alter table public.real_estate_projects drop column if exists induction_section_id;
