-- Linked copies of a project: "Update the copy too".
--
-- A project copied between the main Projects and an Induction "Focused projects" card (copy_project_independent) is
-- an independent copy. From now on such a copy REMEMBERS which project it was copied from (project_copy_links +
-- project_copy_map, which row of one side is which row of the other), so one click can bring the other side up to date.
--
--   * sync_project_copy(from, to)      : updates the other copy from this one - name, descriptions, picture, pages, FAQs,
--                                         brochures, test settings and questions, IN PLACE (so the other copy's test results
--                                         and attempts stay), and adds what is new. Nothing is ever deleted over there:
--                                         a page / question / brochure removed here stays in the other copy.
--   * Where the copy lives (card, order, active, branch) is never touched.
--   * get_project_copy_links / set_project_copy_auto / sync_project_copies_auto / projects_with_stale_copies:
--                                         what the editor shows (a note, a button, an "update on close" switch, a
--                                         "copy is behind" mark).
--   * Existing copies (made before this) are linked once at the end of this migration, only when they are identical.
--
-- It reuses the tested in-place sync helpers of the platform content sync (_pcm_*). Their bookkeeping table is only
-- borrowed for the length of one call and emptied again, so Content Distribution never sees these copies.

create table if not exists public.project_copy_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_a uuid not null references public.real_estate_projects(id) on delete cascade,
  project_b uuid not null references public.real_estate_projects(id) on delete cascade,
  auto_from_a boolean not null default false,   -- update B automatically when A is closed after changes
  auto_from_b boolean not null default false,
  fp_a text,                                     -- how each side looked at the last sync (to tell "changed since")
  fp_b text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_a, project_b),
  check (project_a <> project_b)
);
create index if not exists idx_project_copy_links_a on public.project_copy_links (project_a);
create index if not exists idx_project_copy_links_b on public.project_copy_links (project_b);
create index if not exists idx_project_copy_links_company on public.project_copy_links (company_id);

create table if not exists public.project_copy_map (
  link_id uuid not null references public.project_copy_links(id) on delete cascade,
  kind text not null,                            -- project_section | brochure | assessment | question | option
  a_id uuid not null,
  b_id uuid not null,
  parent_a uuid,
  parent_b uuid,
  primary key (link_id, kind, a_id)
);

alter table public.project_copy_links enable row level security;
alter table public.project_copy_map enable row level security;
revoke all on public.project_copy_links from anon, authenticated;     -- reachable only through the functions below
revoke all on public.project_copy_map from anon, authenticated;

-- ── what a project "looks like", ignoring ids and where it lives (to tell whether it changed since the last sync) ──
create or replace function public._pcl_fp_assessment(p_a uuid) returns text
language sql stable security definer set search_path = public as $$
  select md5(
    coalesce((select (to_jsonb(a) - array['id','created_at','updated_at','company_id','lesson_id','assessment_code'])::text from assessments a where a.id = p_a), '') ||
    coalesce((select string_agg(
        (to_jsonb(q) - array['id','created_at','updated_at','assessment_id','question_code'])::text ||
        coalesce((select string_agg((to_jsonb(o) - array['id','created_at','updated_at','question_id'])::text, '' order by o.display_order, o.option_text) from question_options o where o.question_id = q.id), ''),
        '' order by q.display_order, q.question_text) from question_bank q where q.assessment_id = p_a), ''));
$$;

create or replace function public._pcl_fp(p_project uuid) returns text
language sql stable security definer set search_path = public as $$
  select md5(
    coalesce((select (to_jsonb(x) - array['id','created_at','updated_at','company_id','category_id','branch_id','source_id','display_order','active','induction_section_id'])::text from real_estate_projects x where x.id = p_project), '') ||
    coalesce((select string_agg((to_jsonb(s) - array['id','created_at','updated_at','company_id','project_id','assessment_id'])::text || coalesce(public._pcl_fp_assessment(s.assessment_id), ''), '' order by s.display_order, s.title)
                from real_estate_project_sections s where s.project_id = p_project), '') ||
    coalesce((select string_agg((to_jsonb(b) - array['id','created_at','updated_at','company_id','project_id'])::text, '' order by b.title, b.file_url)
                from real_estate_project_brochures b where b.project_id = p_project), ''));
$$;

