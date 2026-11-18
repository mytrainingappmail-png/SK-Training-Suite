-- Induction Day <-> Course Module copies, with an optional "update the other one too".
--
--   * copy_day_to_course_module(day, course)   : an Induction Day becomes a Module of a Course.
--                                                page cards -> text lessons, test cards -> quiz lessons (with the questions).
--   * copy_module_to_induction_day(module)     : a Course Module becomes an Induction Day.
--                                                text lessons -> page cards, quiz lessons -> test cards (with the questions).
--   Cards / lessons that have no counterpart on the other side (FAQ, Projects, Task, Contact... cards; video lessons) are
--   NOT copied; the function answers with the list of what was left out so the screen can say so.
--
--   * Every copy REMEMBERS its original (day_module_links + day_module_map: which card is which lesson, which question is
--     which question), so one click - or an automatic update when the editor is closed, if the admin switches it on - brings
--     the other side up to date:
--       sync_day_module_copy(from_kind, from, to)  : title / description / picture / page text / test settings and questions
--                                                    are updated IN PLACE on the other side and what is new is added.
--   * DELETING has no link at all. Deleting a Day, a Module, a card or a lesson never deletes anything on the other side (the
--     link rows simply disappear with it), and an update never removes anything: what was removed here stays over there, and
--     what the admin deleted over there is NOT brought back.
--   * Where the copy lives (course, order, active, branch, locations) is never touched by an update.
--
-- It reuses the tested in-place test helpers of the platform content sync (_pcm_clone_assessment / _pcm_sync_assessment). Their
-- bookkeeping table is only borrowed for the length of one call and emptied again, exactly like the linked project copies.
-- Additive only (two new tables + functions).

create table if not exists public.day_module_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  day_id uuid not null references public.induction_days(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  auto_from_day boolean not null default false,      -- update the Module automatically when the Day is closed after changes
  auto_from_module boolean not null default false,   -- update the Day automatically when the Module is left after changes
  fp_day text,                                       -- how each side looked at the last sync (to tell "changed since")
  fp_module text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (day_id, module_id)
);
create index if not exists idx_day_module_links_day on public.day_module_links (day_id);
create index if not exists idx_day_module_links_module on public.day_module_links (module_id);
create index if not exists idx_day_module_links_company on public.day_module_links (company_id);

-- a_* = the Induction (Day) side, b_* = the Course (Module) side
create table if not exists public.day_module_map (
  link_id uuid not null references public.day_module_links(id) on delete cascade,
  kind text not null,                                -- item (card <-> lesson) | assessment | question | option
  a_id uuid not null,
  b_id uuid not null,
  parent_a uuid,
  parent_b uuid,
  primary key (link_id, kind, a_id)
);
create unique index if not exists day_module_map_b_idx on public.day_module_map (link_id, kind, b_id);

alter table public.day_module_links enable row level security;
alter table public.day_module_map enable row level security;
revoke all on public.day_module_links from anon, authenticated;     -- reachable only through the functions below
revoke all on public.day_module_map from anon, authenticated;

-- ── what a Day / a Module "looks like" (only the things that travel), to tell whether it changed since the last sync ──
create or replace function public._dmc_fp_day(p_day uuid) returns text
language sql stable security definer set search_path = public as $$
  select md5(
    coalesce((select coalesce(d.title, '') || '|' || coalesce(d.description, '') || '|' || coalesce(d.thumbnail_url, '') from induction_days d where d.id = p_day), '') ||
    coalesce((select string_agg(s.section_type || '|' || s.title || '|' || coalesce(s.page_content, '') || '|' || coalesce(s.thumbnail_url, '') || '|' ||
                                coalesce(case when s.assessment_id is not null then public._pcl_fp_assessment(s.assessment_id) end, ''),
                                E'\n' order by s.display_order, s.title, s.id)
                from induction_day_sections s where s.day_id = p_day and s.section_type in ('page', 'test')), ''));
$$;

