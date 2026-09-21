-- Survey timing, fully admin-controlled instead of hardcoded:
--   * an optional time limit PER QUESTION
--   * the live session's overall duration is any value (presets are just
--     admin-editable shortcuts, stored in survey_settings)
--   * a START timer: open now, in X minutes, or at a set date-time
--     (until then joiners wait in a lobby; the duration clock only starts
--     when the survey actually opens)
-- Every timestamp is stamped by the DATABASE clock inside an RPC, never by
-- a browser (a phone/laptop clock that is wrong would otherwise shift
-- everyone's deadline — the same class of bug fixed in Live Quiz).

alter table survey_questions add column if not exists time_limit_seconds int;
alter table survey_questions drop constraint if exists survey_questions_time_limit_check;
alter table survey_questions add constraint survey_questions_time_limit_check
  check (time_limit_seconds is null or time_limit_seconds between 5 and 3600);

alter table survey_settings add column if not exists duration_presets int[] not null default '{2,5,10,15,30}';
alter table survey_settings add column if not exists default_duration_minutes int default 5;

alter table survey_sessions add column if not exists opens_at timestamptz;
update survey_sessions set opens_at = started_at where opens_at is null;
alter table survey_sessions alter column opens_at set default now();
alter table survey_sessions alter column opens_at set not null;

-- ── Host side ────────────────────────────────────────────────────────────

create or replace function create_survey_session(
  p_survey_id uuid,
  p_time_limit_seconds int default null,
  p_start_in_seconds int default null,
  p_start_at timestamptz default null
)
returns setof survey_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_pin text;
  v_opens timestamptz;
  v_limit int;
  v_row survey_sessions;
  i int;
begin
  select company_id into v_company from surveys where id = p_survey_id;
  if v_company is null or v_company <> current_quiz_admin_company_id() or not current_quiz_admin_can_edit() then
    raise exception 'Survey not found or not authorized.';
  end if;

  v_limit := nullif(p_time_limit_seconds, 0);
  if v_limit is not null and (v_limit < 10 or v_limit > 86400) then
    raise exception 'Time limit must be between 10 seconds and 24 hours.';
  end if;

  v_opens := case
    when p_start_at is not null then greatest(p_start_at, now())
    when p_start_in_seconds is not null and p_start_in_seconds > 0 then now() + make_interval(secs => p_start_in_seconds)
    else now()
  end;
  if v_opens > now() + interval '30 days' then
    raise exception 'Start time is too far ahead.';
  end if;

  for i in 1 .. 8 loop
    v_pin := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
    begin
      insert into survey_sessions (survey_id, company_id, host_admin_id, pin, time_limit_seconds, opens_at, expires_at)
      values (
        p_survey_id, v_company,
        (select qa.id from quiz_admins qa where qa.auth_user_id = auth.uid() limit 1),
        v_pin, v_limit, v_opens,
        case when v_limit is null then null else v_opens + make_interval(secs => v_limit) end
      )
      returning * into v_row;
      return next v_row;
      return;
    exception when unique_violation then
      null; -- another active session already holds this PIN — try another
    end;
  end loop;

  raise exception 'Could not allocate a unique PIN. Please try again.';
end;
$$;

create or replace function start_survey_session_now(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update survey_sessions
  set opens_at = now(),
      expires_at = case when time_limit_seconds is null then null else now() + make_interval(secs => time_limit_seconds) end
  where id = p_session_id and status = 'active' and opens_at > now()
    and company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit();
  if not found then
    raise exception 'Session not found, already started, or not authorized.';
  end if;
end;
$$;

create or replace function extend_survey_session(p_session_id uuid, p_add_seconds int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_add_seconds is null or p_add_seconds < 1 or p_add_seconds > 86400 then
    raise exception 'Extension must be between 1 second and 24 hours.';
  end if;
  update survey_sessions
  set expires_at = expires_at + make_interval(secs => p_add_seconds),
      time_limit_seconds = coalesce(time_limit_seconds, 0) + p_add_seconds
  where id = p_session_id and status = 'active' and expires_at is not null
    and company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit();
  if not found then
    raise exception 'Session not found, has no time limit, or not authorized.';
  end if;
end;
$$;

grant execute on function create_survey_session(uuid, int, int, timestamptz) to authenticated;
grant execute on function start_survey_session_now(uuid) to authenticated;
grant execute on function extend_survey_session(uuid, int) to authenticated;

-- ── Respondent side ──────────────────────────────────────────────────────
-- join_survey_session / get_survey_session_questions always return at least
-- one row (participant + timing). Question columns are null until the
-- survey has actually opened — so a lobby wait never leaks the questions
-- early and the client can tell "not open yet" from "no questions".

drop function if exists join_survey_session(text, text);
create function join_survey_session(p_pin text, p_display_name text)
returns table (
  participant_id uuid, survey_id uuid, title text, description text,
  opens_at timestamptz, expires_at timestamptz, server_now timestamptz,
  question_id uuid, question_text text, type text, required boolean, scale_min int, scale_max int,
  time_limit_seconds int, question_order int,
  option_id uuid, option_text text, option_order int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_participant_id uuid;
begin
  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'Please enter your name to join.';
  end if;

  select ss.id, ss.survey_id, ss.opens_at, ss.expires_at into v_session
  from survey_sessions ss where ss.pin = p_pin and ss.status = 'active';
  if v_session.id is null then
    raise exception 'That PIN is not active. Ask the host for the current one.';
  end if;
  if v_session.expires_at is not null and v_session.expires_at <= now() then
    raise exception 'This session''s time is up.';
  end if;

  insert into survey_session_participants (session_id, display_name)
  values (v_session.id, trim(p_display_name)) returning id into v_participant_id;

  return query
  select v_participant_id, sv.id, sv.title, sv.description,
    v_session.opens_at, v_session.expires_at, now(),
    q.id, q.question_text, q.type, q.required, q.scale_min, q.scale_max,
    q.time_limit_seconds, q.display_order,
    o.id, o.option_text, o.display_order
  from surveys sv
  left join survey_questions q on q.survey_id = sv.id and v_session.opens_at <= now()
  left join survey_question_options o on o.question_id = q.id
  where sv.id = v_session.survey_id
  order by q.display_order, o.display_order;
end;
$$;

create function get_survey_session_questions(p_participant_id uuid)
returns table (
  participant_id uuid, survey_id uuid, title text, description text,
  opens_at timestamptz, expires_at timestamptz, server_now timestamptz,
  question_id uuid, question_text text, type text, required boolean, scale_min int, scale_max int,
  time_limit_seconds int, question_order int,
  option_id uuid, option_text text, option_order int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session record;
begin
  select ss.id, ss.survey_id, ss.opens_at, ss.expires_at into v_session
  from survey_session_participants p join survey_sessions ss on ss.id = p.session_id
  where p.id = p_participant_id and ss.status = 'active';
  if v_session.id is null then
    raise exception 'This session is no longer active.';
  end if;

  return query
  select p_participant_id, sv.id, sv.title, sv.description,
    v_session.opens_at, v_session.expires_at, now(),
    q.id, q.question_text, q.type, q.required, q.scale_min, q.scale_max,
    q.time_limit_seconds, q.display_order,
    o.id, o.option_text, o.display_order
  from surveys sv
  left join survey_questions q on q.survey_id = sv.id and v_session.opens_at <= now()
  left join survey_question_options o on o.question_id = q.id
  where sv.id = v_session.survey_id
  order by q.display_order, o.display_order;
end;
$$;

grant execute on function join_survey_session(text, text) to anon, authenticated;
grant execute on function get_survey_session_questions(uuid) to anon, authenticated;

-- Async (link) mode also needs each question's time limit.
drop function if exists get_survey_by_code(text);
create function get_survey_by_code(p_access_code text)
returns table (
  survey_id uuid, title text, description text,
  question_id uuid, question_text text, type text, required boolean, scale_min int, scale_max int,
  time_limit_seconds int, question_order int,
  option_id uuid, option_text text, option_order int
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.title, s.description,
    q.id, q.question_text, q.type, q.required, q.scale_min, q.scale_max,
    q.time_limit_seconds, q.display_order,
    o.id, o.option_text, o.display_order
  from surveys s
  join survey_questions q on q.survey_id = s.id
  left join survey_question_options o on o.question_id = q.id
  where s.access_code = lower(p_access_code) and s.status = 'published' and (s.closes_at is null or s.closes_at > now())
  order by q.display_order, o.display_order;
$$;

grant execute on function get_survey_by_code(text) to anon, authenticated;

-- ── Submit: a question that has its own timer can legitimately time out
-- unanswered, and a session whose clock has run out submits whatever is
-- filled in — neither should be blocked by "required". Everything else is
-- unchanged. ──────────────────────────────────────────────────────────────

create or replace function submit_survey_session_response(p_participant_id uuid, p_answers jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey_id uuid;
  v_company_id uuid;
  v_already_submitted timestamptz;
  v_opens timestamptz;
  v_expires timestamptz;
  v_timed_out boolean;
  v_response_id uuid;
  v_question record;
  v_answer jsonb;
begin
  select s.survey_id, sv.company_id, p.submitted_at, s.opens_at, s.expires_at
    into v_survey_id, v_company_id, v_already_submitted, v_opens, v_expires
  from survey_session_participants p
  join survey_sessions s on s.id = p.session_id
  join surveys sv on sv.id = s.survey_id
  where p.id = p_participant_id and s.status = 'active';

  if v_survey_id is null then
    raise exception 'This session is no longer active.';
  end if;
  if v_already_submitted is not null then
    raise exception 'You have already submitted your response.';
  end if;
  if v_opens > now() then
    raise exception 'This survey has not started yet.';
  end if;
  if v_expires is not null and now() > v_expires + interval '20 seconds' then
    raise exception 'This session''s time is up.';
  end if;

  v_timed_out := v_expires is not null and now() >= v_expires - interval '3 seconds';

  for v_question in select id, type, required, time_limit_seconds from survey_questions where survey_id = v_survey_id loop
    v_answer := (select a.value from jsonb_array_elements(p_answers) a where (a.value->>'question_id')::uuid = v_question.id limit 1);
    if v_question.required and not v_timed_out and v_question.time_limit_seconds is null and (
      v_answer is null
      or (v_question.type in ('single_choice', 'multi_choice') and coalesce(jsonb_array_length(v_answer->'selected_option_ids'), 0) = 0)
      or (v_question.type = 'scale' and v_answer->>'scale_value' is null)
      or (v_question.type = 'open_text' and coalesce(trim(v_answer->>'text_value'), '') = '')
    ) then
      raise exception 'Please answer every required question.';
    end if;
  end loop;

  insert into survey_responses (survey_id, company_id, session_participant_id) values (v_survey_id, v_company_id, p_participant_id) returning id into v_response_id;

  for v_answer in select * from jsonb_array_elements(p_answers) loop
    insert into survey_answers (response_id, question_id, selected_option_ids, scale_value, text_value)
    values (
      v_response_id,
      (v_answer->>'question_id')::uuid,
      case when v_answer ? 'selected_option_ids' then (select array_agg((x)::uuid) from jsonb_array_elements_text(v_answer->'selected_option_ids') x) else null end,
      nullif(v_answer->>'scale_value', '')::int,
      nullif(trim(v_answer->>'text_value'), '')
    );
  end loop;

  update survey_session_participants set submitted_at = now() where id = p_participant_id;

  return v_response_id;
end;
$$;

grant execute on function submit_survey_session_response(uuid, jsonb) to anon, authenticated;

create or replace function submit_survey_response(p_access_code text, p_answers jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_survey_id uuid;
  v_company_id uuid;
  v_response_id uuid;
  v_question record;
  v_answer jsonb;
begin
  select id, company_id into v_survey_id, v_company_id
  from surveys
  where access_code = lower(p_access_code) and status = 'published' and (closes_at is null or closes_at > now());

  if v_survey_id is null then
    raise exception 'This survey is not available.';
  end if;

  for v_question in select id, type, required, time_limit_seconds from survey_questions where survey_id = v_survey_id loop
    v_answer := (select a.value from jsonb_array_elements(p_answers) a where (a.value->>'question_id')::uuid = v_question.id limit 1);
    if v_question.required and v_question.time_limit_seconds is null and (
      v_answer is null
      or (v_question.type in ('single_choice', 'multi_choice') and coalesce(jsonb_array_length(v_answer->'selected_option_ids'), 0) = 0)
      or (v_question.type = 'scale' and v_answer->>'scale_value' is null)
      or (v_question.type = 'open_text' and coalesce(trim(v_answer->>'text_value'), '') = '')
    ) then
      raise exception 'Please answer every required question.';
    end if;
  end loop;

  insert into survey_responses (survey_id, company_id) values (v_survey_id, v_company_id) returning id into v_response_id;

  for v_answer in select * from jsonb_array_elements(p_answers) loop
    insert into survey_answers (response_id, question_id, selected_option_ids, scale_value, text_value)
    values (
      v_response_id,
      (v_answer->>'question_id')::uuid,
      case when v_answer ? 'selected_option_ids' then (select array_agg((x)::uuid) from jsonb_array_elements_text(v_answer->'selected_option_ids') x) else null end,
      nullif(v_answer->>'scale_value', '')::int,
      nullif(trim(v_answer->>'text_value'), '')
    );
  end loop;

  return v_response_id;
end;
$$;

grant execute on function submit_survey_response(text, jsonb) to anon, authenticated;
