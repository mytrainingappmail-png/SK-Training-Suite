-- EXAMS: a paper-style test alongside Live Quiz.
--
-- Live Quiz shows one question at a time and moves everyone together. An
-- exam gives every employee the WHOLE paper on one scrolling screen, in any
-- order they like, against ONE clock for the whole paper. Answers autosave;
-- the employee can submit early; nobody sees a result until the admin
-- releases them; the admin sees everyone's result together once the exam is
-- over and marks written answers by hand.
--
-- Questions are the SAME rows as Live Quiz (quizzes / quiz_questions /
-- quiz_question_options) — an "exam" is just a quiz with mode = 'exam' —
-- so the builder, the map (hotspot) editor and CSV import all carry over.
-- Every deadline is stamped by the DATABASE clock inside an RPC, never a
-- browser's.

-- ── Content ─────────────────────────────────────────────────────────────
alter table quizzes add column if not exists mode text not null default 'live';
alter table quizzes drop constraint if exists quizzes_mode_check;
alter table quizzes add constraint quizzes_mode_check check (mode in ('live', 'exam'));
alter table quizzes add column if not exists exam_duration_minutes int;

-- A written answer: typed text and/or photos of a handwritten answer,
-- marked by the admin.
alter table quiz_questions drop constraint if exists quiz_questions_type_check;
alter table quiz_questions add constraint quiz_questions_type_check
  check (type = any (array['mcq'::text, 'truefalse'::text, 'hotspot'::text, 'written'::text]));

-- ── Tables ──────────────────────────────────────────────────────────────
create table if not exists exam_sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  host_admin_id uuid references quiz_admins(id) on delete set null,
  pin text not null,
  duration_seconds int not null check (duration_seconds between 60 and 86400),
  opens_at timestamptz not null,
  deadline_at timestamptz not null,
  finished_at timestamptz,
  results_released boolean not null default false,
  results_released_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_exam_sessions_open_pin on exam_sessions (pin) where finished_at is null;
create index if not exists idx_exam_sessions_quiz on exam_sessions (quiz_id, created_at desc);

create table if not exists exam_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references exam_sessions(id) on delete cascade,
  auth_user_id uuid not null,
  display_name text not null,
  joined_at timestamptz not null default now(),
  submitted_at timestamptz,
  submit_reason text,
  tab_switches int not null default 0,
  unique (session_id, auth_user_id)
);
create index if not exists idx_exam_participants_session on exam_participants (session_id);

create table if not exists exam_answers (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references exam_participants(id) on delete cascade,
  question_id uuid not null references quiz_questions(id) on delete cascade,
  selected_option_id uuid,
  click_x numeric,
  click_y numeric,
  text_answer text,
  image_paths text[] not null default '{}',
  flagged boolean not null default false,
  updated_at timestamptz not null default now(),
  is_correct boolean,
  marks_awarded numeric,
  auto_graded boolean not null default false,
  grader_comment text,
  graded_at timestamptz,
  unique (participant_id, question_id)
);
create index if not exists idx_exam_answers_participant on exam_answers (participant_id);

alter table exam_sessions enable row level security;
alter table exam_participants enable row level security;
alter table exam_answers enable row level security;

drop policy if exists exam_sessions_admin_select on exam_sessions;
create policy exam_sessions_admin_select on exam_sessions for select using (company_id = current_quiz_admin_company_id());

drop policy if exists exam_participants_select on exam_participants;
create policy exam_participants_select on exam_participants for select using (
  auth_user_id = auth.uid()
  or exists (select 1 from exam_sessions s where s.id = exam_participants.session_id and s.company_id = current_quiz_admin_company_id())
);
-- exam_answers: no policies at all — every read/write goes through the RPCs
-- below, so marks can never be read early by going around them.

-- ── Photo storage (private) ─────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('exam-answers', 'exam-answers', false) on conflict (id) do nothing;