-- ── which row of one copy is which row of the other (only when the two are identical) ──
create or replace function public._pcl_pair_assessment(p_link uuid, p_a uuid, p_b uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare q record; o record; n_a integer; n_b integer;
begin
  insert into project_copy_map (link_id, kind, a_id, b_id) values (p_link, 'assessment', p_a, p_b) on conflict do nothing;
  select count(*) into n_a from question_bank where assessment_id = p_a;
  select count(*) into n_b from question_bank where assessment_id = p_b;
  if n_a <> n_b then return false; end if;
  for q in
    select x.id as qa, y.id as qb, x.question_text as ta, y.question_text as tb
      from (select id, question_text, row_number() over (order by display_order, question_text, id) rn from question_bank where assessment_id = p_a) x
      join (select id, question_text, row_number() over (order by display_order, question_text, id) rn from question_bank where assessment_id = p_b) y on y.rn = x.rn
  loop
    if q.ta is distinct from q.tb then return false; end if;
    insert into project_copy_map (link_id, kind, a_id, b_id, parent_a, parent_b) values (p_link, 'question', q.qa, q.qb, p_a, p_b) on conflict do nothing;
    select count(*) into n_a from question_options where question_id = q.qa;
    select count(*) into n_b from question_options where question_id = q.qb;
    if n_a <> n_b then return false; end if;
    for o in
      select x.id as oa, y.id as ob, x.option_text as ta, y.option_text as tb
        from (select id, option_text, row_number() over (order by display_order, option_text, id) rn from question_options where question_id = q.qa) x
        join (select id, option_text, row_number() over (order by display_order, option_text, id) rn from question_options where question_id = q.qb) y on y.rn = x.rn
    loop
      if o.ta is distinct from o.tb then return false; end if;
      insert into project_copy_map (link_id, kind, a_id, b_id, parent_a, parent_b) values (p_link, 'option', o.oa, o.ob, q.qa, q.qb) on conflict do nothing;
    end loop;
  end loop;
  return true;
end $$;

create or replace function public._pcl_build_map(p_link uuid, p_a uuid, p_b uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare r record; n_a integer; n_b integer;
begin
  select count(*) into n_a from real_estate_project_sections where project_id = p_a;
  select count(*) into n_b from real_estate_project_sections where project_id = p_b;
  if n_a <> n_b then return false; end if;
  for r in
    select x.id as sa, y.id as sb, x.section_type as ta, y.section_type as tb, x.title as xa, y.title as yb, x.assessment_id as aa, y.assessment_id as ab
      from (select s.*, row_number() over (order by s.display_order, s.title, s.id) rn from real_estate_project_sections s where s.project_id = p_a) x
      join (select s.*, row_number() over (order by s.display_order, s.title, s.id) rn from real_estate_project_sections s where s.project_id = p_b) y on y.rn = x.rn
  loop
    if r.ta is distinct from r.tb or r.xa is distinct from r.yb or (r.aa is null) <> (r.ab is null) then return false; end if;
    insert into project_copy_map (link_id, kind, a_id, b_id, parent_a, parent_b) values (p_link, 'project_section', r.sa, r.sb, p_a, p_b) on conflict do nothing;
    if r.aa is not null and not _pcl_pair_assessment(p_link, r.aa, r.ab) then return false; end if;
  end loop;

  select count(*) into n_a from real_estate_project_brochures where project_id = p_a;
  select count(*) into n_b from real_estate_project_brochures where project_id = p_b;
  if n_a <> n_b then return false; end if;
  for r in
    select x.id as ba, y.id as bb, x.title as xa, y.title as yb, x.file_url as fa, y.file_url as fb
      from (select b.*, row_number() over (order by b.title, b.file_url, b.id) rn from real_estate_project_brochures b where b.project_id = p_a) x
      join (select b.*, row_number() over (order by b.title, b.file_url, b.id) rn from real_estate_project_brochures b where b.project_id = p_b) y on y.rn = x.rn
  loop
    if r.xa is distinct from r.yb or r.fa is distinct from r.fb then return false; end if;
    insert into project_copy_map (link_id, kind, a_id, b_id, parent_a, parent_b) values (p_link, 'brochure', r.ba, r.bb, p_a, p_b) on conflict do nothing;
  end loop;
  return true;
end $$;

-- link two projects that are identical copies; returns false (and links nothing) when they are not identical
create or replace function public._pcl_link_pair(p_company uuid, p_a uuid, p_b uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_link uuid;
begin
  if exists (select 1 from project_copy_links where (project_a = p_a and project_b = p_b) or (project_a = p_b and project_b = p_a)) then return true; end if;
  insert into project_copy_links (company_id, project_a, project_b) values (p_company, p_a, p_b) returning id into v_link;
  if not _pcl_build_map(v_link, p_a, p_b) then
    delete from project_copy_links where id = v_link;   -- cascades the half-built map
    return false;
  end if;
  update project_copy_links set fp_a = _pcl_fp(p_a), fp_b = _pcl_fp(p_b) where id = v_link;
  return true;
end $$;

-- new copies are linked the moment they are made (everything else as before)
create or replace function public.copy_project_independent(p_project uuid, p_into_section uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_sec_company uuid; v_type text; v_new uuid;
begin
  select company_id into v_company from real_estate_projects where id = p_project;
  if v_company is null then raise exception 'Project not found.'; end if;
  if v_company is distinct from public.current_employee_company_id() and not public.current_company_is_platform_operator() then
    raise exception 'You can only copy your own company''s projects.' using errcode = '42501';
  end if;
  if p_into_section is not null then
    select company_id, section_type into v_sec_company, v_type from induction_day_sections where id = p_into_section;
    if v_sec_company is distinct from v_company or v_type is distinct from 'projects' then
      raise exception 'That card cannot hold projects.';
    end if;
  end if;

  v_new := _pcm_clone_project(p_project, v_company);
  -- the shared copier records "sent to a company" bookkeeping; an independent copy must leave none behind
  delete from platform_content_map where xmin::text::bigint = (txid_current() & 4294967295);

  update real_estate_projects
     set induction_section_id = p_into_section,
         display_order = case when p_into_section is null then display_order
                              else coalesce((select max(p2.display_order) from real_estate_projects p2 where p2.induction_section_id = p_into_section and p2.id <> v_new), 0) + 1 end
   where id = v_new;

  -- remember which project this is a copy of, so the copy can be updated later
  perform _pcl_link_pair(v_company, p_project, v_new);
  return v_new;
end $$;
revoke all on function public.copy_project_independent(uuid, uuid) from public, anon;
grant execute on function public.copy_project_independent(uuid, uuid) to authenticated;

-- ── "Update the copy too" ──
create or replace function public._pcl_capture_new(p_link uuid, p_from_is_a boolean, p_from uuid, p_to uuid, p_temp uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare n record; v_a uuid; v_b uuid; v_pa uuid; v_pb uuid;
begin
  -- what the sync just created over there (new pages, brochures, tests, questions...) is remembered for next time
  for n in
    select kind, source_id, target_id, parent_target_id from platform_content_map
     where xmin::text::bigint = (txid_current() & 4294967295) and kind <> 'project' and target_id <> all (p_temp)
     order by case kind when 'project_section' then 1 when 'brochure' then 2 when 'assessment' then 3 when 'question' then 4 else 5 end
  loop
    if p_from_is_a then
      v_a := n.source_id; v_b := n.target_id; v_pb := n.parent_target_id;
      v_pa := case when v_pb = p_to then p_from else (select m.a_id from project_copy_map m where m.link_id = p_link and m.b_id = v_pb limit 1) end;
    else
      v_b := n.source_id; v_a := n.target_id; v_pa := n.parent_target_id;
      v_pb := case when v_pa = p_to then p_from else (select m.b_id from project_copy_map m where m.link_id = p_link and m.a_id = v_pa limit 1) end;
    end if;
    insert into project_copy_map (link_id, kind, a_id, b_id, parent_a, parent_b) values (p_link, n.kind, v_a, v_b, v_pa, v_pb) on conflict do nothing;
  end loop;
  -- the borrowed bookkeeping rows (the ones lent for this call and the ones just created) are emptied again
  -- (the lent rows were written inside a sub-block, so they are also removed by id)
  delete from platform_content_map where xmin::text::bigint = (txid_current() & 4294967295) or target_id = any (p_temp);
end $$;

create or replace function public.sync_project_copy(p_from uuid, p_to uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_link record; v_a boolean; v_temp uuid[];
begin
  select company_id into v_company from real_estate_projects where id = p_from;
  if v_company is null then raise exception 'Project not found.'; end if;
  if v_company is distinct from public.current_employee_company_id() and not public.current_company_is_platform_operator() then
    raise exception 'You can only update your own company''s projects.' using errcode = '42501';
  end if;
  select * into v_link from project_copy_links l where (l.project_a = p_from and l.project_b = p_to) or (l.project_a = p_to and l.project_b = p_from);
  if not found then raise exception 'These two projects are not linked as copies.'; end if;
  v_a := (v_link.project_a = p_from);

  select coalesce(array_agg(case when v_a then m.b_id else m.a_id end), '{}'::uuid[]) into v_temp from project_copy_map m where m.link_id = v_link.id;
  begin
    insert into platform_content_map (kind, source_id, target_id, target_company_id, parent_target_id)
    select m.kind, case when v_a then m.a_id else m.b_id end, case when v_a then m.b_id else m.a_id end, v_company, case when v_a then m.parent_b else m.parent_a end
      from project_copy_map m where m.link_id = v_link.id;
  exception when unique_violation then
    raise exception 'This project was received through the platform update and cannot be kept in step with a copy.';
  end;

  perform _pcm_sync_project(p_from, p_to, v_company);
  perform _pcl_capture_new(v_link.id, v_a, p_from, p_to, v_temp);

  update project_copy_links set fp_a = _pcl_fp(project_a), fp_b = _pcl_fp(project_b), last_synced_at = now() where id = v_link.id;
  return true;
end $$;
revoke all on function public.sync_project_copy(uuid, uuid) from public, anon;
grant execute on function public.sync_project_copy(uuid, uuid) to authenticated;

-- what the editor shows for one project
create or replace function public.get_project_copy_links(p_project uuid)
returns table (link_id uuid, other_id uuid, other_name text, other_place text, auto_sync boolean, behind boolean, other_changed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from real_estate_projects where id = p_project and company_id = public.current_employee_company_id()) then
    return;
  end if;
  return query
    select l.id, o.id, o.project_name,
           case when o.induction_section_id is null then 'Projects'
                else 'Induction · ' || coalesce(d.title, '') || ' › ' || coalesce(s.title, '') end,
           case when l.project_a = p_project then l.auto_from_a else l.auto_from_b end,
           public._pcl_fp(p_project) is distinct from (case when l.project_a = p_project then l.fp_a else l.fp_b end),
           public._pcl_fp(o.id) is distinct from (case when l.project_a = p_project then l.fp_b else l.fp_a end)
      from project_copy_links l
      join real_estate_projects o on o.id = case when l.project_a = p_project then l.project_b else l.project_a end
      left join induction_day_sections s on s.id = o.induction_section_id
      left join induction_days d on d.id = s.day_id
     where (l.project_a = p_project or l.project_b = p_project)
     order by o.induction_section_id nulls first, o.project_name;
end $$;
revoke all on function public.get_project_copy_links(uuid) from public, anon;
grant execute on function public.get_project_copy_links(uuid) to authenticated;

create or replace function public.set_project_copy_auto(p_link uuid, p_project uuid, p_auto boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update project_copy_links l
     set auto_from_a = case when l.project_a = p_project then coalesce(p_auto, false) else l.auto_from_a end,
         auto_from_b = case when l.project_b = p_project then coalesce(p_auto, false) else l.auto_from_b end
   where l.id = p_link and l.company_id = public.current_employee_company_id() and (l.project_a = p_project or l.project_b = p_project);
end $$;
revoke all on function public.set_project_copy_auto(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_project_copy_auto(uuid, uuid, boolean) to authenticated;

-- when the editor is closed: update every linked copy that is set to follow this project and is behind it
create or replace function public.sync_project_copies_auto(p_project uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare l record; n integer := 0; v_other uuid;
begin
  if not exists (select 1 from real_estate_projects where id = p_project and company_id = public.current_employee_company_id()) then return 0; end if;
  for l in select * from project_copy_links where (project_a = p_project and auto_from_a) or (project_b = p_project and auto_from_b) loop
    v_other := case when l.project_a = p_project then l.project_b else l.project_a end;
    if public._pcl_fp(p_project) is distinct from (case when l.project_a = p_project then l.fp_a else l.fp_b end) then
      perform public.sync_project_copy(p_project, v_other);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.sync_project_copies_auto(uuid) from public, anon;
grant execute on function public.sync_project_copies_auto(uuid) to authenticated;

-- projects whose linked copy is behind (they changed since the last sync) - for the "copy is behind" mark in the list
create or replace function public.projects_with_stale_copies() returns setof uuid
language sql stable security definer set search_path = public as $$
  select l.project_a from project_copy_links l where l.company_id = public.current_employee_company_id() and public._pcl_fp(l.project_a) is distinct from l.fp_a
  union
  select l.project_b from project_copy_links l where l.company_id = public.current_employee_company_id() and public._pcl_fp(l.project_b) is distinct from l.fp_b;
$$;
revoke all on function public.projects_with_stale_copies() from public, anon;
grant execute on function public.projects_with_stale_copies() to authenticated;

revoke all on function
  public._pcl_fp_assessment(uuid), public._pcl_fp(uuid), public._pcl_pair_assessment(uuid, uuid, uuid), public._pcl_build_map(uuid, uuid, uuid),
  public._pcl_link_pair(uuid, uuid, uuid), public._pcl_capture_new(uuid, boolean, uuid, uuid, uuid[])
  from public, anon, authenticated;

-- ── link the copies that already exist (main Projects <-> an Induction card, same name, identical content) ──
create or replace function public.link_matching_project_copies() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in
    select m.company_id, m.id as main_id, c.id as card_id
      from real_estate_projects m
      join real_estate_projects c on c.company_id = m.company_id and lower(btrim(c.project_name)) = lower(btrim(m.project_name))
     where m.induction_section_id is null and c.induction_section_id is not null
  loop
    if _pcl_link_pair(r.company_id, r.main_id, r.card_id) then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function public.link_matching_project_copies() from public, anon, authenticated;

select public.link_matching_project_copies();
