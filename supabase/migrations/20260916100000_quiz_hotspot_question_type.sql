-- Live Quiz: "Hotspot" question type — tap the correct spot on an image
-- (e.g. a location on a master plan / floor plan / map) instead of picking
-- from text options. Requested for real-estate/sales training tests where
-- the trainer currently marks these by hand on a printed map.
--
-- Design: ONE correct point per question (target_x/target_y as a percent
-- of the image's width/height, 0-100) plus a tolerance radius (also a
-- percent) — a tap within that radius counts as correct. Kept as plain
-- columns rather than a list of zones: every real use case here is "where
-- is X", which only ever has one right answer location.
--
-- quiz_question_options stays completely unused for hotspot questions
-- (no rows) — every place that reads it switches from an inner join to a
-- left join so a hotspot question (0 option rows) still returns exactly
-- one row instead of vanishing entirely.

alter table quiz_questions add column if not exists image_url text;
alter table quiz_questions add column if not exists target_x numeric;
alter table quiz_questions add column if not exists target_y numeric;
alter table quiz_questions add column if not exists target_radius numeric default 6;

alter table quiz_questions drop constraint if exists quiz_questions_type_check;
alter table quiz_questions add constraint quiz_questions_type_check
  check (type = any (array['mcq'::text, 'truefalse'::text, 'hotspot'::text]));

-- Where the participant actually tapped — null for mcq/truefalse answers,
-- exactly like selected_option_id is null for hotspot answers.
alter table quiz_answers add column if not exists click_x numeric;
alter table quiz_answers add column if not exists click_y numeric;

-- ── get_current_quiz_question: inner join -> left join + image_url ──────────
-- An inner join on quiz_question_options meant a hotspot question (which
-- has zero option rows) returned NO rows at all — the player would see
-- "Loading question…" forever, which is exactly the kind of silent hang
-- this app's pre-launch audit has been hunting down. Left join fixes it;
-- option_id/option_text/option_order simply come back null for a hotspot
-- question, which the client already needs to treat as "no options" for a
-- fresh question type anyway.
-- CREATE OR REPLACE can't change a function's return columns in Postgres —
-- this one is gaining image_url, so the old signature must be dropped first.
drop function if exists get_current_quiz_question(uuid);

create or replace function get_current_quiz_question(p_session_id uuid)
returns table(question_id uuid, question_text text, type text, timer_seconds integer, question_index integer, total_questions integer, option_id uuid, option_text text, option_order integer, image_url text)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_participant_id uuid;
  v_quiz_id uuid;
  v_company_id uuid;
  v_idx int;
  v_qid uuid;
  v_order uuid[];
  v_shuffle_options boolean;
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

  select shuffle_options into v_shuffle_options from quizzes where id = v_quiz_id;

  if v_order is not null and v_idx < array_length(v_order, 1) then
    v_qid := v_order[v_idx + 1]; -- postgres arrays are 1-indexed
  else
    select qq.id into v_qid from quiz_questions qq
    where qq.quiz_id = v_quiz_id and not qq.is_hidden order by qq.display_order limit 1 offset v_idx;
  end if;

  if v_qid is null then
    return;
  end if;

  return query
  select
    qq.id, qq.question_text, qq.type, coalesce(qq.timer_seconds, qz.default_timer_seconds),
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
$function$;

-- ── submit_quiz_hotspot_answer — the hotspot counterpart to submit_quiz_answer ──
-- Same shape/guards/scoring formula as submit_quiz_answer, just checking
-- distance-to-target instead of option-id equality. A brand new function
-- rather than overloading submit_quiz_answer — the parameter shapes are
-- genuinely different (click_x/click_y vs option_id), and this keeps the
-- existing, already-proven mcq/truefalse path completely untouched.
create or replace function submit_quiz_hotspot_answer(p_session_id uuid, p_question_id uuid, p_click_x numeric, p_click_y numeric, p_response_time_ms integer)
returns table(is_correct boolean, target_x numeric, target_y numeric, target_radius numeric, points_awarded integer, explanation text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_participant_id uuid;
  v_correct boolean := false;
  v_target_x numeric;
  v_target_y numeric;
  v_target_radius numeric;
  v_marks int;
  v_max_timer int;
  v_points int := 0;
  v_phase text;
  v_company_id uuid;
  v_explanation text;
  v_distance numeric;
begin
  select id into v_participant_id from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase, company_id into v_phase, v_company_id from quiz_sessions where id = p_session_id;
  if v_phase <> 'question' then
    raise exception 'This question is no longer accepting answers.';
  end if;

  if not quiz_module_enabled_for_company(v_company_id) then
    raise exception 'Live Quiz is not enabled for this company.';
  end if;

  select qq.target_x, qq.target_y, coalesce(qq.target_radius, 6), qq.marks,
    coalesce(qq.timer_seconds, qz.default_timer_seconds), qq.explanation
    into v_target_x, v_target_y, v_target_radius, v_marks, v_max_timer, v_explanation
  from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id
  where qq.id = p_question_id;

  if p_click_x is not null and p_click_y is not null and v_target_x is not null and v_target_y is not null then
    v_distance := sqrt(power(p_click_x - v_target_x, 2) + power(p_click_y - v_target_y, 2));
    if v_distance <= v_target_radius then
      v_correct := true;
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

  return query select v_correct, v_target_x, v_target_y, v_target_radius, v_points, v_explanation;
end;
$function$;

-- ── get_my_answer_review: inner join -> left join + hotspot columns ─────────
-- Same "hotspot has no option rows" fix as get_current_quiz_question above,
-- plus enough extra columns for a hotspot question to show the trainee
-- where they tapped vs. the actual correct spot (mcq/truefalse rows leave
-- all the new columns null, same convention as everywhere else here).
-- Same reason as get_current_quiz_question above — gaining several new
-- return columns, which CREATE OR REPLACE cannot do in place.
drop function if exists get_my_answer_review(uuid);

create or replace function get_my_answer_review(p_session_id uuid)
returns table(question_index integer, question_text text, explanation text, type text, option_id uuid, option_text text, is_correct boolean, was_chosen boolean, image_url text, target_x numeric, target_y numeric, target_radius numeric, click_x numeric, click_y numeric, hotspot_is_correct boolean)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_participant_id uuid;
  v_phase text;
  v_quiz_id uuid;
begin
  select qp.id into v_participant_id from quiz_participants qp
  where qp.session_id = p_session_id and qp.auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase, quiz_id into v_phase, v_quiz_id from quiz_sessions where id = p_session_id;
  if v_phase <> 'ended' then
    raise exception 'Review is only available after the quiz ends.';
  end if;

  return query
  select qq.display_order, qq.question_text, qq.explanation, qq.type,
    qo.id, qo.option_text, qo.is_correct,
    (qa.selected_option_id = qo.id),
    qq.image_url, qq.target_x, qq.target_y, qq.target_radius,
    qa.click_x, qa.click_y, qa.is_correct
  from quiz_questions qq
  left join quiz_question_options qo on qo.question_id = qq.id
  left join quiz_answers qa on qa.question_id = qq.id and qa.participant_id = v_participant_id
  where qq.quiz_id = v_quiz_id and not qq.is_hidden
  order by qq.display_order, qo.display_order;
end;
$function$;
