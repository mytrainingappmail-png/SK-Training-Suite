-- ============================================================================
-- LIVE QUIZ MODULE — feature-flag enforcement at the data layer.
--
-- The Phase 1 migration added companies.live_quiz_enabled but nothing yet
-- actually checked it below the UI. Per spec: "If disabled: APIs should
-- not execute." This migration makes that true at the single choke point
-- every admin-side RLS policy already depends on
-- (current_quiz_admin_company_id()), plus the participant-facing RPCs,
-- so turning the flag off fails every quiz_* query/RPC closed immediately
-- — not just hides a menu item.
-- ============================================================================

create or replace function quiz_module_enabled_for_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select live_quiz_enabled from companies where id = p_company_id), false);
$$;

-- Every admin-side RLS policy in the Phase 1 migration is written as
-- "company_id = current_quiz_admin_company_id()" — redefining this one
-- function to also require the flag makes ALL of them fail closed the
-- instant a company's Live Quiz access is turned off, with zero policy
-- changes needed anywhere else.
create or replace function current_quiz_admin_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select qa.company_id
  from quiz_admins qa
  join companies c on c.id = qa.company_id
  where qa.auth_user_id = auth.uid() and qa.status = 'active' and c.live_quiz_enabled = true
  limit 1;
$$;

-- Lets a logged-in quiz admin's OWN client tell "disabled" apart from
-- "not logged in", independent of the flag-gated function above.
create or replace function get_my_quiz_company_flag()
returns table (company_id uuid, live_quiz_enabled boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.live_quiz_enabled
  from quiz_admins qa
  join companies c on c.id = qa.company_id
  where qa.auth_user_id = auth.uid() and qa.status = 'active'
  limit 1;
$$;

-- Pre-login lookup for the quiz-admin login screen (company code -> id +
-- active + flag), mirroring get_company_for_login but scoped to what the
-- quiz login page needs, without depending on that unrelated RPC's schema.
create or replace function get_company_for_quiz_login(p_company_code text)
returns table (id uuid, active boolean, live_quiz_enabled boolean)
language sql
stable
security definer
set search_path = public
as $$
  select id, active, live_quiz_enabled from companies where lower(company_code) = lower(p_company_code);
$$;

-- Participant-facing RPCs: add the same flag check so a public PIN-joiner
-- can't use a stale link to keep playing after the company's access is
-- switched off mid-session.
create or replace function find_quiz_session_by_pin(p_pin text)
returns table (session_id uuid, quiz_title text, phase text, join_mode text, company_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select qs.id, qz.title, qs.phase, qs.join_mode, qs.company_id
  from quiz_sessions qs
  join quizzes qz on qz.id = qs.quiz_id
  where qs.pin = p_pin and qs.phase <> 'ended' and quiz_module_enabled_for_company(qs.company_id);
$$;

create or replace function join_quiz_session(p_session_id uuid, p_display_name text)
returns table (participant_id uuid, score int, correct_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_join_mode text;
  v_company_id uuid;
  v_roster_ok boolean;
  v_existing uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to join a quiz.';
  end if;

  select join_mode, company_id into v_join_mode, v_company_id
  from quiz_sessions where id = p_session_id and phase <> 'ended';

  if v_company_id is null then
    raise exception 'This quiz session is no longer available.';
  end if;

  if not quiz_module_enabled_for_company(v_company_id) then
    raise exception 'Live Quiz is not enabled for this company.';
  end if;

  if v_join_mode = 'strict' then
    select exists(
      select 1 from quiz_roster
      where company_id = v_company_id and active = true
        and (lower(name) = lower(trim(p_display_name)) or lower(employee_code) = lower(trim(p_display_name)))
    ) into v_roster_ok;
    if not v_roster_ok then
      raise exception 'You are not on the registered trainee list for this quiz.';
    end if;
  end if;

  select id into v_existing from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();

  if v_existing is null then
    insert into quiz_participants (session_id, auth_user_id, display_name)
    values (p_session_id, auth.uid(), trim(p_display_name))
    returning id into v_existing;
  end if;

  return query select qp.id, qp.score, qp.correct_count from quiz_participants qp where qp.id = v_existing;
end;
$$;

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
  v_company_id uuid;
begin
  select exists(
    select 1 from quiz_participants where session_id = p_session_id and auth_user_id = auth.uid()
  ) into v_is_participant;
  if not v_is_participant then
    raise exception 'Not a participant in this session.';
  end if;

  select quiz_id, current_question_index, company_id into v_quiz_id, v_idx, v_company_id
  from quiz_sessions where id = p_session_id and phase = 'question';
  if v_quiz_id is null then
    return;
  end if;

  if not quiz_module_enabled_for_company(v_company_id) then
    raise exception 'Live Quiz is not enabled for this company.';
  end if;

  select qq.id into v_qid from quiz_questions qq
  where qq.quiz_id = v_quiz_id order by qq.display_order limit 1 offset v_idx;
  if v_qid is null then
    return;
  end if;

  return query
  select
    qq.id, qq.question_text, qq.type, coalesce(qq.timer_seconds, qz.default_timer_seconds),
    v_idx, (select count(*) from quiz_questions where quiz_id = v_quiz_id),
    qo.id, qo.option_text, qo.display_order
  from quiz_questions qq
  join quizzes qz on qz.id = qq.quiz_id
  join quiz_question_options qo on qo.question_id = qq.id
  where qq.id = v_qid
  order by qo.display_order;
end;
$$;

create or replace function submit_quiz_answer(
  p_session_id uuid, p_question_id uuid, p_option_id uuid, p_response_time_ms int
)
returns table (is_correct boolean, correct_option_id uuid, points_awarded int)
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

  select id into v_correct_option from quiz_question_options
  where question_id = p_question_id and is_correct = true limit 1;

  if p_option_id is not null and p_option_id = v_correct_option then
    v_correct := true;
  end if;

  select qq.marks, coalesce(qq.timer_seconds, qz.default_timer_seconds)
    into v_marks, v_max_timer
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
    set score = score + v_points, correct_count = correct_count + (case when v_correct then 1 else 0 end)
    where id = v_participant_id;
  end if;

  return query select v_correct, v_correct_option, v_points;
end;
$$;