drop policy if exists exam_answers_participant_insert on storage.objects;
create policy exam_answers_participant_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'exam-answers'
  and exists (select 1 from exam_participants p
    where p.auth_user_id = auth.uid()
      and p.session_id::text = (storage.foldername(name))[1]
      and p.id::text = (storage.foldername(name))[2])
);
drop policy if exists exam_answers_participant_select on storage.objects;
create policy exam_answers_participant_select on storage.objects for select to authenticated using (
  bucket_id = 'exam-answers'
  and exists (select 1 from exam_participants p
    where p.auth_user_id = auth.uid()
      and p.session_id::text = (storage.foldername(name))[1]
      and p.id::text = (storage.foldername(name))[2])
);
drop policy if exists exam_answers_participant_delete on storage.objects;
create policy exam_answers_participant_delete on storage.objects for delete to authenticated using (
  bucket_id = 'exam-answers'
  and exists (select 1 from exam_participants p
    where p.auth_user_id = auth.uid()
      and p.session_id::text = (storage.foldername(name))[1]
      and p.id::text = (storage.foldername(name))[2])
);
drop policy if exists exam_answers_admin_select on storage.objects;
create policy exam_answers_admin_select on storage.objects for select to authenticated using (
  bucket_id = 'exam-answers'
  and exists (select 1 from exam_sessions s
    where s.id::text = (storage.foldername(name))[1] and s.company_id = current_quiz_admin_company_id())
);

-- ── Internal helpers (not exposed) ──────────────────────────────────────

