-- get_current_quiz_question was missing the same quiz_module_enabled_for_company()
-- guard its three sibling RPCs already have (find_quiz_session_by_pin,
-- join_quiz_session, submit_quiz_answer) — a company with Live Quiz disabled
-- could still have an already-joined participant read live question/option
-- text through this one function. Restoring the guard here, identical
-- signature so no drop needed.

create or replace function get_current_quiz_question(p_session_id uuid)
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
    select qq.id into v_qid from quiz_questions qq
    where qq.quiz_id = v_quiz_id order by qq.display_order limit 1 offset v_idx;
  end if;

  if v_qid is null then
    return;
  end if;

  return query
  select
    qq.id, qq.question_text, qq.type, coalesce(qq.timer_seconds, qz.default_timer_seconds),
    v_idx, (select count(*) from quiz_questions where quiz_id = v_quiz_id)::int,
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
