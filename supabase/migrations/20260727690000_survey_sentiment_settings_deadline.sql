-- Survey Phase 1 follow-up: sentiment-tagged options (so an "overall
-- average" can be computed across questions of different types, the
-- same disposition-tagging idea already used by calling_app_dispositions),
-- an optional close date, and survey's own appearance settings —
-- completely separate from quiz_settings.

alter table survey_question_options add column if not exists sentiment text not null default 'neutral' check (sentiment in ('positive', 'neutral', 'negative'));
alter table surveys add column if not exists closes_at timestamptz;

create table survey_settings (
  company_id uuid primary key references companies(id) on delete cascade,
  option_font_size int not null default 16 check (option_font_size between 12 and 28),
  option_colors jsonb not null default '[
    {"box": "#7C3AED", "font": "#FFFFFF"},
    {"box": "#2563EB", "font": "#FFFFFF"},
    {"box": "#059669", "font": "#FFFFFF"},
    {"box": "#D97706", "font": "#FFFFFF"},
    {"box": "#DB2777", "font": "#FFFFFF"},
    {"box": "#0891B2", "font": "#FFFFFF"}
  ]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table survey_settings enable row level security;
create policy survey_settings_select on survey_settings for select using (company_id = current_quiz_admin_company_id());
create policy survey_settings_write on survey_settings for insert with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
create policy survey_settings_update on survey_settings for update
  using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit())
  with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());

-- A closed survey (past its closes_at) stops appearing to the public
-- entirely — same "not available" experience as an unpublished one —
-- and stops accepting new responses.

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
  where s.access_code = lower(p_access_code) and s.status = 'published' and (s.closes_at is null or s.closes_at > now())
  order by q.display_order, o.display_order;
$$;

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
  select id, company_id into v_survey_id, v_company_id
  from surveys
  where access_code = lower(p_access_code) and status = 'published' and (closes_at is null or closes_at > now());

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
