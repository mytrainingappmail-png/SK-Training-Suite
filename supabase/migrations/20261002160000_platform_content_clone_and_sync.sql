-- Content Distribution, done properly in the database:
--
--  1. platform_clone_content()  copies a course / induction day / project / video (with every chapter,
--     lesson, file, page, brochure and TEST with its questions) into a company, and REMEMBERS which new
--     row came from which master row (platform_content_map).
--  2. platform_sync_content()   pushes the owner's later corrections into those copies IN PLACE: text,
--     pictures, videos, questions are updated on the same rows, so employees' progress, results and
--     certificates stay exactly where they were. Anything the company deleted from its copy is left
--     deleted; anything the owner newly added to the master is added; things the owner removed from the
--     master are NOT removed from the copies (that could take an employee's progress with it).
--  3. platform_content_changes() tells the owner which already-sent items were changed since.
--
-- Only the platform owner can call the public functions. Copies get a display order after whatever the
-- company already has, so a copy never lands in the middle of its existing days/courses.
--
-- Also: admins/trainers of a company may READ which induction cards employees have opened (needed by the
-- new Reports → Induction progress screen). Employees can still only WRITE their own views.

-- ── the memory of what was copied where ─────────────────────────────────────
create table if not exists public.platform_content_map (
  kind              text not null,
  source_id         uuid not null,
  target_id         uuid not null,
  target_company_id uuid not null references public.companies(id) on delete cascade,
  parent_target_id  uuid,
  root_fingerprint  text,
  synced_at         timestamptz not null default now(),
  primary key (kind, target_id)
);
create index if not exists platform_content_map_source_idx on public.platform_content_map (kind, source_id, target_company_id);
create index if not exists platform_content_map_parent_idx on public.platform_content_map (kind, source_id, parent_target_id);

alter table public.platform_content_map enable row level security;
revoke all on public.platform_content_map from anon, authenticated;   -- reachable only through the functions below

-- ── small helpers (never callable from the browser) ─────────────────────────
create or replace function public._pcm_exists(p_table regclass, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v boolean;
begin
  execute format('select exists (select 1 from %s where id = $1)', p_table) into v using p_id;
  return v;
end $$;

create or replace function public._pcm_next_order(p_table regclass, p_company uuid) returns integer
language plpgsql stable security definer set search_path = public as $$
declare n integer;
begin
  execute format('select coalesce(max(display_order), -1) + 1 from %s where company_id = $1', p_table) into n using p_company;
  return n;
end $$;

create or replace function public._pcm_child(p_kind text, p_source uuid, p_parent uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select target_id from platform_content_map where kind = p_kind and source_id = p_source and parent_target_id = p_parent limit 1;
$$;

-- copy ONE row with overrides; records the mapping
create or replace function public._pcm_clone_row(p_table regclass, p_src uuid, p_over jsonb, p_kind text, p_company uuid, p_parent uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_new uuid := gen_random_uuid(); n integer;
begin
  execute format($f$insert into %1$s select r.* from %1$s s cross join lateral jsonb_populate_record(null::%1$s, to_jsonb(s) || $1) r where s.id = $2$f$, p_table)
    using coalesce(p_over, '{}'::jsonb) || jsonb_build_object('id', v_new, 'created_at', now(), 'updated_at', now()), p_src;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Source row % not found in %', p_src, p_table; end if;
  insert into platform_content_map (kind, source_id, target_id, target_company_id, parent_target_id) values (p_kind, p_src, v_new, p_company, p_parent);
  return v_new;
end $$;

-- update ONE copied row from its master (everything except ids, timestamps and the listed columns)
create or replace function public._pcm_sync_row(p_table regclass, p_src uuid, p_dst uuid, p_exclude text[]) returns void
language plpgsql security definer set search_path = public as $$
declare v_set text;
begin
  select string_agg(format('%I = s.%I', a.attname, a.attname), ', ') into v_set
  from pg_attribute a
  where a.attrelid = p_table and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
    and a.attname <> all (array['id', 'created_at', 'updated_at'] || coalesce(p_exclude, '{}'::text[]));
  if v_set is null then return; end if;
  if exists (select 1 from pg_attribute where attrelid = p_table and attname = 'updated_at' and not attisdropped) then
    v_set := v_set || ', updated_at = now()';
  end if;
  execute format('update %1$s t set %2$s from %1$s s where s.id = $1 and t.id = $2', p_table, v_set) using p_src, p_dst;
end $$;

-- ── tests (assessment → questions → answers) ────────────────────────────────
create or replace function public._pcm_clone_assessment(p_src uuid, p_company uuid, p_lesson uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_new uuid; q record; o record; v_q uuid;
begin
  v_new := _pcm_clone_row('assessments', p_src, jsonb_build_object(
    'company_id', p_company, 'lesson_id', p_lesson,
    'assessment_code', 'T-' || upper(substr(md5(gen_random_uuid()::text), 1, 12))), 'assessment', p_company, null);
  for q in select id from question_bank where assessment_id = p_src order by display_order loop
    v_q := _pcm_clone_row('question_bank', q.id, jsonb_build_object(
      'assessment_id', v_new, 'question_code', 'q-' || substr(md5(gen_random_uuid()::text), 1, 12)), 'question', p_company, v_new);
    for o in select id from question_options where question_id = q.id order by display_order loop
      perform _pcm_clone_row('question_options', o.id, jsonb_build_object('question_id', v_q), 'option', p_company, v_q);
    end loop;
  end loop;
  return v_new;
end $$;

create or replace function public._pcm_sync_assessment(p_src uuid, p_dst uuid, p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
declare q record; o record; v_dq uuid; v_do uuid;
begin
  perform _pcm_sync_row('assessments', p_src, p_dst, array['company_id', 'lesson_id', 'assessment_code']);
  for q in select id from question_bank where assessment_id = p_src order by display_order loop
    v_dq := _pcm_child('question', q.id, p_dst);
    if v_dq is null then
      v_dq := _pcm_clone_row('question_bank', q.id, jsonb_build_object('assessment_id', p_dst, 'question_code', 'q-' || substr(md5(gen_random_uuid()::text), 1, 12)), 'question', p_company, p_dst);
      for o in select id from question_options where question_id = q.id order by display_order loop
        perform _pcm_clone_row('question_options', o.id, jsonb_build_object('question_id', v_dq), 'option', p_company, v_dq);
      end loop;
    elsif _pcm_exists('question_bank', v_dq) then
      perform _pcm_sync_row('question_bank', q.id, v_dq, array['assessment_id', 'question_code']);
      for o in select id from question_options where question_id = q.id order by display_order loop
        v_do := _pcm_child('option', o.id, v_dq);
        if v_do is null then
          perform _pcm_clone_row('question_options', o.id, jsonb_build_object('question_id', v_dq), 'option', p_company, v_dq);
        elsif _pcm_exists('question_options', v_do) then
          perform _pcm_sync_row('question_options', o.id, v_do, array['question_id']);
        end if;   -- deleted by the company: stays deleted
      end loop;
    end if;       -- question deleted by the company: stays deleted
  end loop;
end $$;

-- ── course (chapters → lessons → files, quiz lessons carry their test) ──────
create or replace function public._pcm_clone_lesson(p_src uuid, p_module uuid, p_company uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_new uuid; r record; a record;
begin
  v_new := _pcm_clone_row('lessons', p_src, jsonb_build_object('module_id', p_module), 'lesson', p_company, p_module);
  for r in select id from learning_resources where lesson_id = p_src order by display_order loop
    perform _pcm_clone_row('learning_resources', r.id, jsonb_build_object('lesson_id', v_new), 'resource', p_company, v_new);
  end loop;
  for a in select id from assessments where lesson_id = p_src loop
    perform _pcm_clone_assessment(a.id, p_company, v_new);
  end loop;
  return v_new;
end $$;

create or replace function public._pcm_clone_module(p_src uuid, p_course uuid, p_company uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_new uuid; l record;
begin
  v_new := _pcm_clone_row('modules', p_src, jsonb_build_object('course_id', p_course), 'module', p_company, p_course);
  for l in select id from lessons where module_id = p_src order by display_order loop
    perform _pcm_clone_lesson(l.id, v_new, p_company);
  end loop;
  return v_new;
end $$;

create or replace function public._pcm_clone_course(p_src uuid, p_company uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_new uuid; v_code text; v_base text; m record; v_cc text;
begin
  select company_code into v_cc from companies where id = p_company;
  select v_cc || '-' || course_code into v_base from courses where id = p_src;
  if v_base is null then raise exception 'Course not found.'; end if;
  v_code := v_base;
  while exists (select 1 from courses where course_code = v_code) loop
    v_code := v_base || '-' || upper(substr(md5(random()::text), 1, 4));
  end loop;
  v_new := _pcm_clone_row('courses', p_src, jsonb_build_object(
    'company_id', p_company, 'category_id', null, 'created_by', null, 'course_code', v_code,
    'display_order', _pcm_next_order('courses', p_company)), 'course', p_company, null);
  for m in select id from modules where course_id = p_src order by module_order loop
    perform _pcm_clone_module(m.id, v_new, p_company);
  end loop;
  return v_new;
end $$;

create or replace function public._pcm_sync_lesson(p_src uuid, p_dst uuid, p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record; a record; v_t uuid;
begin
  perform _pcm_sync_row('lessons', p_src, p_dst, array['module_id']);
  for r in select id from learning_resources where lesson_id = p_src order by display_order loop
    v_t := _pcm_child('resource', r.id, p_dst);
    if v_t is null then
      perform _pcm_clone_row('learning_resources', r.id, jsonb_build_object('lesson_id', p_dst), 'resource', p_company, p_dst);
    elsif _pcm_exists('learning_resources', v_t) then
      perform _pcm_sync_row('learning_resources', r.id, v_t, array['lesson_id']);
    end if;
  end loop;
  for a in select id from assessments where lesson_id = p_src loop
    select m.target_id into v_t from platform_content_map m join assessments x on x.id = m.target_id
      where m.kind = 'assessment' and m.source_id = a.id and x.lesson_id = p_dst limit 1;
    if v_t is null then
      -- the owner added a test to this lesson later (only if the company's copy has none yet)
      if not exists (select 1 from assessments where lesson_id = p_dst) then perform _pcm_clone_assessment(a.id, p_company, p_dst); end if;
    else
      perform _pcm_sync_assessment(a.id, v_t, p_company);
    end if;
  end loop;
end $$;

create or replace function public._pcm_sync_course(p_src uuid, p_dst uuid, p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m record; l record; v_m uuid; v_l uuid;
begin
  perform _pcm_sync_row('courses', p_src, p_dst, array['company_id', 'category_id', 'created_by', 'course_code', 'display_order', 'active']);
  for m in select id from modules where course_id = p_src order by module_order loop
    v_m := _pcm_child('module', m.id, p_dst);
    if v_m is null then
      perform _pcm_clone_module(m.id, p_dst, p_company);
    elsif _pcm_exists('modules', v_m) then
      perform _pcm_sync_row('modules', m.id, v_m, array['course_id']);
      for l in select id from lessons where module_id = m.id order by display_order loop
        v_l := _pcm_child('lesson', l.id, v_m);
        if v_l is null then
          perform _pcm_clone_lesson(l.id, v_m, p_company);
        elsif _pcm_exists('lessons', v_l) then
          perform _pcm_sync_lesson(l.id, v_l, p_company);
        end if;   -- lesson deleted by the company: stays deleted
      end loop;
    end if;       -- chapter deleted by the company: stays deleted
  end loop;
end $$;

-- ── induction day ───────────────────────────────────────────────────────────
create or replace function public._pcm_clone_day_section(p_src uuid, p_day uuid, p_company uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_test uuid; v_new uuid; v_a uuid;
begin
  select assessment_id into v_a from induction_day_sections where id = p_src;
  if v_a is not null then v_test := _pcm_clone_assessment(v_a, p_company, null); end if;
  v_new := _pcm_clone_row('induction_day_sections', p_src, jsonb_build_object('company_id', p_company, 'day_id', p_day, 'assessment_id', v_test), 'induction_section', p_company, p_day);
  return v_new;
end $$;

create or replace function public._pcm_clone_day(p_src uuid, p_company uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_new uuid; s record;
begin
  v_new := _pcm_clone_row('induction_days', p_src, jsonb_build_object(
    'company_id', p_company, 'branch_id', null, 'source_id', null, 'display_order', _pcm_next_order('induction_days', p_company)), 'induction_day', p_company, null);
  for s in select id from induction_day_sections where day_id = p_src order by display_order loop
    perform _pcm_clone_day_section(s.id, v_new, p_company);
  end loop;
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

-- ── project ─────────────────────────────────────────────────────────────────
create or replace function public._pcm_clone_project_section(p_src uuid, p_project uuid, p_company uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_test uuid; v_a uuid;
begin
  select assessment_id into v_a from real_estate_project_sections where id = p_src;
  if v_a is not null then v_test := _pcm_clone_assessment(v_a, p_company, null); end if;
  return _pcm_clone_row('real_estate_project_sections', p_src, jsonb_build_object('company_id', p_company, 'project_id', p_project, 'assessment_id', v_test), 'project_section', p_company, p_project);
end $$;

create or replace function public._pcm_clone_project(p_src uuid, p_company uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_new uuid; s record; b record;
begin
  v_new := _pcm_clone_row('real_estate_projects', p_src, jsonb_build_object(
    'company_id', p_company, 'category_id', null, 'branch_id', null, 'source_id', null,
    'display_order', _pcm_next_order('real_estate_projects', p_company)), 'project', p_company, null);
  for s in select id from real_estate_project_sections where project_id = p_src order by display_order loop
    perform _pcm_clone_project_section(s.id, v_new, p_company);
  end loop;
  for b in select id from real_estate_project_brochures where project_id = p_src order by created_at loop
    perform _pcm_clone_row('real_estate_project_brochures', b.id, jsonb_build_object('project_id', v_new), 'brochure', p_company, v_new);
  end loop;
  return v_new;
end $$;

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

-- ── video ───────────────────────────────────────────────────────────────────
create or replace function public._pcm_clone_video(p_src uuid, p_company uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_subject uuid; v_name text;
begin
  select s.subject_name into v_name from library_videos v join video_subjects s on s.id = v.subject_id where v.id = p_src;
  if v_name is null then raise exception 'Video not found.'; end if;
  select id into v_subject from video_subjects where company_id = p_company and subject_name = v_name limit 1;
  if v_subject is null then
    insert into video_subjects (company_id, subject_name, display_order, active) values (p_company, v_name, 0, true) returning id into v_subject;
  end if;
  return _pcm_clone_row('library_videos', p_src, jsonb_build_object(
    'company_id', p_company, 'subject_id', v_subject, 'display_order', _pcm_next_order('library_videos', p_company)), 'video', p_company, null);
end $$;

-- ── what changed in a master since it was sent (a fingerprint of the content, not of timestamps) ──
create or replace function public._pcm_fp_assessments(p_ids uuid[]) returns text
language sql stable security definer set search_path = public as $$
  select md5(
    coalesce((select jsonb_agg(to_jsonb(a) - 'updated_at' - 'created_at' order by a.id)::text from assessments a where a.id = any (p_ids)), '') ||
    coalesce((select jsonb_agg(to_jsonb(q) - 'updated_at' - 'created_at' order by q.id)::text from question_bank q where q.assessment_id = any (p_ids)), '') ||
    coalesce((select jsonb_agg(to_jsonb(o) - 'created_at' order by o.id)::text from question_options o join question_bank q on q.id = o.question_id where q.assessment_id = any (p_ids)), ''));
$$;

create or replace function public._pcm_fingerprint(p_kind text, p_source uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  if p_kind = 'course' then
    select md5(
      coalesce((select (to_jsonb(c) - 'updated_at' - 'created_at')::text from courses c where c.id = p_source), '') ||
      coalesce((select jsonb_agg(to_jsonb(m) - 'updated_at' - 'created_at' order by m.id)::text from modules m where m.course_id = p_source), '') ||
      coalesce((select jsonb_agg(to_jsonb(l) - 'updated_at' - 'created_at' order by l.id)::text from lessons l join modules m on m.id = l.module_id where m.course_id = p_source), '') ||
      coalesce((select jsonb_agg(to_jsonb(r) - 'updated_at' - 'created_at' order by r.id)::text from learning_resources r join lessons l on l.id = r.lesson_id join modules m on m.id = l.module_id where m.course_id = p_source), '') ||
      _pcm_fp_assessments(array(select a.id from assessments a join lessons l on l.id = a.lesson_id join modules m on m.id = l.module_id where m.course_id = p_source))) into v;
  elsif p_kind = 'induction_day' then
    select md5(
      coalesce((select (to_jsonb(d) - 'updated_at' - 'created_at')::text from induction_days d where d.id = p_source), '') ||
      coalesce((select jsonb_agg(to_jsonb(s) - 'updated_at' - 'created_at' order by s.id)::text from induction_day_sections s where s.day_id = p_source), '') ||
      _pcm_fp_assessments(array(select s.assessment_id from induction_day_sections s where s.day_id = p_source and s.assessment_id is not null))) into v;
  elsif p_kind = 'project' then
    select md5(
      coalesce((select (to_jsonb(p) - 'updated_at' - 'created_at')::text from real_estate_projects p where p.id = p_source), '') ||
      coalesce((select jsonb_agg(to_jsonb(s) - 'updated_at' - 'created_at' order by s.id)::text from real_estate_project_sections s where s.project_id = p_source), '') ||
      coalesce((select jsonb_agg(to_jsonb(b) - 'created_at' order by b.id)::text from real_estate_project_brochures b where b.project_id = p_source), '') ||
      _pcm_fp_assessments(array(select s.assessment_id from real_estate_project_sections s where s.project_id = p_source and s.assessment_id is not null))) into v;
  elsif p_kind = 'video' then
    select md5(coalesce((select (to_jsonb(x) - 'updated_at' - 'created_at')::text from library_videos x where x.id = p_source), '')) into v;
  else
    raise exception 'Unknown content kind %', p_kind;
  end if;
  return v;
end $$;

revoke all on function
  public._pcm_exists(regclass, uuid), public._pcm_next_order(regclass, uuid), public._pcm_child(text, uuid, uuid),
  public._pcm_clone_row(regclass, uuid, jsonb, text, uuid, uuid), public._pcm_sync_row(regclass, uuid, uuid, text[]),
  public._pcm_clone_assessment(uuid, uuid, uuid), public._pcm_sync_assessment(uuid, uuid, uuid),
  public._pcm_clone_lesson(uuid, uuid, uuid), public._pcm_clone_module(uuid, uuid, uuid), public._pcm_clone_course(uuid, uuid),
  public._pcm_sync_lesson(uuid, uuid, uuid), public._pcm_sync_course(uuid, uuid, uuid),
  public._pcm_clone_day_section(uuid, uuid, uuid), public._pcm_clone_day(uuid, uuid), public._pcm_sync_day(uuid, uuid, uuid),
  public._pcm_clone_project_section(uuid, uuid, uuid), public._pcm_clone_project(uuid, uuid), public._pcm_sync_project(uuid, uuid, uuid),
  public._pcm_clone_video(uuid, uuid), public._pcm_fp_assessments(uuid[]), public._pcm_fingerprint(text, uuid)
  from public, anon, authenticated;

-- ── what the owner's screens call ───────────────────────────────────────────
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

-- one row per (item, company): how many copies still exist, and whether the master changed since they were last updated
create or replace function public.platform_content_changes()
returns table (kind text, source_id uuid, target_company_id uuid, copies integer, changed boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare r record; v_fp text; v_copies integer; v_changed boolean; v_table regclass;
begin
  if not public.current_company_is_platform_operator() then
    raise exception 'Only the platform owner can see this.' using errcode = '42501';
  end if;
  for r in select m.kind, m.source_id, m.target_company_id from platform_content_map m
           where m.kind in ('course', 'induction_day', 'project', 'video') group by m.kind, m.source_id, m.target_company_id loop
    v_table := case r.kind when 'course' then 'courses'::regclass when 'induction_day' then 'induction_days'::regclass
                           when 'project' then 'real_estate_projects'::regclass else 'library_videos'::regclass end;
    if not _pcm_exists(v_table, r.source_id) then continue; end if;
    v_fp := _pcm_fingerprint(r.kind, r.source_id);
    v_copies := 0; v_changed := false;
    declare t record;
    begin
      for t in select target_id, root_fingerprint from platform_content_map where kind = r.kind and source_id = r.source_id and target_company_id = r.target_company_id loop
        if _pcm_exists(v_table, t.target_id) then
          v_copies := v_copies + 1;
          if t.root_fingerprint is distinct from v_fp then v_changed := true; end if;
        end if;
      end loop;
    end;
    if v_copies > 0 then
      kind := r.kind; source_id := r.source_id; target_company_id := r.target_company_id; copies := v_copies; changed := v_changed;
      return next;
    end if;
  end loop;
end $$;

-- keep the earlier single-test function working, now on top of the same helper
create or replace function public.platform_clone_assessment(p_source uuid, p_target_company uuid, p_lesson uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not public.current_company_is_platform_operator() then
    raise exception 'Only the platform owner can send tests to other companies.';
  end if;
  return _pcm_clone_assessment(p_source, p_target_company, p_lesson);
end $$;

revoke all on function public.platform_clone_content(text, uuid, uuid), public.platform_sync_content(text, uuid, uuid), public.platform_content_changes(), public.platform_clone_assessment(uuid, uuid, uuid) from public, anon;
grant execute on function public.platform_clone_content(text, uuid, uuid), public.platform_sync_content(text, uuid, uuid), public.platform_content_changes(), public.platform_clone_assessment(uuid, uuid, uuid) to authenticated;

-- ── Reports → Induction: admins/trainers may read which cards employees opened ──
drop policy if exists induction_section_views_company_read on public.induction_section_views;
create policy induction_section_views_company_read on public.induction_section_views
  for select to authenticated
  using (exists (select 1 from public.induction_day_sections s where s.id = section_id and s.company_id = public.current_employee_company_id()));
