-- get_current_quiz_question reported "total_questions" as a fresh count of
-- every currently-visible question in the QUIZ, not the length of this
-- SESSION's own question_order (frozen at launch). They're normally the
-- same number, which is why this stayed invisible — but the function
-- already reads v_order into scope for picking the current question, so
-- just use its actual length instead of a second, independent count.
-- (Caught while testing the new session-resilience heartbeat against a
-- session whose question_order was deliberately shorter than the quiz's
-- full visible-question count — the same "total" mismatch that broke the
-- host screen's own end-of-quiz detection, here on the participant side.)

drop function if exists get_current_quiz_question(uuid);
create function get_current_quiz_question(p_session_id uuid)
returns table (
  question_id uuid, question_text text, type text, timer_seconds int,
  question_index int, total_questions int,
  option_id uuid, option_text text, option_order int
)
language plpgsql
stable
security definer
set search_path = public
as $$
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
    qq.id, qq.question_text, qq.type, coalesce(qq.timer_seconds, qz.default_timer_seconds),
    v_idx, coalesce(array_length(v_order, 1), (select count(*) from quiz_questions where quiz_id = v_quiz_id and not is_hidden)::int),
    qo.id, qo.option_text,
    (case when v_shuffle_options
      then row_number() over (order by md5(qo.id::text || v_participant_id::text))
      else row_number() over (order by qo.display_order)
    end)::int as option_order
  from quiz_questions qq
  join quizzes qz on qz.id = qq.quiz_id
  join quiz_question_options qo on qo.question_id = qq.id
  where qq.id = v_qid
  order by option_order;
end;
$$;
