-- Survey — a new section inside the Live Quiz admin app (same quiz_admins
-- login, same company scoping), completely separate from Quizzes: no
-- score, no pass/fail, no "correct answer," no result shown back to the
-- respondent. Built for opinion-gathering ("kya aap company se khush
-- hai", "kaunsi HR policy theek hai", "kitna increment hona chahiye")
-- rather than knowledge-testing.
--
-- Genuinely anonymous by construction, not just by policy: unlike a Live
-- Quiz session (which signs a participant in and stores their
-- auth_user_id/display_name against every answer), survey_responses and
-- survey_answers carry NO identity column of any kind — nobody, not
-- even a company admin with full database access, can trace an answer
-- back to a person, because that link was never recorded. A respondent
-- doesn't sign in at all; they just open a link/access_code and answer.
--
-- Taking a survey is a public (anon), SECURITY DEFINER RPC-gated flow —
-- mirrors get_quiz_public_branding / get_current_quiz_question, which
-- already expose narrow public reads without opening broad anon SELECT
-- policies on the underlying tables.

create table surveys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  created_by uuid references quiz_admins(id) on delete set null,
  title text not null,
  description text not null default '',
  access_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_surveys_company on surveys(company_id);

create table survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  question_text text not null,
  type text not null default 'single_choice' check (type in ('single_choice', 'multi_choice', 'scale', 'open_text')),
  required boolean not null default true,
  scale_min int,
  scale_max int,
  display_order int not null default 0,
  constraint survey_questions_scale_range check (
    (type <> 'scale') or (scale_min is not null and scale_max is not null and scale_max > scale_min)
  )
);

create index idx_survey_questions_survey on survey_questions(survey_id, display_order);

create table survey_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references survey_questions(id) on delete cascade,
  option_text text not null,
  display_order int not null default 0
);

create index idx_survey_question_options_question on survey_question_options(question_id, display_order);

-- No identity columns anywhere in these two tables — see header note.
create table survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  submitted_at timestamptz not null default now()
);

create index idx_survey_responses_survey on survey_responses(survey_id);

create table survey_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references survey_responses(id) on delete cascade,
  question_id uuid not null references survey_questions(id) on delete cascade,
  selected_option_ids uuid[],
  scale_value int,
  text_value text
);

create index idx_survey_answers_response on survey_answers(response_id);
create index idx_survey_answers_question on survey_answers(question_id);

alter table surveys enable row level security;
alter table survey_questions enable row level security;
alter table survey_question_options enable row level security;
alter table survey_responses enable row level security;
alter table survey_answers enable row level security;

-- Admin CRUD — same identity/permission pattern as quizzes.
create policy surveys_select on surveys for select using (company_id = current_quiz_admin_company_id());
create policy surveys_insert on surveys for insert with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
create policy surveys_update on surveys for update
  using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit())
  with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
create policy surveys_delete on surveys for delete using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());

create policy survey_questions_select on survey_questions for select
  using (exists (select 1 from surveys s where s.id = survey_questions.survey_id and s.company_id = current_quiz_admin_company_id()));
create policy survey_questions_write on survey_questions for all
  using (exists (select 1 from surveys s where s.id = survey_questions.survey_id and s.company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit()))
  with check (exists (select 1 from surveys s where s.id = survey_questions.survey_id and s.company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit()));

create policy survey_question_options_select on survey_question_options for select
  using (exists (select 1 from survey_questions q join surveys s on s.id = q.survey_id where q.id = survey_question_options.question_id and s.company_id = current_quiz_admin_company_id()));
create policy survey_question_options_write on survey_question_options for all
  using (exists (select 1 from survey_questions q join surveys s on s.id = q.survey_id where q.id = survey_question_options.question_id and s.company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit()))
  with check (exists (select 1 from survey_questions q join surveys s on s.id = q.survey_id where q.id = survey_question_options.question_id and s.company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit()));

-- Admin can read (never write — responses only ever arrive via the
-- public submit RPC below) aggregate answer data. There is no identity
-- to filter by, so "read" here already IS the full anonymized dataset.
create policy survey_responses_select on survey_responses for select using (company_id = current_quiz_admin_company_id());
create policy survey_answers_select on survey_answers for select
  using (exists (select 1 from survey_responses r where r.id = survey_answers.response_id and r.company_id = current_quiz_admin_company_id()));

-- No anon policies on any of the 5 tables above — every public
-- interaction goes through one of the two SECURITY DEFINER RPCs below,
-- which is the only surface anon ever touches.

create or replace function get_survey_by_code(p_access_code text)
returns table (
  survey_id uuid, title text, description text,
  question_id uuid, question_text text, type text, required boolean, scale_min int, scale_max int, question_order int,
  option_id uuid, option_text text, option_order int
)
language sql stable security definer set search_path = public
as $$
  select s.id, s.title, s.description,
    q.id, q.question_text, q.type, q.required, q.scale_min, q.scale_max, q.display_order,
    o.id, o.option_text, o.display_order
  from surveys s
  join survey_questions q on q.survey_id = s.id
  left join survey_question_options o on o.question_id = q.id
  where s.access_code = lower(p_access_code) and s.status = 'published'
  order by q.display_order, o.display_order;
$$;

grant execute on function get_survey_by_code(text) to anon, authenticated;

-- p_answers shape: [{ "question_id": "...", "selected_option_ids": ["..."], "scale_value": 4, "text_value": "..." }, ...]
-- Only the field relevant to that question's type needs to be set; the
-- rest are simply null on the inserted row. Every required question
-- must appear with a non-empty answer or the whole submission is
-- rejected — never partially recorded.
create or replace function submit_survey_response(p_access_code text, p_answers jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_survey_id uuid;
  v_company_id uuid;
  v_response_id uuid;
  v_question record;
  v_answer jsonb;
begin
  select id, company_id into v_survey_id, v_company_id from surveys where access_code = lower(p_access_code) and status = 'published';
  if v_survey_id is null then
    raise exception 'This survey is not available.';
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
