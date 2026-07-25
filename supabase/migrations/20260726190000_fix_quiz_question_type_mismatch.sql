-- get_current_quiz_question declared total_questions as int, but
-- count(*) returns bigint — PostgREST surfaced this as "structure of
-- query does not match function result type" on every call, so no
-- participant could ever load a question. Cast the count to int.
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
  v_is_participant boolean;
  v_quiz_id uuid;
  v_idx int;
  v_qid uuid;
begin
  select exists(
    select 1 from quiz_participants where session_id = p_session_id and auth_user_id = auth.uid()
  ) into v_is_participant;
  if not v_is_participant then
    raise exception 'Not a participant in this session.';
  end if;

  select quiz_id, current_question_index into v_quiz_id, v_idx
  from quiz_sessions where id = p_session_id and phase = 'question';
  if v_quiz_id is null then
    return;
  end if;

  select qq.id into v_qid from quiz_questions qq
  where qq.quiz_id = v_quiz_id order by qq.display_order limit 1 offset v_idx;
  if v_qid is null then
    return;
  end if;

  return query
  select
    qq.id, qq.question_text, qq.type, coalesce(qq.timer_seconds, qz.default_timer_seconds),
    v_idx, (select count(*) from quiz_questions where quiz_id = v_quiz_id)::int,
    qo.id, qo.option_text, qo.display_order
  from quiz_questions qq
  join quizzes qz on qz.id = qq.quiz_id
  join quiz_question_options qo on qo.question_id = qq.id
  where qq.id = v_qid
  order by qo.display_order;
end;
$$;
