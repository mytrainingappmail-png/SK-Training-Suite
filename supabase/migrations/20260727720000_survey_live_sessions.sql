-- Survey Phase 2: "short time" live sessions — the PIN-join, named-
-- participant mode for a quick pulse check during a meeting/event,
-- alongside (never replacing) the anonymous link mode from Phase 1.
-- Same survey, same questions, two different ways to collect answers:
--   - Anonymous link (existing): self-paced, no PIN, no identity ever.
--   - Live session (this migration): admin "launches" a session (like
--     a quiz session), gets a 6-digit PIN, participants join with a
--     name — same pattern as quiz_sessions/quiz_participants — and the
--     host can see who's joined in real time.
--
-- survey_responses/survey_answers stay the ONE shared answer table so
-- every aggregation/results function from Phase 1 keeps working
-- unchanged for both modes — a response is anonymous when
-- session_participant_id is null (the only path the Phase 1 RPC ever
-- takes) and identified when it's set (only the live-session RPC below
-- ever sets it).

create table survey_sessions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  host_admin_id uuid references quiz_admins(id) on delete set null,
  pin text not null,
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- PINs only need to be unique among currently-active sessions — same
-- reasoning as quiz_sessions' own PIN index.
create unique index uq_survey_sessions_active_pin on survey_sessions (pin) where status = 'active';
create index idx_survey_sessions_survey on survey_sessions(survey_id);

create table survey_session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references survey_sessions(id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index idx_survey_session_participants_session on survey_session_participants(session_id);

alter table survey_responses add column if not exists session_participant_id uuid references survey_session_participants(id) on delete set null;
create index idx_survey_responses_session_participant on survey_responses(session_participant_id);

alter table survey_sessions enable row level security;
alter table survey_session_participants enable row level security;

create policy survey_sessions_select on survey_sessions for select using (company_id = current_quiz_admin_company_id());
create policy survey_sessions_insert on survey_sessions for insert with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
create policy survey_sessions_update on survey_sessions for update
  using (company_id = current_quiz_admin_company_id())
  with check (company_id = current_quiz_admin_company_id());

create policy survey_session_participants_select on survey_session_participants for select
  using (exists (select 1 from survey_sessions s where s.id = survey_session_participants.session_id and s.company_id = current_quiz_admin_company_id()));

-- No anon policies on either table — joining/answering only ever
-- happens through the two security-definer RPCs below, same boundary
-- pattern as the anonymous-mode RPCs.

create or replace function join_survey_session(p_pin text, p_display_name text)
returns table (
  participant_id uuid, survey_id uuid, title text, description text,
  question_id uuid, question_text text, type text, required boolean, scale_min int, scale_max int, question_order int,
  option_id uuid, option_text text, option_order int
)
language plpgsql security definer set search_path = public
as $$
declare
  v_session record;
  v_participant_id uuid;
begin
  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'Please enter your name to join.';
  end if;

  select ss.id, ss.survey_id into v_session from survey_sessions ss where ss.pin = p_pin and ss.status = 'active';
  if v_session.id is null then
    raise exception 'That PIN is not active. Ask the host for the current one.';
  end if;

  insert into survey_session_participants (session_id, display_name) values (v_session.id, trim(p_display_name)) returning id into v_participant_id;

  return query
  select v_participant_id, s.id, s.title, s.description,
    q.id, q.question_text, q.type, q.required, q.scale_min, q.scale_max, q.display_order,
    o.id, o.option_text, o.display_order
  from surveys s
  join survey_questions q on q.survey_id = s.id
  left join survey_question_options o on o.question_id = q.id
  where s.id = v_session.survey_id
  order by q.display_order, o.display_order;
end;
$$;

grant execute on function join_survey_session(text, text) to anon, authenticated;

create or replace function submit_survey_session_response(p_participant_id uuid, p_answers jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_survey_id uuid;
  v_company_id uuid;
  v_already_submitted timestamptz;
  v_response_id uuid;
  v_question record;
  v_answer jsonb;
begin
  select s.survey_id, sv.company_id, p.submitted_at
    into v_survey_id, v_company_id, v_already_submitted
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

  for v_question in select id, type, required from survey_questions where survey_id = v_survey_id loop
    v_answer := (select a.value from jsonb_array_elements(p_answers) a where (a.value->>'question_id')::uuid = v_question.id limit 1);
    if v_question.required and (
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
