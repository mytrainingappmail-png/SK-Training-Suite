-- One-time: give the platform owner a MASTER copy of an existing company's content.
--
-- The owner's workspace (PLATFORM) starts empty; the courses, videos, projects and
-- induction days built so far live in RMT001. This COPIES them into PLATFORM (RMT001 is
-- left exactly as it is) so the owner can keep editing the master versions there and push
-- copies to customers with Content Distribution.
--
-- Same rules as Content Distribution: every copied row gets a new id; category / branch /
-- author links are cleared (they belong to the source company); course codes get a
-- "PLT-" prefix because they must be unique across the platform. Tests (assessments) that
-- belong to copied lessons/sections are copied too and re-linked to the copies.
--
-- Refuses to run if PLATFORM already has any courses/videos/projects/induction days.
-- Set v_dry := true to see the counts and roll everything back.

do $$
declare
  v_dry constant boolean := false;
  v_src uuid := (select id from companies where company_code = 'RMT001');
  v_dst uuid := (select id from companies where company_code = 'PLATFORM');
  n_courses int; n_modules int; n_lessons int; n_assess int; n_questions int; n_options int;
  n_subjects int; n_videos int; n_projects int; n_psections int; n_brochures int; n_days int; n_dsections int;
begin
  if v_src is null or v_dst is null then raise exception 'Source or PLATFORM company not found.'; end if;
  if exists (select 1 from courses where company_id = v_dst)
     or exists (select 1 from library_videos where company_id = v_dst)
     or exists (select 1 from real_estate_projects where company_id = v_dst)
     or exists (select 1 from induction_days where company_id = v_dst) then
    raise exception 'PLATFORM already has content; not copying again.';
  end if;

  create temp table m_course(old uuid primary key, new uuid) on commit drop;
  create temp table m_module(old uuid primary key, new uuid) on commit drop;
  create temp table m_lesson(old uuid primary key, new uuid) on commit drop;
  create temp table m_assess(old uuid primary key, new uuid) on commit drop;
  create temp table m_question(old uuid primary key, new uuid) on commit drop;
  create temp table m_subject(old uuid primary key, new uuid) on commit drop;
  create temp table m_project(old uuid primary key, new uuid) on commit drop;
  create temp table m_day(old uuid primary key, new uuid) on commit drop;

  -- ── courses → modules → lessons ──
  insert into m_course select id, gen_random_uuid() from courses where company_id = v_src;
  insert into courses
    select r.* from courses c join m_course m on m.old = c.id
    cross join lateral jsonb_populate_record(null::courses, to_jsonb(c) || jsonb_build_object(
      'id', m.new, 'company_id', v_dst, 'category_id', null, 'created_by', null,
      'course_code', 'PLT-' || c.course_code, 'created_at', now(), 'updated_at', now())) r;
  get diagnostics n_courses = row_count;

  insert into m_module select mo.id, gen_random_uuid() from modules mo join m_course mc on mc.old = mo.course_id;
  insert into modules
    select r.* from modules mo join m_module m on m.old = mo.id join m_course mc on mc.old = mo.course_id
    cross join lateral jsonb_populate_record(null::modules, to_jsonb(mo) || jsonb_build_object(
      'id', m.new, 'course_id', mc.new, 'created_at', now(), 'updated_at', now())) r;
  get diagnostics n_modules = row_count;

  insert into m_lesson select l.id, gen_random_uuid() from lessons l join m_module mm on mm.old = l.module_id;
  insert into lessons
    select r.* from lessons l join m_lesson m on m.old = l.id join m_module mm on mm.old = l.module_id
    cross join lateral jsonb_populate_record(null::lessons, to_jsonb(l) || jsonb_build_object(
      'id', m.new, 'module_id', mm.new, 'created_at', now(), 'updated_at', now())) r;
  get diagnostics n_lessons = row_count;

  -- ── tests (assessments → questions → options) ──
  insert into m_assess select id, gen_random_uuid() from assessments where company_id = v_src;
  insert into assessments
    select r.* from assessments a join m_assess m on m.old = a.id
    left join m_lesson ml on ml.old = a.lesson_id
    cross join lateral jsonb_populate_record(null::assessments, to_jsonb(a) || jsonb_build_object(
      'id', m.new, 'company_id', v_dst, 'lesson_id', ml.new, 'assessment_code', 'PLT-' || a.assessment_code,
      'created_at', now(), 'updated_at', now())) r;
  get diagnostics n_assess = row_count;

  insert into m_question select q.id, gen_random_uuid() from assessment_questions q join m_assess ma on ma.old = q.assessment_id;
  insert into assessment_questions
    select r.* from assessment_questions q join m_question m on m.old = q.id join m_assess ma on ma.old = q.assessment_id
    cross join lateral jsonb_populate_record(null::assessment_questions, to_jsonb(q) || jsonb_build_object(
      'id', m.new, 'assessment_id', ma.new, 'created_at', now(), 'updated_at', now())) r;
  get diagnostics n_questions = row_count;

  insert into assessment_options
    select r.* from assessment_options o join m_question mq on mq.old = o.question_id
    cross join lateral jsonb_populate_record(null::assessment_options, to_jsonb(o) || jsonb_build_object(
      'id', gen_random_uuid(), 'question_id', mq.new, 'created_at', now(), 'updated_at', now())) r;
  get diagnostics n_options = row_count;

  -- ── library videos (+ their subject) ──
  insert into m_subject select id, gen_random_uuid() from video_subjects where company_id = v_src;
  insert into video_subjects
    select r.* from video_subjects s join m_subject m on m.old = s.id
    cross join lateral jsonb_populate_record(null::video_subjects, to_jsonb(s) || jsonb_build_object(
      'id', m.new, 'company_id', v_dst, 'created_at', now(), 'updated_at', now())) r;
  get diagnostics n_subjects = row_count;

  insert into library_videos
    select r.* from library_videos v join m_subject ms on ms.old = v.subject_id
    cross join lateral jsonb_populate_record(null::library_videos, to_jsonb(v) || jsonb_build_object(
      'id', gen_random_uuid(), 'company_id', v_dst, 'subject_id', ms.new, 'created_at', now(), 'updated_at', now())) r
    where v.company_id = v_src;
  get diagnostics n_videos = row_count;

  -- ── real-estate projects → sections, brochures ──
  insert into m_project select id, gen_random_uuid() from real_estate_projects where company_id = v_src;
  insert into real_estate_projects
    select r.* from real_estate_projects p join m_project m on m.old = p.id
    cross join lateral jsonb_populate_record(null::real_estate_projects, to_jsonb(p) || jsonb_build_object(
      'id', m.new, 'company_id', v_dst, 'category_id', null, 'branch_id', null, 'source_id', null,
      'created_at', now(), 'updated_at', now())) r;
  get diagnostics n_projects = row_count;

  insert into real_estate_project_sections
    select r.* from real_estate_project_sections s join m_project mp on mp.old = s.project_id
    left join m_assess ma on ma.old = s.assessment_id
    cross join lateral jsonb_populate_record(null::real_estate_project_sections, to_jsonb(s) || jsonb_build_object(
      'id', gen_random_uuid(), 'company_id', v_dst, 'project_id', mp.new, 'assessment_id', ma.new,
      'created_at', now(), 'updated_at', now())) r;
  get diagnostics n_psections = row_count;

  insert into real_estate_project_brochures
    select r.* from real_estate_project_brochures b join m_project mp on mp.old = b.project_id
    cross join lateral jsonb_populate_record(null::real_estate_project_brochures, to_jsonb(b) || jsonb_build_object(
      'id', gen_random_uuid(), 'project_id', mp.new, 'created_at', now())) r;
  get diagnostics n_brochures = row_count;

  -- ── induction days → sections ──
  insert into m_day select id, gen_random_uuid() from induction_days where company_id = v_src;
  insert into induction_days
    select r.* from induction_days d join m_day m on m.old = d.id
    cross join lateral jsonb_populate_record(null::induction_days, to_jsonb(d) || jsonb_build_object(
      'id', m.new, 'company_id', v_dst, 'branch_id', null, 'source_id', null, 'created_at', now(), 'updated_at', now())) r;
  get diagnostics n_days = row_count;

  insert into induction_day_sections
    select r.* from induction_day_sections s join m_day md on md.old = s.day_id
    left join m_assess ma on ma.old = s.assessment_id
    cross join lateral jsonb_populate_record(null::induction_day_sections, to_jsonb(s) || jsonb_build_object(
      'id', gen_random_uuid(), 'company_id', v_dst, 'day_id', md.new, 'assessment_id', ma.new,
      'created_at', now(), 'updated_at', now())) r;
  get diagnostics n_dsections = row_count;

  if v_dry then
    raise exception 'DRY RUN (rolled back): courses=% modules=% lessons=% assessments=% questions=% options=% subjects=% videos=% projects=% project_sections=% brochures=% induction_days=% induction_sections=%',
      n_courses, n_modules, n_lessons, n_assess, n_questions, n_options, n_subjects, n_videos, n_projects, n_psections, n_brochures, n_days, n_dsections;
  end if;
end $$;