create or replace function public._dmc_fp_module(p_module uuid) returns text
language sql stable security definer set search_path = public as $$
  select md5(
    coalesce((select coalesce(m.module_name, '') || '|' || coalesce(m.description, '') || '|' || coalesce(m.thumbnail, '') from modules m where m.id = p_module), '') ||
    coalesce((select string_agg(l.lesson_type || '|' || l.lesson_title || '|' || coalesce(l.content, '') || '|' || coalesce(l.thumbnail, '') || '|' ||
                                coalesce((select public._pcl_fp_assessment(a.id) from assessments a where a.lesson_id = l.id limit 1), ''),
                                E'\n' order by l.display_order, l.lesson_title, l.id)
                from lessons l where l.module_id = p_module and l.lesson_type in ('text', 'quiz') and coalesce(l.active, true)), ''));
$$;

-- ── remember the tests (assessment / question / option pairs) that a clone or a sync just created ──
-- (same method as the linked project copies: the shared copier writes its "what came from what" rows into
-- platform_content_map; they are read here, kept in day_module_map and then removed from the platform table again)
create or replace function public._dmc_capture_new(p_link uuid, p_from_is_a boolean, p_temp uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare n record; v_a uuid; v_b uuid; v_pa uuid; v_pb uuid;
begin
  for n in
    select kind, source_id, target_id, parent_target_id from platform_content_map
     where xmin::text::bigint = (txid_current() & 4294967295) and kind in ('assessment', 'question', 'option') and target_id <> all (p_temp)
     order by case kind when 'assessment' then 1 when 'question' then 2 else 3 end
  loop
    if p_from_is_a then
      v_a := n.source_id; v_b := n.target_id; v_pb := n.parent_target_id;
      v_pa := (select m.a_id from day_module_map m where m.link_id = p_link and m.b_id = v_pb and m.kind <> 'item' limit 1);
    else
      v_b := n.source_id; v_a := n.target_id; v_pa := n.parent_target_id;
      v_pb := (select m.b_id from day_module_map m where m.link_id = p_link and m.a_id = v_pa and m.kind <> 'item' limit 1);
    end if;
    insert into day_module_map (link_id, kind, a_id, b_id, parent_a, parent_b) values (p_link, n.kind, v_a, v_b, v_pa, v_pb) on conflict do nothing;
  end loop;
  -- the borrowed rows (lent for this call, and the ones just created) are emptied again; the lent ones were written inside a
  -- sub-block, so they are also removed by id
  delete from platform_content_map where xmin::text::bigint = (txid_current() & 4294967295) or target_id = any (p_temp);
end $$;

-- ── the two copies ──
create or replace function public.copy_day_to_course_module(p_day uuid, p_course uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d induction_days%rowtype; v_course_company uuid; v_mod uuid; v_link uuid; s record; v_les uuid;
  v_copied integer := 0; v_skipped jsonb := '[]'::jsonb; v_order integer := 0; v_temp uuid[] := '{}'::uuid[];
begin
  select * into d from induction_days where id = p_day;
  if not found then raise exception 'Induction day not found.'; end if;
  if d.company_id is distinct from public.current_employee_company_id() and not public.current_company_is_platform_operator() then
    raise exception 'You can only copy your own company''s days.' using errcode = '42501';
  end if;
  select company_id into v_course_company from courses where id = p_course;
  if v_course_company is null then raise exception 'Course not found.'; end if;
  if v_course_company is distinct from d.company_id then raise exception 'Choose a course of the same company.'; end if;

  insert into modules (course_id, module_name, description, module_order, active, thumbnail)
  values (p_course, d.title, d.description, coalesce((select max(m.module_order) from modules m where m.course_id = p_course), 0) + 1, d.active, d.thumbnail_url)
  returning id into v_mod;
  insert into day_module_links (company_id, day_id, module_id) values (d.company_id, p_day, v_mod) returning id into v_link;

  for s in select * from induction_day_sections where day_id = p_day order by display_order, title, id loop
    if s.section_type = 'page' then
      v_order := v_order + 1;
      insert into lessons (module_id, lesson_title, lesson_type, content, display_order, thumbnail, active, downloadable)
      values (v_mod, s.title, 'text', s.page_content, v_order, coalesce(s.thumbnail_url, ''), true, false) returning id into v_les;
      insert into day_module_map (link_id, kind, a_id, b_id) values (v_link, 'item', s.id, v_les);
      v_copied := v_copied + 1;
    elsif s.section_type = 'test' then
      v_order := v_order + 1;
      insert into lessons (module_id, lesson_title, lesson_type, content, display_order, thumbnail, active, downloadable)
      values (v_mod, s.title, 'quiz', null, v_order, coalesce(s.thumbnail_url, ''), true, false) returning id into v_les;
      insert into day_module_map (link_id, kind, a_id, b_id) values (v_link, 'item', s.id, v_les);
      if s.assessment_id is not null then
        perform _pcm_clone_assessment(s.assessment_id, d.company_id, v_les);
      end if;
      v_copied := v_copied + 1;
    else
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('title', s.title, 'type', s.section_type));
    end if;
  end loop;

  perform _dmc_capture_new(v_link, true, v_temp);
  update day_module_links set fp_day = _dmc_fp_day(p_day), fp_module = _dmc_fp_module(v_mod), last_synced_at = now() where id = v_link;
  return jsonb_build_object('module_id', v_mod, 'copied', v_copied, 'skipped', v_skipped);
end $$;
revoke all on function public.copy_day_to_course_module(uuid, uuid) from public, anon;
grant execute on function public.copy_day_to_course_module(uuid, uuid) to authenticated;

create or replace function public.copy_module_to_induction_day(p_module uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m modules%rowtype; v_company uuid; v_day uuid; v_link uuid; l record; v_card uuid; v_ass uuid;
  v_copied integer := 0; v_skipped jsonb := '[]'::jsonb; v_order integer := 0; v_temp uuid[] := '{}'::uuid[];
begin
  select * into m from modules where id = p_module;
  if not found then raise exception 'Module not found.'; end if;
  select company_id into v_company from courses where id = m.course_id;
  if v_company is distinct from public.current_employee_company_id() and not public.current_company_is_platform_operator() then
    raise exception 'You can only copy your own company''s modules.' using errcode = '42501';
  end if;

  insert into induction_days (company_id, title, description, display_order, active, thumbnail_url)
  values (v_company, m.module_name, m.description, coalesce((select max(x.display_order) from induction_days x where x.company_id = v_company), 0) + 1,
          coalesce(m.active, true), nullif(m.thumbnail, ''))
  returning id into v_day;
  insert into day_module_links (company_id, day_id, module_id) values (v_company, v_day, p_module) returning id into v_link;

  for l in select * from lessons where module_id = p_module order by display_order, lesson_title, id loop
    if not coalesce(l.active, true) then continue; end if;
    if l.lesson_type = 'text' then
      v_order := v_order + 1;
      insert into induction_day_sections (company_id, day_id, section_type, title, display_order, page_content, thumbnail_url)
      values (v_company, v_day, 'page', l.lesson_title, v_order, l.content, nullif(l.thumbnail, '')) returning id into v_card;
      insert into day_module_map (link_id, kind, a_id, b_id) values (v_link, 'item', v_card, l.id);
      v_copied := v_copied + 1;
    elsif l.lesson_type = 'quiz' then
      v_order := v_order + 1;
      insert into induction_day_sections (company_id, day_id, section_type, title, display_order, thumbnail_url)
      values (v_company, v_day, 'test', l.lesson_title, v_order, nullif(l.thumbnail, '')) returning id into v_card;
      insert into day_module_map (link_id, kind, a_id, b_id) values (v_link, 'item', v_card, l.id);
      select a.id into v_ass from assessments a where a.lesson_id = l.id order by a.created_at limit 1;
      if v_ass is not null then
        update induction_day_sections set assessment_id = _pcm_clone_assessment(v_ass, v_company, null) where id = v_card;
      end if;
      v_copied := v_copied + 1;
    else
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('title', l.lesson_title, 'type', l.lesson_type));
    end if;
  end loop;

  perform _dmc_capture_new(v_link, false, v_temp);
  update day_module_links set fp_day = _dmc_fp_day(v_day), fp_module = _dmc_fp_module(p_module), last_synced_at = now() where id = v_link;
  return jsonb_build_object('day_id', v_day, 'copied', v_copied, 'skipped', v_skipped);
end $$;
revoke all on function public.copy_module_to_induction_day(uuid) from public, anon;
grant execute on function public.copy_module_to_induction_day(uuid) to authenticated;

-- ── "Update the other one too" ──
-- p_from_kind = 'day' (update the Module from the Day) or 'module' (update the Day from the Module)
create or replace function public.sync_day_module_copy(p_from_kind text, p_from uuid, p_to uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_link day_module_links%rowtype; v_company uuid; v_a boolean; v_temp uuid[];
  s record; l record; v_pair uuid; v_dst_ass uuid; v_src_ass uuid; v_new uuid; v_added integer := 0; v_updated integer := 0;
  v_next integer;
begin
  if p_from_kind not in ('day', 'module') then raise exception 'Unknown kind.'; end if;
  v_a := (p_from_kind = 'day');
  if v_a then
    select d.company_id into v_company from induction_days d where d.id = p_from;
    select * into v_link from day_module_links k where k.day_id = p_from and k.module_id = p_to;
  else
    select c.company_id into v_company from modules m join courses c on c.id = m.course_id where m.id = p_from;
    select * into v_link from day_module_links k where k.module_id = p_from and k.day_id = p_to;
  end if;
  if v_company is null then raise exception 'Not found.'; end if;
  if v_company is distinct from public.current_employee_company_id() and not public.current_company_is_platform_operator() then
    raise exception 'You can only update your own company''s content.' using errcode = '42501';
  end if;
  if v_link.id is null then raise exception 'These two are not linked as copies.'; end if;

  -- lend the known test pairs to the shared in-place test sync
  select coalesce(array_agg(case when v_a then m.b_id else m.a_id end), '{}'::uuid[]) into v_temp
    from day_module_map m where m.link_id = v_link.id and m.kind <> 'item';
  begin
    insert into platform_content_map (kind, source_id, target_id, target_company_id, parent_target_id)
    select m.kind, case when v_a then m.a_id else m.b_id end, case when v_a then m.b_id else m.a_id end, v_company, case when v_a then m.parent_b else m.parent_a end
      from day_module_map m where m.link_id = v_link.id and m.kind <> 'item';
  exception when unique_violation then
    raise exception 'This content was received through the platform update and cannot be kept in step with a copy.';
  end;

  if v_a then
    -- Day -> Module : name, description, picture (where the module lives is never touched)
    update modules set module_name = d.title, description = d.description, thumbnail = d.thumbnail_url, updated_at = now()
      from induction_days d where d.id = p_from and modules.id = p_to;
    for s in select * from induction_day_sections where day_id = p_from and section_type in ('page', 'test') order by display_order, title, id loop
      select m.b_id into v_pair from day_module_map m where m.link_id = v_link.id and m.kind = 'item' and m.a_id = s.id;
      if v_pair is null then
        select coalesce(max(display_order), 0) + 1 into v_next from lessons where module_id = p_to;
        insert into lessons (module_id, lesson_title, lesson_type, content, display_order, thumbnail, active, downloadable)
        values (p_to, s.title, case when s.section_type = 'page' then 'text' else 'quiz' end, case when s.section_type = 'page' then s.page_content end, v_next, coalesce(s.thumbnail_url, ''), true, false)
        returning id into v_new;
        insert into day_module_map (link_id, kind, a_id, b_id) values (v_link.id, 'item', s.id, v_new);
        if s.section_type = 'test' and s.assessment_id is not null then perform _pcm_clone_assessment(s.assessment_id, v_company, v_new); end if;
        v_added := v_added + 1;
      elsif exists (select 1 from lessons where id = v_pair) then
        update lessons set lesson_title = s.title, thumbnail = coalesce(s.thumbnail_url, ''),
                           content = case when s.section_type = 'page' then s.page_content else content end
         where id = v_pair;
        if s.section_type = 'test' and s.assessment_id is not null then
          select a.id into v_dst_ass from assessments a where a.lesson_id = v_pair order by a.created_at limit 1;
          if v_dst_ass is null then
            perform _pcm_clone_assessment(s.assessment_id, v_company, v_pair);
          elsif exists (select 1 from day_module_map m where m.link_id = v_link.id and m.kind = 'assessment' and m.a_id = s.assessment_id and m.b_id = v_dst_ass) then
            perform _pcm_sync_assessment(s.assessment_id, v_dst_ass, v_company);
          end if;
        end if;
        v_updated := v_updated + 1;
      end if;   -- lesson deleted over there: stays deleted
    end loop;
  else
    -- Module -> Day : name, description, picture (where the day lives is never touched)
    update induction_days set title = m.module_name, description = m.description, thumbnail_url = nullif(m.thumbnail, ''), updated_at = now()
      from modules m where m.id = p_from and induction_days.id = p_to;
    for l in select * from lessons where module_id = p_from and lesson_type in ('text', 'quiz') and coalesce(active, true) order by display_order, lesson_title, id loop
      select m.a_id into v_pair from day_module_map m where m.link_id = v_link.id and m.kind = 'item' and m.b_id = l.id;
      if v_pair is null then
        select coalesce(max(display_order), 0) + 1 into v_next from induction_day_sections where day_id = p_to;
        insert into induction_day_sections (company_id, day_id, section_type, title, display_order, page_content, thumbnail_url)
        values (v_company, p_to, case when l.lesson_type = 'text' then 'page' else 'test' end, l.lesson_title, v_next, case when l.lesson_type = 'text' then l.content end, nullif(l.thumbnail, ''))
        returning id into v_new;
        insert into day_module_map (link_id, kind, a_id, b_id) values (v_link.id, 'item', v_new, l.id);
        if l.lesson_type = 'quiz' then
          select a.id into v_src_ass from assessments a where a.lesson_id = l.id order by a.created_at limit 1;
          if v_src_ass is not null then
            update induction_day_sections set assessment_id = _pcm_clone_assessment(v_src_ass, v_company, null) where id = v_new;
          end if;
        end if;
        v_added := v_added + 1;
      elsif exists (select 1 from induction_day_sections where id = v_pair) then
        update induction_day_sections set title = l.lesson_title, thumbnail_url = nullif(l.thumbnail, ''),
                                          page_content = case when l.lesson_type = 'text' then l.content else page_content end,
                                          updated_at = now()
         where id = v_pair;
        if l.lesson_type = 'quiz' then
          select a.id into v_src_ass from assessments a where a.lesson_id = l.id order by a.created_at limit 1;
          select assessment_id into v_dst_ass from induction_day_sections where id = v_pair;
          if v_src_ass is not null then
            if v_dst_ass is null then
              update induction_day_sections set assessment_id = _pcm_clone_assessment(v_src_ass, v_company, null) where id = v_pair;
            elsif exists (select 1 from day_module_map m where m.link_id = v_link.id and m.kind = 'assessment' and m.b_id = v_src_ass and m.a_id = v_dst_ass) then
              perform _pcm_sync_assessment(v_src_ass, v_dst_ass, v_company);
            end if;
          end if;
        end if;
        v_updated := v_updated + 1;
      end if;   -- card deleted over there: stays deleted
    end loop;
  end if;

  perform _dmc_capture_new(v_link.id, v_a, v_temp);
  update day_module_links set fp_day = _dmc_fp_day(day_id), fp_module = _dmc_fp_module(module_id), last_synced_at = now() where id = v_link.id;
  return jsonb_build_object('updated', v_updated, 'added', v_added);
end $$;
revoke all on function public.sync_day_module_copy(text, uuid, uuid) from public, anon;
grant execute on function public.sync_day_module_copy(text, uuid, uuid) to authenticated;

-- what the editor shows for one Day or one Module
create or replace function public.get_day_module_links(p_kind text, p_id uuid)
returns table (link_id uuid, other_id uuid, other_name text, other_place text, auto_sync boolean, behind boolean, other_changed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_kind = 'day' then
    if not exists (select 1 from induction_days where id = p_id and company_id = public.current_employee_company_id()) then return; end if;
    return query
      select k.id, m.id, m.module_name::text, ('Course · ' || coalesce(c.course_name, ''))::text, k.auto_from_day,
             public._dmc_fp_day(p_id) is distinct from k.fp_day,
             public._dmc_fp_module(m.id) is distinct from k.fp_module
        from day_module_links k join modules m on m.id = k.module_id left join courses c on c.id = m.course_id
       where k.day_id = p_id order by m.module_name;
  elsif p_kind = 'module' then
    if not exists (select 1 from modules m join courses c on c.id = m.course_id where m.id = p_id and c.company_id = public.current_employee_company_id()) then return; end if;
    return query
      select k.id, d.id, d.title::text, 'Induction'::text, k.auto_from_module,
             public._dmc_fp_module(p_id) is distinct from k.fp_module,
             public._dmc_fp_day(d.id) is distinct from k.fp_day
        from day_module_links k join induction_days d on d.id = k.day_id
       where k.module_id = p_id order by d.title;
  end if;
end $$;
revoke all on function public.get_day_module_links(text, uuid) from public, anon;
grant execute on function public.get_day_module_links(text, uuid) to authenticated;

create or replace function public.set_day_module_auto(p_link uuid, p_kind text, p_auto boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update day_module_links k
     set auto_from_day = case when p_kind = 'day' then coalesce(p_auto, false) else k.auto_from_day end,
         auto_from_module = case when p_kind = 'module' then coalesce(p_auto, false) else k.auto_from_module end
   where k.id = p_link and k.company_id = public.current_employee_company_id();
end $$;
revoke all on function public.set_day_module_auto(uuid, text, boolean) from public, anon;
grant execute on function public.set_day_module_auto(uuid, text, boolean) to authenticated;

-- when the editor is left: update every linked copy that is set to follow this Day / Module and is behind it
create or replace function public.sync_day_module_copies_auto(p_kind text, p_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare k record; n integer := 0;
begin
  if p_kind = 'day' then
    if not exists (select 1 from induction_days where id = p_id and company_id = public.current_employee_company_id()) then return 0; end if;
    for k in select * from day_module_links where day_id = p_id and auto_from_day loop
      if public._dmc_fp_day(p_id) is distinct from k.fp_day then
        perform public.sync_day_module_copy('day', p_id, k.module_id); n := n + 1;
      end if;
    end loop;
  elsif p_kind = 'module' then
    if not exists (select 1 from modules m join courses c on c.id = m.course_id where m.id = p_id and c.company_id = public.current_employee_company_id()) then return 0; end if;
    for k in select * from day_module_links where module_id = p_id and auto_from_module loop
      if public._dmc_fp_module(p_id) is distinct from k.fp_module then
        perform public.sync_day_module_copy('module', p_id, k.day_id); n := n + 1;
      end if;
    end loop;
  end if;
  return n;
end $$;
revoke all on function public.sync_day_module_copies_auto(text, uuid) from public, anon;
grant execute on function public.sync_day_module_copies_auto(text, uuid) to authenticated;

-- Days / Modules whose linked copy is behind (they changed since the last sync) - for the "copy is behind" mark in the lists
create or replace function public.day_module_stale() returns table (kind text, id uuid)
language sql stable security definer set search_path = public as $$
  select 'day'::text, k.day_id from day_module_links k where k.company_id = public.current_employee_company_id() and public._dmc_fp_day(k.day_id) is distinct from k.fp_day
  union
  select 'module'::text, k.module_id from day_module_links k where k.company_id = public.current_employee_company_id() and public._dmc_fp_module(k.module_id) is distinct from k.fp_module;
$$;
revoke all on function public.day_module_stale() from public, anon;
grant execute on function public.day_module_stale() to authenticated;

revoke all on function public._dmc_fp_day(uuid), public._dmc_fp_module(uuid), public._dmc_capture_new(uuid, boolean, uuid[]) from public, anon, authenticated;

-- when the Course Builder is left: update the Days that follow any module of this course (those set to "update automatically") and are behind
create or replace function public.sync_course_day_copies_auto(p_course uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare k record; n integer := 0;
begin
  if not exists (select 1 from courses where id = p_course and company_id = public.current_employee_company_id()) then return 0; end if;
  for k in
    select l.* from day_module_links l join modules m on m.id = l.module_id
     where m.course_id = p_course and l.auto_from_module
  loop
    if public._dmc_fp_module(k.module_id) is distinct from k.fp_module then
      perform public.sync_day_module_copy('module', k.module_id, k.day_id); n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.sync_course_day_copies_auto(uuid) from public, anon;
grant execute on function public.sync_course_day_copies_auto(uuid) to authenticated;
