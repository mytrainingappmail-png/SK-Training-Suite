-- "isme bhi timer ka option hona chaiye nahi to sab aram se dete
-- rahenge" — a "short time" live session can now carry an optional
-- overall time limit, set once at launch. The closes_at deadline
-- already added to `surveys` covers the async/anonymous-link mode (a
-- rolling window measured in days); this is the live-session
-- counterpart, measured in minutes, shown as a live countdown on the
-- participant's own screen and auto-submitting whatever's answered so
-- far the moment it hits zero.

alter table survey_sessions add column if not exists time_limit_seconds int;
alter table survey_sessions add column if not exists expires_at timestamptz;

-- join_survey_session needs to hand back expires_at so the taking page
-- can render the countdown — same return shape plus one column.

drop function if exists join_survey_session(text, text);
create function join_survey_session(p_pin text, p_display_name text)
returns table (
  participant_id uuid, survey_id uuid, title text, description text, expires_at timestamptz,
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

  select ss.id, ss.survey_id, ss.expires_at into v_session from survey_sessions ss where ss.pin = p_pin and ss.status = 'active';
  if v_session.id is null then
    raise exception 'That PIN is not active. Ask the host for the current one.';
  end if;
  if v_session.expires_at is not null and v_session.expires_at <= now() then
    raise exception 'This session''s time is up.';
  end if;

  insert into survey_session_participants (session_id, display_name) values (v_session.id, trim(p_display_name)) returning id into v_participant_id;

  return query
  select v_participant_id, s.id, s.title, s.description, v_session.expires_at,
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
