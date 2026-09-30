-- Exam & Live Quiz integrity (Phase 5a).
--
-- Findings this closes (all verified against the live functions):
--  * The exam player took its "reveal answers / feedback" settings from
--    get_quiz_public_branding(), which returns the FIRST company that has Live
--    Quiz enabled — so an exam of company B used company A's settings — and
--    the server sent the per-answer is_correct flag to the browser regardless of
--    the setting (hiding it was client-side only).
--  * check_hotspot_tap answered unlimited "is this point inside a correct zone?"
--    questions, so the zones could be mapped by tapping a grid.
--  * With instant feedback on, a participant could change an MCQ answer after
--    seeing it was wrong.
--  * submit_exam(reason='timeout') was accepted at any time, so a stale client
--    clock (or an admin extension it hadn't heard about) submitted early.
--  * Score totals in results/certificates summed answers to questions that had
--    since been hidden, while the possible-marks total excluded them (>100%).
--  * Live Quiz submit_quiz_answer / submit_quiz_hotspot_answer accepted ANY
--    question id (even another company's) and returned its answer key, and
--    trusted the client's response time (a negative time meant unlimited bonus).
--
-- Also adds: per-session snapshot of the reveal/feedback settings,
-- get_exam_session_settings (session-scoped branding), admin_regrade_question,
-- reopen_exam_participant.

-- ── Per-session snapshot of the exam's answer-reveal settings ───────────────
alter table exam_sessions
  add column if not exists reveal_answers boolean,
  add column if not exists hotspot_feedback_seconds integer,
  add column if not exists hotspot_feedback_size text;

update exam_sessions es
set reveal_answers = coalesce(s.exam_reveal_answers, true),
    hotspot_feedback_seconds = coalesce(s.exam_hotspot_feedback_seconds, 3),
    hotspot_feedback_size = coalesce(s.exam_hotspot_feedback_size, 'small')
from exam_sessions e2
left join quiz_settings s on s.company_id = e2.company_id
where e2.id = es.id and es.reveal_answers is null;

alter table exam_sessions
  alter column reveal_answers set default true,
  alter column reveal_answers set not null,
  alter column hotspot_feedback_seconds set default 3,
  alter column hotspot_feedback_seconds set not null,
  alter column hotspot_feedback_size set default 'small',
  alter column hotspot_feedback_size set not null;

create or replace function create_exam_session(p_quiz_id uuid, p_duration_seconds integer, p_start_in_seconds integer default null, p_start_at timestamptz default null)
returns setof exam_sessions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_quiz record;
  v_opens timestamptz;
  v_pin text;
  v_row exam_sessions;
  v_reveal boolean;
  v_fb_seconds integer;
  v_fb_size text;
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

  -- Freeze this exam's answer-reveal behaviour now, from ITS company's settings,
  -- so a later settings change never alters an exam already scheduled/running.
  select coalesce(s.exam_reveal_answers, true), coalesce(s.exam_hotspot_feedback_seconds, 3), coalesce(s.exam_hotspot_feedback_size, 'small')
    into v_reveal, v_fb_seconds, v_fb_size
  from (select 1) one left join quiz_settings s on s.company_id = v_quiz.company_id;

  for i in 1 .. 8 loop
    v_pin := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
    begin
      insert into exam_sessions (quiz_id, company_id, host_admin_id, pin, duration_seconds, opens_at, deadline_at,
                                 reveal_answers, hotspot_feedback_seconds, hotspot_feedback_size)
      values (p_quiz_id, v_quiz.company_id,
        (select qa.id from quiz_admins qa where qa.auth_user_id = auth.uid() limit 1),
        v_pin, p_duration_seconds, v_opens, v_opens + make_interval(secs => p_duration_seconds),
        coalesce(v_reveal, true), coalesce(v_fb_seconds, 3), coalesce(v_fb_size, 'small'))
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

-- Session-scoped settings/branding for a participant who has joined.
create or replace function get_exam_session_settings(p_session_id uuid)
returns table (
  company_name text, brand_name text, brand_tagline text, brand_logo_url text,
  login_background_url text, login_banner_url text, favicon_url text, footer_text text,
  login_motivational_words text, login_words_enabled boolean, login_logo_position text, login_logo_scale integer,
  exam_lobby_music text, exam_lobby_music_url text, exam_lobby_music_volume integer,
  exam_reveal_answers boolean, exam_hotspot_feedback_seconds integer, exam_hotspot_feedback_size text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.company_name::text, s.brand_name, s.brand_tagline, s.brand_logo_url,
         s.login_background_url, s.login_banner_url, s.favicon_url, s.footer_text,
         s.login_motivational_words, coalesce(s.login_words_enabled, true),
         coalesce(s.login_logo_position, 'top_center'), coalesce(s.login_logo_scale, 100),
         coalesce(s.exam_lobby_music, 'builtin'), s.exam_lobby_music_url, coalesce(s.exam_lobby_music_volume, 60),
         es.reveal_answers, es.hotspot_feedback_seconds, es.hotspot_feedback_size
  from exam_sessions es
  join companies c on c.id = es.company_id
  left join quiz_settings s on s.company_id = es.company_id
  where es.id = p_session_id
    and exists (select 1 from exam_participants ep where ep.session_id = es.id and ep.auth_user_id = auth.uid());
$$;
revoke all on function get_exam_session_settings(uuid) from public, anon;
grant execute on function get_exam_session_settings(uuid) to authenticated;

-- ── Hotspot tap-check budget ────────────────────────────────────────────────
create table if not exists exam_tap_checks (
  participant_id uuid not null references exam_participants(id) on delete cascade,
  question_id    uuid not null,
  checks         integer not null default 0,
  primary key (participant_id, question_id)
);
alter table exam_tap_checks enable row level security;
revoke all on exam_tap_checks from anon, authenticated;

create or replace function check_hotspot_tap(p_session_id uuid, p_question_id uuid, p_x numeric, p_y numeric)
returns table(is_correct boolean, zone_label text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
  v_zones jsonb;
  v_idx int;
  v_zone_n int;
  v_checks int;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  if v_sub is not null then raise exception 'You have already submitted this exam.'; end if;

  select * into v_s from exam_sessions es where es.id = p_session_id;
  if now() < v_s.opens_at or now() > v_s.deadline_at + interval '20 seconds' or v_s.finished_at is not null then
    raise exception 'The exam is not currently open.';
  end if;

  select q.hotspot_zones into v_zones
  from quiz_questions q where q.id = p_question_id and q.quiz_id = v_s.quiz_id and q.type = 'hotspot' and not q.is_hidden;
  if v_zones is null then raise exception 'That question is not part of this exam.'; end if;

  -- Answers are not revealed in this exam: never tell the browser.
  if not v_s.reveal_answers then
    return query select null::boolean, null::text;
    return;
  end if;

  -- Budget: enough for multi-point tapping with undo, far too few to map the
  -- image by probing a grid.
  v_zone_n := case when jsonb_typeof(v_zones) = 'array' then jsonb_array_length(v_zones) else 1 end;
  insert into exam_tap_checks as t (participant_id, question_id, checks) values (v_pid, p_question_id, 1)
  on conflict (participant_id, question_id) do update set checks = t.checks + 1
  returning t.checks into v_checks;
  if v_checks > 12 + 6 * greatest(v_zone_n, 1) then
    raise exception 'You have used all your tap checks for this question.';
  end if;

  v_idx := hotspot_zone_index_hit(v_zones, p_x, p_y);
  if v_idx is null then
    return query select false, null::text;
  else
    return query select true, nullif(trim(coalesce(v_zones->v_idx->>'label', '')), '');
  end if;
end;
$$;

-- ── submit_exam: a timeout submit is only valid once the deadline has passed ─
create or replace function submit_exam(p_session_id uuid, p_reason text default 'manual')
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_deadline timestamptz;
begin
  -- FOR UPDATE serialises against save_exam_answer (which also locks this
  -- row), so an answer can't land after the grade pass and silently score 0.
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid()
  for update;
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  if v_sub is not null then return; end if; -- already submitted: idempotent

  -- A "time is up" submit from a browser whose clock is fast, or that hasn't
  -- heard about an admin's time extension, must not end the exam early.
  if p_reason = 'timeout' then
    select es.deadline_at into v_deadline from exam_sessions es where es.id = p_session_id;
    if now() < v_deadline - interval '5 seconds' then
      raise exception 'The exam time has not ended yet.';
    end if;
  end if;

  update exam_participants
  set submitted_at = now(), submit_reason = case when p_reason = 'timeout' then 'timeout' else 'manual' end
  where id = v_pid;

  begin
    perform exam_grade_participant(v_pid);
  exception when others then
    raise warning 'submit_exam: grading failed for participant %: %', v_pid, sqlerrm;
  end;
end;
$$;

-- ── Admin tools ─────────────────────────────────────────────────────────────
-- 'full_marks': everyone who took the exam gets full marks for the question
--               (use when a question turned out to be wrong/ambiguous).
-- 'recompute' : grade the question again from the CURRENT correct options /
--               zones (use after fixing the answer key).
create or replace function admin_regrade_question(p_session_id uuid, p_question_id uuid, p_mode text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_s exam_sessions;
  v_q quiz_questions;
  v_n int := 0;
  v_pid uuid;
begin
  select * into v_s from exam_sessions es
  where es.id = p_session_id and es.company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit();
  if v_s.id is null then raise exception 'Exam not found or not authorized.'; end if;
  if v_s.finished_at is null then raise exception 'Regrading opens once the exam has finished.'; end if;

  select * into v_q from quiz_questions q where q.id = p_question_id and q.quiz_id = v_s.quiz_id;
  if v_q.id is null then raise exception 'That question is not part of this exam.'; end if;

  if p_mode = 'full_marks' then
    insert into exam_answers (participant_id, question_id, is_correct, marks_awarded, auto_graded, grader_comment, graded_at)
    select ep.id, v_q.id, true, v_q.marks, false, 'Full marks awarded to everyone (question regraded).', now()
    from exam_participants ep where ep.session_id = p_session_id and ep.submitted_at is not null
    on conflict (participant_id, question_id) do update
      set is_correct = true, marks_awarded = excluded.marks_awarded, auto_graded = false,
          grader_comment = excluded.grader_comment, graded_at = now();
    get diagnostics v_n = row_count;

  elsif p_mode = 'recompute' then
    if v_q.type not in ('mcq', 'truefalse', 'hotspot') then
      raise exception 'Only choice and hotspot questions can be recomputed; mark written answers by hand.';
    end if;
    for v_pid in select ep.id from exam_participants ep where ep.session_id = p_session_id and ep.submitted_at is not null loop
      update exam_answers a set auto_graded = false, grader_comment = null, graded_at = null
      where a.participant_id = v_pid and a.question_id = v_q.id;
      get diagnostics v_n = row_count;
      perform exam_grade_participant(v_pid);
    end loop;
    select count(*)::int into v_n from exam_answers a join exam_participants ep on ep.id = a.participant_id
      where ep.session_id = p_session_id and a.question_id = v_q.id;

  else
    raise exception 'Unknown regrade mode.';
  end if;

  return v_n;
end;
$$;
revoke all on function admin_regrade_question(uuid, uuid, text) from public, anon;
grant execute on function admin_regrade_question(uuid, uuid, text) to authenticated;

-- Undo an accidental "Submit" while the exam is still running.
create or replace function reopen_exam_participant(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_s exam_sessions;
begin
  select es.* into v_s
  from exam_participants ep join exam_sessions es on es.id = ep.session_id
  where ep.id = p_participant_id and es.company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit();
  if v_s.id is null then raise exception 'Participant not found or not authorized.'; end if;
  if v_s.finished_at is not null or now() >= v_s.deadline_at then
    raise exception 'The exam has ended. Extend the time first, or use Regrade for marks.';
  end if;
  update exam_participants set submitted_at = null, submit_reason = null where id = p_participant_id;
end;
$$;
revoke all on function reopen_exam_participant(uuid) from public, anon;
grant execute on function reopen_exam_participant(uuid) to authenticated;

-- ── Live Quiz: which question is current for this participant ───────────────
-- Same selection rules as get_current_quiz_question (per-participant shuffle,
-- stored order, display-order fallback). Internal helper for the submit RPCs.
create or replace function quiz_current_question_id(p_session_id uuid, p_participant_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_quiz uuid;
  v_idx int;
  v_order uuid[];
  v_shuffle boolean;
  v_qid uuid;
begin
  select quiz_id, current_question_index, question_order into v_quiz, v_idx, v_order
  from quiz_sessions where id = p_session_id and phase = 'question';
  if v_quiz is null then return null; end if;

  select coalesce(shuffle_questions_per_participant, false) into v_shuffle from quizzes where id = v_quiz;

  if v_shuffle then
    select qq.id into v_qid from quiz_questions qq
    where qq.quiz_id = v_quiz and not qq.is_hidden
    order by md5(qq.id::text || p_participant_id::text)
    offset v_idx limit 1;
  elsif v_order is not null and v_idx < array_length(v_order, 1) then
    v_qid := v_order[v_idx + 1];
  else
    select qq.id into v_qid from quiz_questions qq
    where qq.quiz_id = v_quiz and not qq.is_hidden order by qq.display_order limit 1 offset v_idx;
  end if;
  return v_qid;
end;
$$;
revoke all on function quiz_current_question_id(uuid, uuid) from public, anon, authenticated;

-- get_exam_paper: correctness only when this exam reveals answers
CREATE OR REPLACE FUNCTION public.get_exam_paper(p_session_id uuid)
 RETURNS TABLE(question_position integer, question_id uuid, question_text text, type text, marks integer, image_url text, option_id uuid, option_text text, option_order integer, saved_selected_option_id uuid, saved_click_x numeric, saved_click_y numeric, saved_text text, saved_image_paths text[], saved_flagged boolean, saved_hotspot_taps jsonb, hotspot_zone_count integer, saved_is_correct boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    a.selected_option_id, a.click_x, a.click_y, a.text_answer, coalesce(a.image_paths, '{}'::text[]), coalesce(a.flagged, false),
    coalesce(a.hotspot_taps, '[]'::jsonb),
    case when qs.hotspot_zones is not null and jsonb_typeof(qs.hotspot_zones) = 'array' then jsonb_array_length(qs.hotspot_zones) else null end,
    case when v_s.reveal_answers then a.is_correct end
  from qs
  left join quiz_question_options o on o.question_id = qs.id
  left join exam_answers a on a.question_id = qs.id and a.participant_id = v_pid
  order by qs.pos, 9;
end;
$function$;

-- save_exam_answer: first-answer-wins under instant feedback; correctness only when revealed
CREATE OR REPLACE FUNCTION public.save_exam_answer(p_session_id uuid, p_question_id uuid, p_selected_option_id uuid DEFAULT NULL::uuid, p_click_x numeric DEFAULT NULL::numeric, p_click_y numeric DEFAULT NULL::numeric, p_text_answer text DEFAULT NULL::text, p_image_paths text[] DEFAULT NULL::text[], p_flagged boolean DEFAULT false, p_hotspot_taps jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(saved_is_correct boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
  v_prefix text;
  v_type text;
  v_marks int;
  v_zone_count int;
  v_empty boolean;
  v_taps jsonb := '[]'::jsonb;
  v_is_correct boolean;
  v_marks_awarded numeric;
  v_auto_graded boolean;
  v_locked uuid;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid()
  for update;
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  if v_sub is not null then raise exception 'You have already submitted this exam.'; end if;

  select * into v_s from exam_sessions es where es.id = p_session_id;
  if now() < v_s.opens_at then raise exception 'The exam has not started yet.'; end if;
  if v_s.finished_at is not null or now() > v_s.deadline_at + interval '20 seconds' then
    raise exception 'The exam time is over — answers are locked.';
  end if;

  select q.type, q.marks,
         case when jsonb_typeof(q.hotspot_zones) = 'array' then jsonb_array_length(q.hotspot_zones) end
    into v_type, v_marks, v_zone_count
  from quiz_questions q where q.id = p_question_id and q.quiz_id = v_s.quiz_id and not q.is_hidden;
  if v_type is null then raise exception 'That question is not part of this exam.'; end if;

  if p_selected_option_id is not null and not exists (
    select 1 from quiz_question_options o where o.id = p_selected_option_id and o.question_id = p_question_id
  ) then raise exception 'That option does not belong to this question.'; end if;

  -- With instant right/wrong feedback on, the first choice is final: once an
  -- option is stored the server keeps it, whatever the browser sends later.
  if v_s.reveal_answers and v_type in ('mcq', 'truefalse') then
    select ea.selected_option_id into v_locked
    from exam_answers ea where ea.participant_id = v_pid and ea.question_id = p_question_id;
    if v_locked is not null then p_selected_option_id := v_locked; end if;
  end if;

  if p_text_answer is not null and length(p_text_answer) > 20000 then raise exception 'Answer is too long.'; end if;

  if p_hotspot_taps is not null then
    if jsonb_typeof(p_hotspot_taps) <> 'array' then raise exception 'Invalid tap data.'; end if;
    if jsonb_array_length(p_hotspot_taps) > 40 then raise exception 'Too many tapped points.'; end if;

    -- Only a hotspot question carries taps. Rebuild each one from scratch:
    -- numeric x/y inside the 0-100 image space, optional boolean `correct`,
    -- optional label capped at 80 chars — nothing else the client sent survives.
    if v_type = 'hotspot' then
      select coalesce(jsonb_agg(
               jsonb_strip_nulls(jsonb_build_object(
                 'x', n.x,
                 'y', n.y,
                 'correct', case when jsonb_typeof(e.t->'correct') = 'boolean' then e.t->'correct' end,
                 'label', case when jsonb_typeof(e.t->'label') = 'string' then to_jsonb(left(e.t->>'label', 80)) end
               )) order by e.ord), '[]'::jsonb)
        into v_taps
      from jsonb_array_elements(p_hotspot_taps) with ordinality as e(t, ord),
           lateral (select
             case when jsonb_typeof(e.t) = 'object' and jsonb_typeof(e.t->'x') = 'number' and jsonb_typeof(e.t->'y') = 'number'
                  then (e.t->>'x')::numeric end as x,
             case when jsonb_typeof(e.t) = 'object' and jsonb_typeof(e.t->'x') = 'number' and jsonb_typeof(e.t->'y') = 'number'
                  then (e.t->>'y')::numeric end as y
           ) n
      where n.x between 0 and 100 and n.y between 0 and 100
        and e.ord <= coalesce(v_zone_count, 1);
    end if;
  end if;

  v_prefix := p_session_id::text || '/' || v_pid::text || '/';
  if p_image_paths is not null then
    if cardinality(p_image_paths) > 5 then raise exception 'You can attach up to 5 photos per answer.'; end if;
    if exists (select 1 from unnest(p_image_paths) pth where left(pth, length(v_prefix)) <> v_prefix) then
      raise exception 'Invalid photo.';
    end if;
  end if;

  v_empty := p_selected_option_id is null and p_click_x is null and jsonb_array_length(v_taps) = 0
    and coalesce(trim(p_text_answer), '') = ''
    and coalesce(cardinality(p_image_paths), 0) = 0 and not coalesce(p_flagged, false);

  if v_empty then
    delete from exam_answers where participant_id = v_pid and question_id = p_question_id;
    return query select null::boolean;
    return;
  end if;

  if v_type in ('mcq', 'truefalse') and p_selected_option_id is not null then
    v_is_correct := coalesce((select o.is_correct from quiz_question_options o where o.id = p_selected_option_id), false);
    v_marks_awarded := case when v_is_correct then v_marks else 0 end;
    v_auto_graded := true;
  else
    v_is_correct := null;
    v_marks_awarded := null;
    v_auto_graded := false;
  end if;

  insert into exam_answers (participant_id, question_id, selected_option_id, click_x, click_y, text_answer, image_paths, flagged, hotspot_taps, is_correct, marks_awarded, auto_graded, updated_at)
  values (v_pid, p_question_id, p_selected_option_id, p_click_x, p_click_y, nullif(p_text_answer, ''), coalesce(p_image_paths, '{}'), coalesce(p_flagged, false), v_taps, v_is_correct, v_marks_awarded, v_auto_graded, now())
  on conflict (participant_id, question_id) do update
    set selected_option_id = excluded.selected_option_id,
        click_x = excluded.click_x,
        click_y = excluded.click_y,
        text_answer = excluded.text_answer,
        image_paths = excluded.image_paths,
        flagged = excluded.flagged,
        hotspot_taps = excluded.hotspot_taps,
        is_correct = excluded.is_correct,
        marks_awarded = excluded.marks_awarded,
        auto_graded = excluded.auto_graded,
        updated_at = now();

  return query select case when v_s.reveal_answers then v_is_correct end;
end;
$function$;

-- get_exam_results: earned marks must exclude hidden questions like possible_marks does
CREATE OR REPLACE FUNCTION public.get_exam_results(p_session_id uuid)
 RETURNS TABLE(participant_id uuid, display_name text, submitted_at timestamp with time zone, submit_reason text, tab_switches integer, auto_marks numeric, manual_marks numeric, pending_written integer, possible_marks numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_s exam_sessions;
begin
  select * into v_s from exam_sessions es where es.id = p_session_id and es.company_id = current_quiz_admin_company_id();
  if v_s.id is null then raise exception 'Exam not found or not authorized.'; end if;
  if v_s.finished_at is null then raise exception 'Results are available only after the exam has finished.'; end if;

  return query
  select ep.id, ep.display_name, ep.submitted_at, ep.submit_reason, ep.tab_switches,
    coalesce((select sum(a.marks_awarded) from exam_answers a join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = ep.id and a.auto_graded), 0)::numeric,
    coalesce((select sum(a.marks_awarded) from exam_answers a join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = ep.id and not a.auto_graded), 0)::numeric,
    (select count(*)::int from exam_answers a join quiz_questions q on q.id = a.question_id
      where a.participant_id = ep.id and q.type = 'written' and a.marks_awarded is null
        and (coalesce(trim(a.text_answer), '') <> '' or cardinality(a.image_paths) > 0)),
    (select coalesce(sum(q.marks), 0)::numeric from quiz_questions q where q.quiz_id = v_s.quiz_id and not q.is_hidden)
  from exam_participants ep
  where ep.session_id = p_session_id
  order by ep.display_name;
end;
$function$;

-- issue_exam_certificate: same fix for the pass check and the ranking
CREATE OR REPLACE FUNCTION public.issue_exam_certificate(p_participant_id uuid)
 RETURNS TABLE(id uuid, cert_number text, candidate_name text, quiz_title text, score_line text, template text, issued_at timestamp with time zone, company_name text, company_name_align text, cert_logo_url text, cert_logo_position text, cert_logo_scale integer, cert_watermark_type text, cert_watermark_text text, cert_watermark_image_url text, cert_title text, achievement_line text, signatory1_name text, signatory1_title text, signatory1_image_url text, signatory1_scale integer, signatory1_name_scale integer, signatory2_name text, signatory2_title text, signatory2_image_url text, signatory2_scale integer, signatory2_name_scale integer, signature_mode text, signature_align text, photo_enabled boolean, cert_photo_frame text, cert_award_seal text, candidate_photo_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_company_id uuid;
  v_session_id uuid;
  v_finished timestamptz;
  v_quiz_title text;
  v_display_name text;
  v_pass_pct int;
  v_issue boolean;
  v_quiz_id uuid;
  v_total numeric;
  v_got numeric;
  v_pct int;
  v_row_id uuid;
  v_cert record;
  v_eligibility text;
  v_company_display_name text;
  v_rank int;
  v_pending int;
begin
  select es.company_id, es.id, es.finished_at, qz.title, ep.display_name, qz.passing_score_pct, qz.issue_certificate, qz.id
    into v_company_id, v_session_id, v_finished, v_quiz_title, v_display_name, v_pass_pct, v_issue, v_quiz_id
  from exam_participants ep
  join exam_sessions es on es.id = ep.session_id
  join quizzes qz on qz.id = es.quiz_id
  where ep.id = p_participant_id;

  if v_company_id is null then raise exception 'Participant not found.'; end if;
  if v_company_id <> current_quiz_admin_company_id() then raise exception 'Not authorized for this participant.'; end if;
  if v_finished is null then raise exception 'Certificates can be issued only after the exam has finished.'; end if;
  if not coalesce(v_issue, true) then raise exception 'This exam does not issue certificates.'; end if;

  select count(*)::int into v_pending
  from exam_answers a join quiz_questions q on q.id = a.question_id
  where a.participant_id = p_participant_id and q.type = 'written' and a.marks_awarded is null
    and (coalesce(trim(a.text_answer), '') <> '' or cardinality(a.image_paths) > 0);
  if v_pending > 0 then raise exception 'Mark the written answers first, then issue the certificate.'; end if;

  select coalesce(sum(q.marks), 0) into v_total from quiz_questions q where q.quiz_id = v_quiz_id and not q.is_hidden;
  select coalesce(sum(a.marks_awarded), 0) into v_got from exam_answers a join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = p_participant_id;
  v_pct := case when v_total = 0 then 0 else round(100.0 * v_got / v_total) end;
  if v_pct < v_pass_pct then raise exception 'Certificates are only issued for a passing score.'; end if;

  select c.company_name into v_company_display_name from companies c where c.id = v_company_id;
  select qs.cert_eligibility into v_eligibility from quiz_settings qs where qs.company_id = v_company_id;
  select * into v_cert from quiz_cert_templates t where t.company_id = v_company_id and t.is_active = true;

  select r.rnk into v_rank from (
    select ep2.id as pid, rank() over (order by coalesce((select sum(a.marks_awarded) from exam_answers a join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = ep2.id), 0) desc) as rnk
    from exam_participants ep2 where ep2.session_id = v_session_id
  ) r where r.pid = p_participant_id;

  if coalesce(v_eligibility, 'all_pass') = 'top1' and v_rank > 1 then
    raise exception 'Certificates go to the top-ranked participant only.';
  elsif coalesce(v_eligibility, 'all_pass') = 'top3' and v_rank > 3 then
    raise exception 'Certificates go to the top 3 ranked participants only.';
  end if;

  select ec.id into v_row_id from exam_certificates ec where ec.participant_id = p_participant_id;
  if v_row_id is null then
    insert into exam_certificates (company_id, session_id, participant_id, cert_number, candidate_name, quiz_title, score_line, template)
    values (
      v_company_id, v_session_id, p_participant_id,
      'CERT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)),
      v_display_name, v_quiz_title, v_pct || '% — PASS',
      coalesce(v_cert.template, 'dark_elegant')
    )
    returning exam_certificates.id into v_row_id;
  end if;

  return query
  select
    ec.id, ec.cert_number, ec.candidate_name, ec.quiz_title, ec.score_line, ec.template, ec.issued_at,
    coalesce(v_cert.company_name, v_company_display_name, ''), coalesce(v_cert.company_name_align, 'center'),
    v_cert.logo_url, coalesce(v_cert.logo_position, 'top_center'), coalesce(v_cert.logo_scale, 100),
    coalesce(v_cert.watermark_type, 'none'), v_cert.watermark_text, v_cert.watermark_image_url,
    coalesce(v_cert.title, 'Certificate of Achievement'),
    coalesce(v_cert.achievement_line, 'has successfully completed'),
    v_cert.signatory1_name, v_cert.signatory1_title, v_cert.signatory1_image_url,
    coalesce(v_cert.signatory1_scale, 100), coalesce(v_cert.signatory1_name_scale, 100),
    v_cert.signatory2_name, v_cert.signatory2_title, v_cert.signatory2_image_url,
    coalesce(v_cert.signatory2_scale, 100), coalesce(v_cert.signatory2_name_scale, 100),
    coalesce(v_cert.signature_mode, 'both'), coalesce(v_cert.signature_align, 'center'),
    coalesce(v_cert.photo_enabled, false), coalesce(v_cert.photo_frame, 'circle'), coalesce(v_cert.award_seal, 'none'), ec.candidate_photo_url
  from exam_certificates ec where ec.id = v_row_id;
end;
$function$;

-- submit_quiz_answer: current question only, valid option, server-side timing
CREATE OR REPLACE FUNCTION public.submit_quiz_answer(p_session_id uuid, p_question_id uuid, p_option_id uuid, p_response_time_ms integer)
 RETURNS TABLE(is_correct boolean, correct_option_id uuid, points_awarded integer, explanation text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_participant_id uuid;
  v_correct boolean := false;
  v_correct_option uuid;
  v_marks int;
  v_max_timer int;
  v_points int := 0;
  v_phase text;
  v_company_id uuid;
  v_explanation text;
  v_started timestamptz;
  v_elapsed_ms int;
begin
  select id into v_participant_id from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase, company_id, question_started_at into v_phase, v_company_id, v_started from quiz_sessions where id = p_session_id;
  if v_phase <> 'question' then
    raise exception 'This question is no longer accepting answers.';
  end if;

  -- Only the question currently on screen for THIS participant can be answered
  -- (previously any question id was accepted and its answer key returned).
  if p_question_id is distinct from quiz_current_question_id(p_session_id, v_participant_id) then
    raise exception 'That question is not the current one.';
  end if;

  if not quiz_module_enabled_for_company(v_company_id) then
    raise exception 'Live Quiz is not enabled for this company.';
  end if;

  if p_option_id is not null and not exists (
    select 1 from quiz_question_options qo where qo.id = p_option_id and qo.question_id = p_question_id
  ) then
    raise exception 'That option does not belong to this question.';
  end if;

  select qo.id into v_correct_option from quiz_question_options qo
  where qo.question_id = p_question_id and qo.is_correct = true limit 1;

  if p_option_id is not null and p_option_id = v_correct_option then
    v_correct := true;
  end if;

  select qq.marks, coalesce(qq.timer_seconds, qz.default_timer_seconds), qq.explanation
    into v_marks, v_max_timer, v_explanation
  from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id
  where qq.id = p_question_id;

  -- Timing comes from the server clock (question_started_at is shifted on resume,
  -- so pauses are accounted for). The browser's figure is only trusted where it is
  -- plausible: never lower than server time minus network slack, never negative.
  v_elapsed_ms := case when v_started is null then null
    else least(2000000000, (extract(epoch from (now() - v_started)) * 1000)::bigint)::int end;
  if v_elapsed_ms is not null and v_elapsed_ms > v_max_timer * 1000 + 3000 then
    raise exception 'Time is up for this question.';
  end if;
  p_response_time_ms := least(v_max_timer * 1000, greatest(coalesce(p_response_time_ms, 0), coalesce(v_elapsed_ms, 0) - 1500, 0));

  if v_correct then
    v_points := v_marks * 1000 + greatest(0, round((1 - (p_response_time_ms::numeric / (v_max_timer * 1000))) * 500))::int;
  end if;

  insert into quiz_answers (session_id, participant_id, question_id, selected_option_id, is_correct, response_time_ms)
  values (p_session_id, v_participant_id, p_question_id, p_option_id, v_correct, p_response_time_ms)
  on conflict (participant_id, question_id) do nothing;

  if found then
    update quiz_participants
    set score = score + v_points,
        correct_count = correct_count + (case when v_correct then 1 else 0 end),
        total_response_time_ms = total_response_time_ms + p_response_time_ms
    where id = v_participant_id;
  end if;

  return query select v_correct, v_correct_option, v_points, v_explanation;
end;
$function$;

-- submit_quiz_hotspot_answer: same rules
CREATE OR REPLACE FUNCTION public.submit_quiz_hotspot_answer(p_session_id uuid, p_question_id uuid, p_click_x numeric, p_click_y numeric, p_response_time_ms integer)
 RETURNS TABLE(is_correct boolean, target_x numeric, target_y numeric, target_radius numeric, points_awarded integer, explanation text, hotspot_zones jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_participant_id uuid;
  v_correct boolean := false;
  v_target_x numeric;
  v_target_y numeric;
  v_target_radius numeric;
  v_zones jsonb;
  v_marks int;
  v_max_timer int;
  v_points int := 0;
  v_phase text;
  v_company_id uuid;
  v_explanation text;
  v_started timestamptz;
  v_elapsed_ms int;
begin
  select id into v_participant_id from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase, company_id, question_started_at into v_phase, v_company_id, v_started from quiz_sessions where id = p_session_id;
  if v_phase <> 'question' then
    raise exception 'This question is no longer accepting answers.';
  end if;

  -- Only the question currently on screen for THIS participant can be answered
  -- (previously any question id was accepted and its answer key returned).
  if p_question_id is distinct from quiz_current_question_id(p_session_id, v_participant_id) then
    raise exception 'That question is not the current one.';
  end if;

  if not quiz_module_enabled_for_company(v_company_id) then
    raise exception 'Live Quiz is not enabled for this company.';
  end if;

  select qq.target_x, qq.target_y, coalesce(qq.target_radius, 6), qq.hotspot_zones, qq.marks,
    coalesce(qq.timer_seconds, qz.default_timer_seconds), qq.explanation
    into v_target_x, v_target_y, v_target_radius, v_zones, v_marks, v_max_timer, v_explanation
  from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id
  where qq.id = p_question_id;

  v_elapsed_ms := case when v_started is null then null
    else least(2000000000, (extract(epoch from (now() - v_started)) * 1000)::bigint)::int end;
  if v_elapsed_ms is not null and v_elapsed_ms > v_max_timer * 1000 + 3000 then
    raise exception 'Time is up for this question.';
  end if;
  p_response_time_ms := least(v_max_timer * 1000, greatest(coalesce(p_response_time_ms, 0), coalesce(v_elapsed_ms, 0) - 1500, 0));

  if p_click_x is not null and p_click_y is not null then
    if v_zones is not null and jsonb_typeof(v_zones) = 'array' and jsonb_array_length(v_zones) > 0 then
      v_correct := hotspot_zone_hit(v_zones, p_click_x, p_click_y);
    elsif v_target_x is not null and v_target_y is not null then
      v_correct := sqrt(power(p_click_x - v_target_x, 2) + power(p_click_y - v_target_y, 2)) <= v_target_radius;
    end if;
  end if;

  if v_correct then
    v_points := v_marks * 1000 + greatest(0, round((1 - (p_response_time_ms::numeric / (v_max_timer * 1000))) * 500))::int;
  end if;

  insert into quiz_answers (session_id, participant_id, question_id, click_x, click_y, is_correct, response_time_ms)
  values (p_session_id, v_participant_id, p_question_id, p_click_x, p_click_y, v_correct, p_response_time_ms)
  on conflict (participant_id, question_id) do nothing;

  if found then
    update quiz_participants
    set score = score + v_points,
        correct_count = correct_count + (case when v_correct then 1 else 0 end),
        total_response_time_ms = total_response_time_ms + p_response_time_ms
    where id = v_participant_id;
  end if;

  return query select v_correct, v_target_x, v_target_y, v_target_radius, v_points, v_explanation, v_zones;
end;
$function$;