-- Marks everything that has a single right answer. Written answers are
-- left for the admin.
create or replace function exam_grade_participant(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update exam_answers ea
  set is_correct = g.ok,
      marks_awarded = case when g.ok then g.marks else 0 end,
      auto_graded = true
  from (
    select a.id as answer_id, q.marks as marks,
      case q.type
        when 'hotspot' then
          case
            when a.click_x is null or a.click_y is null then false
            when q.hotspot_zones is not null and jsonb_typeof(q.hotspot_zones) = 'array' and jsonb_array_length(q.hotspot_zones) > 0
              then hotspot_zone_hit(q.hotspot_zones, a.click_x, a.click_y)
            when q.target_x is not null and q.target_y is not null
              then sqrt(power(a.click_x - q.target_x, 2) + power(a.click_y - q.target_y, 2)) <= coalesce(q.target_radius, 6)
            else false
          end
        else coalesce((select o.is_correct from quiz_question_options o where o.id = a.selected_option_id and o.question_id = q.id), false)
      end as ok
    from exam_answers a
    join quiz_questions q on q.id = a.question_id
    where a.participant_id = p_participant_id and q.type in ('mcq', 'truefalse', 'hotspot')
  ) g
  where ea.id = g.answer_id and ea.auto_graded = false;
end;
$$;

-- Submits every participant who hasn't submitted yet (time ran out, or the
-- admin ended the exam) and closes the session.
create or replace function exam_finalize_session(p_session_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
begin
  for v_pid in select ep.id from exam_participants ep where ep.session_id = p_session_id and ep.submitted_at is null loop
    update exam_participants set submitted_at = now(), submit_reason = p_reason where id = v_pid;
    perform exam_grade_participant(v_pid);
  end loop;
  update exam_sessions set finished_at = now() where id = p_session_id and finished_at is null;
end;
$$;

-- ── Admin: run an exam ──────────────────────────────────────────────────

create or replace function create_exam_session(
  p_quiz_id uuid,
  p_duration_seconds int,
  p_start_in_seconds int default null,
  p_start_at timestamptz default null
)
returns setof exam_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz record;
  v_opens timestamptz;
  v_pin text;
  v_row exam_sessions;
  i int;
begin
  select qz.company_id, qz.mode, qz.status into v_quiz from quizzes qz where qz.id = p_quiz_id;
  if v_quiz.company_id is null or v_quiz.company_id <> current_quiz_admin_company_id() or not current_quiz_admin_can_edit() then
    raise exception 'Exam not found or not authorized.';
  end if;
  if v_quiz.mode <> 'exam' then raise exception 'This is a Live Quiz, not an exam.'; end if;
  if v_quiz.status <> 'published' then raise exception 'Publish the exam before starting it.'; end if;
  if not quiz_module_enabled_for_company(v_quiz.company_id) then raise exception 'Live Quiz is not enabled for this company.'; end if;
  if not exists (select 1 from quiz_questions q where q.quiz_id = p_quiz_id and not q.is_hidden) then
    raise exception 'This exam has no visible questions.';
  end if;
  if p_duration_seconds is null or p_duration_seconds < 60 or p_duration_seconds > 86400 then
    raise exception 'Duration must be between 1 minute and 24 hours.';
  end if;

  v_opens := case
    when p_start_at is not null then greatest(p_start_at, now())
    when p_start_in_seconds is not null and p_start_in_seconds > 0 then now() + make_interval(secs => p_start_in_seconds)
    else now()
  end;
  if v_opens > now() + interval '30 days' then raise exception 'Start time is too far ahead.'; end if;

  for i in 1 .. 8 loop
    v_pin := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
    begin
      insert into exam_sessions (quiz_id, company_id, host_admin_id, pin, duration_seconds, opens_at, deadline_at)
      values (p_quiz_id, v_quiz.company_id,
        (select qa.id from quiz_admins qa where qa.auth_user_id = auth.uid() limit 1),
        v_pin, p_duration_seconds, v_opens, v_opens + make_interval(secs => p_duration_seconds))
      returning * into v_row;
      return next v_row;
      return;
    exception when unique_violation then
      null;
    end;
  end loop;
  raise exception 'Could not allocate a unique PIN. Please try again.';
end;
$$;

create or replace function start_exam_now(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update exam_sessions
  set opens_at = now(), deadline_at = now() + make_interval(secs => duration_seconds)
  where id = p_session_id and finished_at is null and opens_at > now()
    and company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit();
  if not found then raise exception 'Exam not found, already started, or not authorized.'; end if;
end;
$$;

create or replace function extend_exam_session(p_session_id uuid, p_add_seconds int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_add_seconds is null or p_add_seconds < 1 or p_add_seconds > 86400 then
    raise exception 'Extension must be between 1 second and 24 hours.';
  end if;
  update exam_sessions
  set deadline_at = deadline_at + make_interval(secs => p_add_seconds),
      duration_seconds = least(86400, duration_seconds + p_add_seconds)
  where id = p_session_id and finished_at is null
    and company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit();
  if not found then raise exception 'Exam not found, already finished, or not authorized.'; end if;
end;
$$;

create or replace function end_exam_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from exam_sessions s where s.id = p_session_id
    and s.company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit()) then
    raise exception 'Exam not found or not authorized.';
  end if;
  perform exam_finalize_session(p_session_id, 'ended_by_admin');
end;
$$;

create or replace function release_exam_results(p_session_id uuid, p_release boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update exam_sessions
  set results_released = p_release, results_released_at = case when p_release then now() else null end
  where id = p_session_id and finished_at is not null
    and company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit();
  if not found then raise exception 'Exam not found, not finished yet, or not authorized.'; end if;
end;
$$;

-- Session status for the admin screen. Also the moment a session whose time
-- ran out is finalised (after a short grace for phones to auto-submit).
create or replace function get_exam_session_admin(p_session_id uuid)
returns table (
  session_id uuid, quiz_id uuid, quiz_title text, pin text, duration_seconds int,
  opens_at timestamptz, deadline_at timestamptz, finished_at timestamptz, server_now timestamptz,
  results_released boolean, status text, total_questions int, total_marks numeric, passing_score_pct int,
  joined int, submitted int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s exam_sessions;
begin
  select * into v_s from exam_sessions es where es.id = p_session_id and es.company_id = current_quiz_admin_company_id();
  if v_s.id is null then raise exception 'Exam not found or not authorized.'; end if;

  if v_s.finished_at is null and now() >= v_s.deadline_at + interval '90 seconds' then
    perform exam_finalize_session(p_session_id, 'timeout');
    select * into v_s from exam_sessions es where es.id = p_session_id;
  end if;

  return query
  select v_s.id, v_s.quiz_id, qz.title, v_s.pin, v_s.duration_seconds,
    v_s.opens_at, v_s.deadline_at, v_s.finished_at, now(),
    v_s.results_released,
    case when v_s.finished_at is not null then 'finished'
         when now() < v_s.opens_at then 'lobby'
         when now() >= v_s.deadline_at then 'closing'
         else 'running' end,
    (select count(*)::int from quiz_questions q where q.quiz_id = v_s.quiz_id and not q.is_hidden),
    (select coalesce(sum(q.marks), 0)::numeric from quiz_questions q where q.quiz_id = v_s.quiz_id and not q.is_hidden),
    qz.passing_score_pct,
    (select count(*)::int from exam_participants ep where ep.session_id = v_s.id),
    (select count(*)::int from exam_participants ep where ep.session_id = v_s.id and ep.submitted_at is not null)
  from quizzes qz where qz.id = v_s.quiz_id;
end;
$$;

create or replace function get_exam_participants_admin(p_session_id uuid)
returns table (
  participant_id uuid, display_name text, joined_at timestamptz, submitted_at timestamptz,
  submit_reason text, tab_switches int, answered_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from exam_sessions s where s.id = p_session_id and s.company_id = current_quiz_admin_company_id()) then
    raise exception 'Exam not found or not authorized.';
  end if;
  return query
  select ep.id, ep.display_name, ep.joined_at, ep.submitted_at, ep.submit_reason, ep.tab_switches,
    (select count(*)::int from exam_answers a where a.participant_id = ep.id
      and (a.selected_option_id is not null or a.click_x is not null or coalesce(trim(a.text_answer), '') <> '' or cardinality(a.image_paths) > 0))
  from exam_participants ep
  where ep.session_id = p_session_id
  order by ep.joined_at;
end;
$$;

-- Scores exist for the admin only AFTER the exam has finished.
create or replace function get_exam_results(p_session_id uuid)
returns table (
  participant_id uuid, display_name text, submitted_at timestamptz, submit_reason text, tab_switches int,
  auto_marks numeric, manual_marks numeric, pending_written int, possible_marks numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_s exam_sessions;
begin
  select * into v_s from exam_sessions es where es.id = p_session_id and es.company_id = current_quiz_admin_company_id();
  if v_s.id is null then raise exception 'Exam not found or not authorized.'; end if;
  if v_s.finished_at is null then raise exception 'Results are available only after the exam has finished.'; end if;

  return query
  select ep.id, ep.display_name, ep.submitted_at, ep.submit_reason, ep.tab_switches,
    coalesce((select sum(a.marks_awarded) from exam_answers a where a.participant_id = ep.id and a.auto_graded), 0)::numeric,
    coalesce((select sum(a.marks_awarded) from exam_answers a where a.participant_id = ep.id and not a.auto_graded), 0)::numeric,
    (select count(*)::int from exam_answers a join quiz_questions q on q.id = a.question_id
      where a.participant_id = ep.id and q.type = 'written' and a.marks_awarded is null
        and (coalesce(trim(a.text_answer), '') <> '' or cardinality(a.image_paths) > 0)),
    (select coalesce(sum(q.marks), 0)::numeric from quiz_questions q where q.quiz_id = v_s.quiz_id and not q.is_hidden)
  from exam_participants ep
  where ep.session_id = p_session_id
  order by ep.display_name;
end;
$$;

create or replace function get_exam_participant_detail(p_participant_id uuid)
returns table (
  answer_id uuid, question_id uuid, question_order int, question_text text, type text, marks int, explanation text,
  image_url text, selected_option_text text, correct_option_text text, text_answer text, image_paths text[],
  click_x numeric, click_y numeric, answered boolean, flagged boolean,
  is_correct boolean, marks_awarded numeric, grader_comment text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_s exam_sessions;
begin
  select es.* into v_s from exam_participants ep join exam_sessions es on es.id = ep.session_id
  where ep.id = p_participant_id and es.company_id = current_quiz_admin_company_id();
  if v_s.id is null then raise exception 'Not found or not authorized.'; end if;
  if v_s.finished_at is null then raise exception 'Results are available only after the exam has finished.'; end if;

  return query
  select a.id, q.id, q.display_order, q.question_text, q.type, q.marks, q.explanation,
    q.image_url,
    (select o.option_text from quiz_question_options o where o.id = a.selected_option_id),
    (select string_agg(o.option_text, ' / ' order by o.display_order) from quiz_question_options o where o.question_id = q.id and o.is_correct),
    a.text_answer, coalesce(a.image_paths, '{}'::text[]), a.click_x, a.click_y,
    (a.id is not null and (a.selected_option_id is not null or a.click_x is not null or coalesce(trim(a.text_answer), '') <> '' or cardinality(a.image_paths) > 0)),
    coalesce(a.flagged, false),
    a.is_correct, a.marks_awarded, a.grader_comment
  from quiz_questions q
  left join exam_answers a on a.question_id = q.id and a.participant_id = p_participant_id
  where q.quiz_id = v_s.quiz_id and not q.is_hidden
  order by q.display_order;
end;
$$;

create or replace function grade_exam_answer(p_answer_id uuid, p_marks numeric, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marks int;
  v_type text;
  v_finished timestamptz;
begin
  select q.marks, q.type, es.finished_at into v_marks, v_type, v_finished
  from exam_answers a
  join exam_participants ep on ep.id = a.participant_id
  join exam_sessions es on es.id = ep.session_id
  join quiz_questions q on q.id = a.question_id
  where a.id = p_answer_id and es.company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit();
  if v_marks is null then raise exception 'Answer not found or not authorized.'; end if;
  if v_finished is null then raise exception 'Marking opens once the exam has finished.'; end if;
  if v_type <> 'written' then raise exception 'Only written answers are marked by hand.'; end if;
  if p_marks is null or p_marks < 0 or p_marks > v_marks then
    raise exception 'Marks must be between 0 and %.', v_marks;
  end if;

  update exam_answers
  set marks_awarded = p_marks, is_correct = (p_marks >= v_marks), grader_comment = nullif(trim(coalesce(p_comment, '')), ''),
      graded_at = now(), auto_graded = false
  where id = p_answer_id;
end;
$$;

create or replace function get_exam_question_stats(p_session_id uuid)
returns table (question_id uuid, question_order int, question_text text, type text, marks int, attempted int, correct int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_s exam_sessions;
begin
  select * into v_s from exam_sessions es where es.id = p_session_id and es.company_id = current_quiz_admin_company_id();
  if v_s.id is null then raise exception 'Exam not found or not authorized.'; end if;
  if v_s.finished_at is null then raise exception 'Results are available only after the exam has finished.'; end if;

  return query
  select q.id, q.display_order, q.question_text, q.type, q.marks,
    (select count(*)::int from exam_answers a join exam_participants ep on ep.id = a.participant_id
      where a.question_id = q.id and ep.session_id = p_session_id
        and (a.selected_option_id is not null or a.click_x is not null or coalesce(trim(a.text_answer), '') <> '' or cardinality(a.image_paths) > 0)),
    (select count(*)::int from exam_answers a join exam_participants ep on ep.id = a.participant_id
      where a.question_id = q.id and ep.session_id = p_session_id and a.is_correct is true)
  from quiz_questions q
  where q.quiz_id = v_s.quiz_id and not q.is_hidden
  order by q.display_order;
end;
$$;

-- ── Employee side ───────────────────────────────────────────────────────

create or replace function join_exam_session(p_pin text, p_display_name text)
returns table (exam_session_id uuid, exam_participant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s exam_sessions;
  v_pid uuid;
begin
  if auth.uid() is null then raise exception 'Please try again.'; end if;
  if coalesce(trim(p_display_name), '') = '' then raise exception 'Please enter your name to join.'; end if;

  select * into v_s from exam_sessions es where es.pin = p_pin and es.finished_at is null;
  if v_s.id is null then raise exception 'That PIN is not active. Ask your trainer for the current one.'; end if;
  if now() >= v_s.deadline_at then raise exception 'This exam''s time is over.'; end if;
  if not quiz_module_enabled_for_company(v_s.company_id) then raise exception 'Live Quiz is not enabled for this company.'; end if;

  insert into exam_participants (session_id, auth_user_id, display_name)
  values (v_s.id, auth.uid(), trim(p_display_name))
  on conflict (session_id, auth_user_id) do nothing;

  select ep.id into v_pid from exam_participants ep where ep.session_id = v_s.id and ep.auth_user_id = auth.uid();
  return query select v_s.id, v_pid;
end;
$$;

create or replace function get_exam_state(p_session_id uuid)
returns table (
  participant_id uuid, display_name text, quiz_title text, description text, duration_seconds int,
  opens_at timestamptz, deadline_at timestamptz, server_now timestamptz, status text,
  submitted_at timestamptz, results_released boolean, total_questions int, passing_score_pct int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_dn text;
  v_sub timestamptz;
  v_s exam_sessions;
begin
  select ep.id, ep.display_name, ep.submitted_at into v_pid, v_dn, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  select * into v_s from exam_sessions es where es.id = p_session_id;

  return query
  select v_pid, v_dn, qz.title, qz.description, v_s.duration_seconds,
    v_s.opens_at, v_s.deadline_at, now(),
    case when v_s.finished_at is not null or now() >= v_s.deadline_at then 'finished'
         when now() < v_s.opens_at then 'lobby'
         else 'running' end,
    v_sub, v_s.results_released,
    (select count(*)::int from quiz_questions q where q.quiz_id = v_s.quiz_id and not q.is_hidden),
    qz.passing_score_pct
  from quizzes qz where qz.id = v_s.quiz_id;
end;
$$;

-- The whole paper in this employee's own order. Correct answers are never
-- included. Shuffling reuses the quiz's own two flags.
create or replace function get_exam_paper(p_session_id uuid)
returns table (
  question_position int, question_id uuid, question_text text, type text, marks int, image_url text,
  option_id uuid, option_text text, option_order int,
  saved_selected_option_id uuid, saved_click_x numeric, saved_click_y numeric,
  saved_text text, saved_image_paths text[], saved_flagged boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
  v_shuffle_q boolean;
  v_shuffle_o boolean;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  select * into v_s from exam_sessions es where es.id = p_session_id;
  if now() < v_s.opens_at then raise exception 'The exam has not started yet.'; end if;
  if v_sub is not null then raise exception 'You have already submitted this exam.'; end if;
  if v_s.finished_at is not null or now() > v_s.deadline_at + interval '90 seconds' then raise exception 'This exam''s time is over.'; end if;

  select coalesce(qz.shuffle_questions_per_participant, false), coalesce(qz.shuffle_options, false)
    into v_shuffle_q, v_shuffle_o from quizzes qz where qz.id = v_s.quiz_id;

  return query
  with qs as (
    select q.*, row_number() over (
      order by case when v_shuffle_q then md5(q.id::text || v_pid::text) else lpad(q.display_order::text, 10, '0') end
    )::int as pos
    from quiz_questions q where q.quiz_id = v_s.quiz_id and not q.is_hidden
  )
  select qs.pos, qs.id, qs.question_text, qs.type, qs.marks, qs.image_url,
    o.id, o.option_text,
    case when o.id is null then null
         when v_shuffle_o and qs.type <> 'truefalse' then (row_number() over (partition by qs.id order by md5(o.id::text || v_pid::text)))::int
         else (row_number() over (partition by qs.id order by o.display_order))::int end,
    a.selected_option_id, a.click_x, a.click_y, a.text_answer, coalesce(a.image_paths, '{}'::text[]), coalesce(a.flagged, false)
  from qs
  left join quiz_question_options o on o.question_id = qs.id
  left join exam_answers a on a.question_id = qs.id and a.participant_id = v_pid
  order by qs.pos, 9;
end;
$$;

create or replace function save_exam_answer(
  p_session_id uuid,
  p_question_id uuid,
  p_selected_option_id uuid default null,
  p_click_x numeric default null,
  p_click_y numeric default null,
  p_text_answer text default null,
  p_image_paths text[] default null,
  p_flagged boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
  v_prefix text;
  v_type text;
  v_empty boolean;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  if v_sub is not null then raise exception 'You have already submitted this exam.'; end if;

  select * into v_s from exam_sessions es where es.id = p_session_id;
  if now() < v_s.opens_at then raise exception 'The exam has not started yet.'; end if;
  if v_s.finished_at is not null or now() > v_s.deadline_at + interval '20 seconds' then
    raise exception 'The exam time is over — answers are locked.';
  end if;

  select q.type into v_type from quiz_questions q where q.id = p_question_id and q.quiz_id = v_s.quiz_id and not q.is_hidden;
  if v_type is null then raise exception 'That question is not part of this exam.'; end if;

  if p_selected_option_id is not null and not exists (
    select 1 from quiz_question_options o where o.id = p_selected_option_id and o.question_id = p_question_id
  ) then raise exception 'That option does not belong to this question.'; end if;

  if p_text_answer is not null and length(p_text_answer) > 20000 then raise exception 'Answer is too long.'; end if;

  v_prefix := p_session_id::text || '/' || v_pid::text || '/';
  if p_image_paths is not null then
    if cardinality(p_image_paths) > 5 then raise exception 'You can attach up to 5 photos per answer.'; end if;
    if exists (select 1 from unnest(p_image_paths) pth where left(pth, length(v_prefix)) <> v_prefix) then
      raise exception 'Invalid photo.';
    end if;
  end if;

  v_empty := p_selected_option_id is null and p_click_x is null and coalesce(trim(p_text_answer), '') = ''
    and coalesce(cardinality(p_image_paths), 0) = 0 and not coalesce(p_flagged, false);

  if v_empty then
    delete from exam_answers where participant_id = v_pid and question_id = p_question_id;
    return;
  end if;

  insert into exam_answers (participant_id, question_id, selected_option_id, click_x, click_y, text_answer, image_paths, flagged, updated_at)
  values (v_pid, p_question_id, p_selected_option_id, p_click_x, p_click_y, nullif(p_text_answer, ''), coalesce(p_image_paths, '{}'), coalesce(p_flagged, false), now())
  on conflict (participant_id, question_id) do update
    set selected_option_id = excluded.selected_option_id,
        click_x = excluded.click_x,
        click_y = excluded.click_y,
        text_answer = excluded.text_answer,
        image_paths = excluded.image_paths,
        flagged = excluded.flagged,
        updated_at = now();
end;
$$;

create or replace function submit_exam(p_session_id uuid, p_reason text default 'manual')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_sub timestamptz;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  if v_sub is not null then return; end if; -- already submitted: idempotent

  update exam_participants
  set submitted_at = now(), submit_reason = case when p_reason = 'timeout' then 'timeout' else 'manual' end
  where id = v_pid;
  perform exam_grade_participant(v_pid);
end;
$$;

create or replace function flag_exam_tab_switch(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update exam_participants set tab_switches = tab_switches + 1
  where session_id = p_session_id and auth_user_id = auth.uid() and submitted_at is null;
end;
$$;

-- What the employee sees AFTER the admin releases results.
create or replace function get_my_exam_result(p_session_id uuid)
returns table (
  question_order int, question_text text, type text, marks int,
  my_answer_text text, my_selected_option_text text, correct_option_text text,
  is_correct boolean, marks_awarded numeric, grader_comment text, answered boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  select * into v_s from exam_sessions es where es.id = p_session_id;
  if not v_s.results_released or v_sub is null then raise exception 'Your result is not available yet.'; end if;

  return query
  select q.display_order, q.question_text, q.type, q.marks,
    a.text_answer,
    (select o.option_text from quiz_question_options o where o.id = a.selected_option_id),
    (select string_agg(o.option_text, ' / ' order by o.display_order) from quiz_question_options o where o.question_id = q.id and o.is_correct),
    a.is_correct, a.marks_awarded, a.grader_comment,
    (a.id is not null and (a.selected_option_id is not null or a.click_x is not null or coalesce(trim(a.text_answer), '') <> '' or cardinality(a.image_paths) > 0))
  from quiz_questions q
  left join exam_answers a on a.question_id = q.id and a.participant_id = v_pid
  where q.quiz_id = v_s.quiz_id and not q.is_hidden
  order by q.display_order;
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────
revoke all on function exam_grade_participant(uuid) from public, anon, authenticated;
revoke all on function exam_finalize_session(uuid, text) from public, anon, authenticated;

grant execute on function create_exam_session(uuid, int, int, timestamptz) to authenticated;
grant execute on function start_exam_now(uuid) to authenticated;
grant execute on function extend_exam_session(uuid, int) to authenticated;
grant execute on function end_exam_session(uuid) to authenticated;
grant execute on function release_exam_results(uuid, boolean) to authenticated;
grant execute on function get_exam_session_admin(uuid) to authenticated;
grant execute on function get_exam_participants_admin(uuid) to authenticated;
grant execute on function get_exam_results(uuid) to authenticated;
grant execute on function get_exam_participant_detail(uuid) to authenticated;
grant execute on function grade_exam_answer(uuid, numeric, text) to authenticated;
grant execute on function get_exam_question_stats(uuid) to authenticated;
grant execute on function join_exam_session(text, text) to authenticated;
grant execute on function get_exam_state(uuid) to authenticated;
grant execute on function get_exam_paper(uuid) to authenticated;
grant execute on function save_exam_answer(uuid, uuid, uuid, numeric, numeric, text, text[], boolean) to authenticated;
grant execute on function submit_exam(uuid, text) to authenticated;
grant execute on function flag_exam_tab_switch(uuid) to authenticated;
grant execute on function get_my_exam_result(uuid) to authenticated;
