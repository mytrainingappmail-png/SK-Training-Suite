-- Live Quiz reliability.
--
-- A review of real sessions (answers per player per question) showed whole-class
-- "skipped" questions — every player has no answer and the gap between their
-- neighbouring answers is ~16 s instead of ~32 s — in EVERY session, a few per
-- 130 questions, from before any recent change. Cause: advancing a question was
-- not idempotent. The host's page advances after its reveal pause; a player's
-- "safety net" heartbeat advances as soon as the timer ends. If the host's page
-- hears about the heartbeat's advance late, its own pending advance then moves
-- the session ONE FURTHER, and a question is never shown.
--
-- Fixes (all server side, so every device benefits at once):
--  1. advance_quiz_session(p_session_id, p_from_index): advance only if the
--     session is still on the question the caller is showing. The row is locked
--     while deciding, an ended session never restarts, and a call without
--     p_from_index behaves as before.
--  2. The heartbeat safety net waits timer + 6 s (the host normally advances at
--     timer + ~2.5 s, so the net only acts when the host is really gone), and is
--     idempotent on the question it saw.
--  3. Presence (last_seen_at) is written at most every 8 s instead of on every
--     heartbeat. Every write is broadcast to every subscribed screen, so the
--     traffic used to grow with the square of the class size.
--  4. Per-player question order: every player must get the same time window for
--     "their" question (the window the host's clock runs on), otherwise a player
--     whose question has a 20 s timer was cut at 15 s. get_current_quiz_question
--     and the answer RPCs now use that single window.

-- ── 1. Idempotent advance ──────────────────────────────────────────────────
drop function if exists advance_quiz_session(uuid);

create or replace function advance_quiz_session(p_session_id uuid, p_from_index integer default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_idx int;
  v_order uuid[];
  v_phase text;
  v_total int;
begin
  select current_question_index, question_order, phase
    into v_idx, v_order, v_phase
  from quiz_sessions
  where id = p_session_id
    and company_id = current_quiz_admin_company_id()
    and current_quiz_admin_can_edit()
  for update;

  if not found then
    raise exception 'Session not found or not authorized.';
  end if;

  -- Already finished, or somebody else (the safety net, a double click) already
  -- moved past the question the caller is showing: report the truth, change nothing.
  if v_phase = 'ended' then return v_phase; end if;
  if p_from_index is not null and p_from_index <> v_idx then return v_phase; end if;

  v_total := coalesce(array_length(v_order, 1), 0);

  if v_idx + 1 >= v_total then
    update quiz_sessions set phase = 'ended', ended_at = now() where id = p_session_id;
    return 'ended';
  end if;

  update quiz_sessions
  set phase = 'question', current_question_index = v_idx + 1, question_started_at = now(), paused_at = null
  where id = p_session_id;
  return 'question';
end;
$$;
revoke all on function advance_quiz_session(uuid, integer) from public, anon;
grant execute on function advance_quiz_session(uuid, integer) to authenticated;

-- ── 2 + 3. Safety-net heartbeat ─────────────────────────────────────────────
create or replace function quiz_participant_heartbeat(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
  v_phase text;
  v_idx int;
  v_order uuid[];
  v_started_at timestamptz;
  v_current_qid uuid;
  v_timer_seconds int;
  v_default_timer int;
  v_total int;
begin
  select id into v_participant_id
  from quiz_participants where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    return; -- not a participant of this session — silently a no-op, never an error the UI has to handle
  end if;

  -- Presence is only recorded every few seconds: each write is pushed to every
  -- screen that is watching the session.
  update quiz_participants set last_seen_at = now()
  where id = v_participant_id and (last_seen_at is null or last_seen_at < now() - interval '8 seconds');

  select qs.phase, qs.current_question_index, qs.question_order, qs.question_started_at, qz.default_timer_seconds
    into v_phase, v_idx, v_order, v_started_at, v_default_timer
  from quiz_sessions qs
  join quizzes qz on qz.id = qs.quiz_id
  where qs.id = p_session_id;

  if v_phase is distinct from 'question' or v_started_at is null or v_order is null then
    return;
  end if;

  v_total := coalesce(array_length(v_order, 1), 0);
  v_current_qid := v_order[v_idx + 1];
  select coalesce(timer_seconds, v_default_timer, 30) into v_timer_seconds
  from quiz_questions where id = v_current_qid;
  v_timer_seconds := coalesce(v_timer_seconds, v_default_timer, 30);

  -- Only a safety net: the host's own screen advances at about timer + 2.5 s
  -- (after showing the answer). Act only when the host clearly isn't doing it.
  if v_started_at + make_interval(secs => v_timer_seconds + 6) > now() then
    return;
  end if;

  if v_idx + 1 >= v_total then
    update quiz_sessions
    set phase = 'ended', ended_at = now()
    where id = p_session_id and phase = 'question' and question_started_at = v_started_at;
  else
    update quiz_sessions
    set current_question_index = current_question_index + 1,
        question_started_at = now()
    where id = p_session_id and phase = 'question' and question_started_at = v_started_at;
  end if;
end;
$$;

-- ── 4. One time window per question slot ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_current_quiz_question(p_session_id uuid)
 RETURNS TABLE(question_id uuid, question_text text, type text, timer_seconds integer, question_index integer, total_questions integer, option_id uuid, option_text text, option_order integer, image_url text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_participant_id uuid;
  v_quiz_id uuid;
  v_company_id uuid;
  v_idx int;
  v_qid uuid;
  v_order uuid[];
  v_shuffle_options boolean;
  v_shuffle_per_participant boolean;
begin
  select id into v_participant_id
  from quiz_participants where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select quiz_id, company_id, current_question_index, question_order
    into v_quiz_id, v_company_id, v_idx, v_order
  from quiz_sessions where id = p_session_id and phase = 'question';
  if v_quiz_id is null then
    return;
  end if;

  if not quiz_module_enabled_for_company(v_company_id) then
    raise exception 'Live Quiz is not enabled for this company.';
  end if;

  select shuffle_options, coalesce(shuffle_questions_per_participant, false)
    into v_shuffle_options, v_shuffle_per_participant
  from quizzes where id = v_quiz_id;

  if v_shuffle_per_participant then
    -- Same technique already used for per-participant option shuffling —
    -- a stable hash of (question id, participant id) as the sort key gives
    -- each participant their own consistent-across-refreshes but
    -- different-from-everyone-else ordering of the same question set.
    select qq.id into v_qid from quiz_questions qq
    where qq.quiz_id = v_quiz_id and not qq.is_hidden
    order by md5(qq.id::text || v_participant_id::text)
    offset v_idx limit 1;
  elsif v_order is not null and v_idx < array_length(v_order, 1) then
    v_qid := v_order[v_idx + 1]; -- postgres arrays are 1-indexed
  else
    -- Defensive fallback only — the client always builds question_order
    -- pre-filtered to visible questions at launch, so this path is not
    -- expected to run in practice, but stays consistent if it ever does.
    select qq.id into v_qid from quiz_questions qq
    where qq.quiz_id = v_quiz_id and not qq.is_hidden order by qq.display_order limit 1 offset v_idx;
  end if;

  if v_qid is null then
    return;
  end if;

  return query
  select
    qq.id, qq.question_text, qq.type, coalesce((select q2.timer_seconds from quiz_questions q2 where q2.id = v_order[v_idx + 1]), qq.timer_seconds, qz.default_timer_seconds),
    v_idx, coalesce(array_length(v_order, 1), (select count(*) from quiz_questions where quiz_id = v_quiz_id and not is_hidden)::int),
    qo.id, qo.option_text,
    (case when v_shuffle_options
      then row_number() over (order by md5(qo.id::text || v_participant_id::text))
      else row_number() over (order by qo.display_order)
    end)::int as option_order,
    qq.image_url
  from quiz_questions qq
  join quizzes qz on qz.id = qq.quiz_id
  left join quiz_question_options qo on qo.question_id = qq.id
  where qq.id = v_qid
  order by option_order;
end;
$function$;;

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

  select qq.marks, coalesce((select q2.timer_seconds from quiz_questions q2 join quiz_sessions s2 on s2.id = p_session_id where q2.id = s2.question_order[s2.current_question_index + 1]), qq.timer_seconds, qz.default_timer_seconds), qq.explanation
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
$function$;;

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
    coalesce((select q2.timer_seconds from quiz_questions q2 join quiz_sessions s2 on s2.id = p_session_id where q2.id = s2.question_order[s2.current_question_index + 1]), qq.timer_seconds, qz.default_timer_seconds), qq.explanation
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
$function$;;

