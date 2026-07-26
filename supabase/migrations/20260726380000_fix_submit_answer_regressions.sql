-- The 20260726370000 rewrite of submit_quiz_answer (adding
-- total_response_time_ms tracking + returning explanation) was based on the
-- ORIGINAL 20260726140000 function body, not the since-patched one — so it
-- silently reintroduced two already-fixed regressions:
--   1. "column reference is_correct is ambiguous" (20260726200000's fix —
--      the RETURNS TABLE's is_correct OUT column collides with
--      quiz_question_options.is_correct unless table-aliased), which made
--      every answer submission 400 and stuck the player's browser on
--      "Recording your answer...".
--   2. The quiz_module_enabled_for_company(v_company_id) feature-flag check
--      (also added in 20260726200000) was dropped entirely.
drop function if exists submit_quiz_answer(uuid, uuid, uuid, int);
create function submit_quiz_answer(
  p_session_id uuid, p_question_id uuid, p_option_id uuid, p_response_time_ms int
)
returns table (is_correct boolean, correct_option_id uuid, points_awarded int, explanation text)
language plpgsql
security definer
set search_path = public
as $$
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

  select qo.id into v_correct_option from quiz_question_options qo
  where qo.question_id = p_question_id and qo.is_correct = true limit 1;

  if p_option_id is not null and p_option_id = v_correct_option then
    v_correct := true;
  end if;

  select qq.marks, coalesce(qq.timer_seconds, qz.default_timer_seconds), qq.explanation
    into v_marks, v_max_timer, v_explanation
  from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id
  where qq.id = p_question_id;

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
$$;
