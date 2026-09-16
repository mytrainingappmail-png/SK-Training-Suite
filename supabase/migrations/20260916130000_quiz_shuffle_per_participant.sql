-- Anti-cheat: today's "Shuffle questions" produces ONE order for the
-- whole session — every participant (and the host) sees the identical
-- sequence, just possibly not in display_order. This adds a genuinely
-- per-participant order: each participant gets their own deterministic
-- shuffle of the same question set, so participant A's "Question 3" is a
-- different actual question than participant B's "Question 3" — makes
-- looking at a neighbor's screen useless. Independent of shuffle_questions
-- (session_order still gets generated and can still be used for the host's
-- own reference/other tooling); this only changes what get_current_quiz_question
-- resolves for a given participant + index.
alter table quizzes add column if not exists shuffle_questions_per_participant boolean not null default false;

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
