-- Induction: a new kind of section — "Focused projects". The admin picks which of the company's projects
-- that card shows; the employee gets the normal Projects experience, limited to those.
--
--  * induction_day_sections.project_ids : the chosen projects (uuid[]), in the order picked.
--  * section_type may now also be 'projects'.
--  * When the owner sends / updates a day in a company, the chosen projects are swapped for that
--    company's own copies of them (platform_content_map), so the copy shows the company's projects.
--    Only touches sections of this new type — nothing else about sending or updating changes.

alter table public.induction_day_sections add column if not exists project_ids uuid[];

alter table public.induction_day_sections drop constraint if exists induction_day_sections_section_type_check;
alter table public.induction_day_sections
  add constraint induction_day_sections_section_type_check check (section_type in ('page', 'test', 'faq', 'projects'));

-- Point every "projects" card of a company's COPIED days at the company's copies of the master's projects.
create or replace function public._pcm_remap_section_projects(p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update induction_day_sections t
     set project_ids = coalesce((
           select array_agg(pm.target_id order by u.ord)
             from unnest(s.project_ids) with ordinality as u(pid, ord)
             join platform_content_map pm on pm.kind = 'project' and pm.source_id = u.pid and pm.target_company_id = p_company
         ), '{}'::uuid[])
    from platform_content_map m
    join induction_day_sections s on s.id = m.source_id
   where m.kind = 'induction_section' and m.target_id = t.id and m.target_company_id = p_company
     and t.company_id = p_company and s.section_type = 'projects' and t.section_type = 'projects';
end $$;

-- same bodies as before, plus one remap call at the end (so a project sent AFTER its day is picked up too)
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
  perform _pcm_remap_section_projects(p_target_company);
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
  perform _pcm_remap_section_projects(p_target_company);
  return jsonb_build_object('updated', v_updated, 'missing', v_missing);
end $$;
