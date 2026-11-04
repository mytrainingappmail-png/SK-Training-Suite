-- Live Quiz: a question that is SKIPPED (the timer ran out, nothing chosen / tapped) no longer shows the right answer.
-- Before, the answer sent back for a skip still carried the correct option, the correct spot and the explanation, so a trainee who
-- skipped saw the answer highlighted - and a modified browser could "skip" early just to read the answer key.
-- A skip is still recorded as an empty, not-correct answer worth 0 marks (there is no negative marking), exactly as before.
-- The right answers stay in the end-of-quiz review. Nothing else changes: the answered case and the hidden-answers case are as they were.

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
  v_eff_idx int;
  v_elapsed_ms int;
  v_reveal boolean;
begin
  select id into v_participant_id from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase, company_id, question_started_at, reveal_answers into v_phase, v_company_id, v_started, v_reveal from quiz_sessions where id = p_session_id;
  -- the question and start time that apply to THIS player (the host's, unless they moved ahead)
  select e.idx, e.started_at into v_eff_idx, v_started from quiz_effective_position(p_session_id, v_participant_id) e;
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

  select qq.marks, coalesce((select q2.timer_seconds from quiz_questions q2 join quiz_sessions s2 on s2.id = p_session_id where q2.id = s2.question_order[v_eff_idx + 1]), qq.timer_seconds, qz.default_timer_seconds), qq.explanation
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

  -- With answers hidden the browser is told nothing about right or wrong (no flag, no answer key, no points, no explanation).
  -- A skip (nothing chosen) is told "not correct, 0 points" and never the answer key or the explanation.
  return query select
    case when v_reveal then v_correct end,
    case when v_reveal and p_option_id is not null then v_correct_option end,
    case when v_reveal then v_points else 0 end,
    case when v_reveal and p_option_id is not null then v_explanation end;
end;
$function$;

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
  v_eff_idx int;
  v_elapsed_ms int;
  v_reveal boolean;
  v_tapped boolean;
begin
  select id into v_participant_id from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase, company_id, question_started_at, reveal_answers into v_phase, v_company_id, v_started, v_reveal from quiz_sessions where id = p_session_id;
  -- the question and start time that apply to THIS player (the host's, unless they moved ahead)
  select e.idx, e.started_at into v_eff_idx, v_started from quiz_effective_position(p_session_id, v_participant_id) e;
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
    coalesce((select q2.timer_seconds from quiz_questions q2 join quiz_sessions s2 on s2.id = p_session_id where q2.id = s2.question_order[v_eff_idx + 1]), qq.timer_seconds, qz.default_timer_seconds), qq.explanation
    into v_target_x, v_target_y, v_target_radius, v_zones, v_marks, v_max_timer, v_explanation
  from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id
  where qq.id = p_question_id;

  v_elapsed_ms := case when v_started is null then null
    else least(2000000000, (extract(epoch from (now() - v_started)) * 1000)::bigint)::int end;
  if v_elapsed_ms is not null and v_elapsed_ms > v_max_timer * 1000 + 3000 then
    raise exception 'Time is up for this question.';
  end if;
  p_response_time_ms := least(v_max_timer * 1000, greatest(coalesce(p_response_time_ms, 0), coalesce(v_elapsed_ms, 0) - 1500, 0));

  v_tapped := p_click_x is not null and p_click_y is not null;
  if v_tapped then
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

  -- With answers hidden nothing about the correct spot leaves the database; a skip (no tap) never gets it either.
  return query select
    case when v_reveal then v_correct end,
    case when v_reveal and v_tapped then v_target_x end,
    case when v_reveal and v_tapped then v_target_y end,
    case when v_reveal and v_tapped then v_target_radius end,
    case when v_reveal then v_points else 0 end,
    case when v_reveal and v_tapped then v_explanation end,
    case when v_reveal and v_tapped then v_zones end;
end;
$function$;
