-- Undo 20261004100000_induction_projects_section.sql
-- (first remove any 'projects' sections, otherwise the old constraint cannot be restored)
delete from public.induction_day_sections where section_type = 'projects';

alter table public.induction_day_sections drop constraint if exists induction_day_sections_section_type_check;
alter table public.induction_day_sections
  add constraint induction_day_sections_section_type_check check (section_type in ('page', 'test', 'faq'));
alter table public.induction_day_sections drop column if exists project_ids;

drop function if exists public._pcm_remap_section_projects(uuid);

-- put the two public functions back exactly as in 20261002160000_platform_content_clone_and_sync.sql
create or replace function public.platform_clone_content(p_kind text, p_source uuid, p_target_company uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_new uuid;
begin
  if not public.current_company_is_platform_operator() then
    raise exception 'Only the platform owner can send content to other companies.' using errcode = '42501';
  end if;
  if not exists (select 1 from companies where id = p_target_company) then raise exception 'Target company not found.'; end if;
  v_new := case p_kind
    when 'course' then _pcm_clone_course(p_source, p_target_company)
    when 'induction_day' then _pcm_clone_day(p_source, p_target_company)
    when 'project' then _pcm_clone_project(p_source, p_target_company)
    when 'video' then _pcm_clone_video(p_source, p_target_company)
    else null end;
  if v_new is null then raise exception 'Unknown content kind %', p_kind; end if;
  update platform_content_map set root_fingerprint = _pcm_fingerprint(p_kind, p_source), synced_at = now() where kind = p_kind and target_id = v_new;
  insert into content_distribution_log (kind, source_id, target_company_id) values (p_kind, p_source, p_target_company);
  return v_new;
end $$;

create or replace function public.platform_sync_content(p_kind text, p_source uuid, p_target_company uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; v_updated integer := 0; v_missing integer := 0; v_fp text; v_table regclass;
begin
  if not public.current_company_is_platform_operator() then
    raise exception 'Only the platform owner can update copies.' using errcode = '42501';
  end if;
  v_table := case p_kind when 'course' then 'courses'::regclass when 'induction_day' then 'induction_days'::regclass
                         when 'project' then 'real_estate_projects'::regclass when 'video' then 'library_videos'::regclass end;
  if v_table is null then raise exception 'Unknown content kind %', p_kind; end if;
  v_fp := _pcm_fingerprint(p_kind, p_source);
  for r in select target_id from platform_content_map where kind = p_kind and source_id = p_source and target_company_id = p_target_company loop
    if not _pcm_exists(v_table, r.target_id) then v_missing := v_missing + 1; continue; end if;
    if p_kind = 'course' then perform _pcm_sync_course(p_source, r.target_id, p_target_company);
    elsif p_kind = 'induction_day' then perform _pcm_sync_day(p_source, r.target_id, p_target_company);
    elsif p_kind = 'project' then perform _pcm_sync_project(p_source, r.target_id, p_target_company);
    else perform _pcm_sync_row('library_videos', p_source, r.target_id, array['company_id', 'subject_id', 'display_order', 'active']);
    end if;
    update platform_content_map set root_fingerprint = v_fp, synced_at = now() where kind = p_kind and target_id = r.target_id;
    v_updated := v_updated + 1;
  end loop;
  return jsonb_build_object('updated', v_updated, 'missing', v_missing);
end $$;
