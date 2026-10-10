-- Exam host: live results and per-candidate Stop / Resume.
--
--  * get_exam_live_admin       how many each candidate has answered, how many right and wrong, marks so far — computed
--                              on the fly from the saved answers, for the host's own screen only.
--  * get_exam_live_questions   which questions are being missed most, live.
--  * stop_exam_participant     the invigilator pauses ONE candidate (indiscipline); resume_exam_participant lets them continue.
--                              While stopped the database itself refuses their answers and their own Submit, so a stopped
--                              candidate cannot get round it by going offline or editing the page. The exam clock keeps running.
--  * get_exam_my_control       what the candidate's own screen asks to know whether it has been paused.
-- Nothing here changes how marks are calculated or stored; written answers are only counted, never auto-marked.

alter table exam_participants add column if not exists stopped_at timestamptz;
alter table exam_participants add column if not exists stop_reason text;

-- ── the database refuses answers from a stopped candidate ─────────────────────────────────────────────────────────

create or replace function exam_block_stopped_answers() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and not (
       new.selected_option_id is distinct from old.selected_option_id
    or new.click_x is distinct from old.click_x
    or new.click_y is distinct from old.click_y
    or new.text_answer is distinct from old.text_answer
    or new.image_paths is distinct from old.image_paths
    or new.hotspot_taps is distinct from old.hotspot_taps
    or new.flagged is distinct from old.flagged
  ) then
    return new; -- marking / regrading by the trainer only touches marks, never the answer itself
  end if;
  if exists (select 1 from exam_participants ep where ep.id = new.participant_id and ep.stopped_at is not null) then
    raise exception 'Your exam has been paused by the invigilator. Please wait — you can continue once they resume it.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_exam_block_stopped_answers on exam_answers;
create trigger trg_exam_block_stopped_answers before insert or update on exam_answers
  for each row execute function exam_block_stopped_answers();

create or replace function exam_block_stopped_submit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stopped_at is not null and old.submitted_at is null and new.submitted_at is not null and coalesce(new.submit_reason, 'manual') = 'manual' then
    raise exception 'Your exam has been paused by the invigilator. Please wait — you can submit once they resume it.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_exam_block_stopped_submit on exam_participants;
create trigger trg_exam_block_stopped_submit before update on exam_participants
  for each row execute function exam_block_stopped_submit();

-- ── host actions ───────────────────────────────────────────────────────────────────────────────────────────────────

create or replace function stop_exam_participant(p_participant_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_s exam_sessions;
  v_sub timestamptz;
begin
  select es.* into v_s
  from exam_participants ep join exam_sessions es on es.id = ep.session_id
  where ep.id = p_participant_id;
  select ep.submitted_at into v_sub from exam_participants ep where ep.id = p_participant_id;
  if v_s.id is null then raise exception 'Candidate not found.'; end if;
  if v_s.company_id is distinct from current_quiz_admin_company_id() or not current_quiz_admin_can_edit() then
    raise exception 'You are not allowed to do this.';
  end if;
  if v_s.finished_at is not null or now() >= v_s.deadline_at then raise exception 'The exam is over.'; end if;
  if v_sub is not null then raise exception 'This candidate has already submitted.'; end if;
  update exam_participants set stopped_at = now(), stop_reason = nullif(trim(coalesce(p_reason, '')), '') where id = p_participant_id;
end;
$$;

create or replace function resume_exam_participant(p_participant_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
begin
  select es.company_id into v_company
  from exam_participants ep join exam_sessions es on es.id = ep.session_id
  where ep.id = p_participant_id;
  if v_company is null then raise exception 'Candidate not found.'; end if;
  if v_company is distinct from current_quiz_admin_company_id() or not current_quiz_admin_can_edit() then
    raise exception 'You are not allowed to do this.';
  end if;
  update exam_participants set stopped_at = null, stop_reason = null where id = p_participant_id;
end;
$$;

-- ── what the candidate's own screen asks ──────────────────────────────────────────────────────────────────────────

create or replace function get_exam_my_control(p_session_id uuid)
returns table (stopped boolean, stop_reason text)
language sql stable security definer set search_path = public as $$
  select (ep.stopped_at is not null), ep.stop_reason
  from exam_participants ep
  where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
$$;

-- ── live numbers for the host ──────────────────────────────────────────────────────────────────────────────────────

create or replace function get_exam_live_admin(p_session_id uuid)
returns table (
  participant_id uuid,
  answered_count int,
  correct_count int,
  wrong_count int,
  written_count int,
  auto_marks numeric,
  possible_marks numeric,
  stopped_at timestamptz,
  stop_reason text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_quiz uuid;
  v_possible numeric;
begin
  select es.quiz_id into v_quiz from exam_sessions es where es.id = p_session_id and es.company_id = current_quiz_admin_company_id();
  if v_quiz is null then raise exception 'Exam not found or not authorized.'; end if;
  select coalesce(sum(q.marks), 0) into v_possible from quiz_questions q where q.quiz_id = v_quiz and not q.is_hidden;

  return query
  with ans as (
    select
      a.participant_id as pid,
      q.type as qtype,
      q.marks as qmarks,
      case
        when q.type = 'written' then (coalesce(trim(a.text_answer), '') <> '' or coalesce(cardinality(a.image_paths), 0) > 0)
        when q.type = 'hotspot' then (a.click_x is not null or jsonb_array_length(coalesce(a.hotspot_taps, '[]'::jsonb)) > 0)
        else a.selected_option_id is not null
      end as answered,
      case
        when q.type = 'written' then null
        when q.type = 'hotspot' then
          case
            when q.hotspot_zones is not null and jsonb_typeof(q.hotspot_zones) = 'array' and jsonb_array_length(q.hotspot_zones) > 0
              then hotspot_zone_hits_count(q.hotspot_zones, coalesce(a.hotspot_taps, '[]'::jsonb)) >= jsonb_array_length(q.hotspot_zones)
            when a.click_x is not null and a.click_y is not null and q.target_x is not null and q.target_y is not null
              then sqrt(power(a.click_x - q.target_x, 2) + power(a.click_y - q.target_y, 2)) <= coalesce(q.target_radius, 6)
            else false
          end
        else coalesce((select o.is_correct from quiz_question_options o where o.id = a.selected_option_id and o.question_id = q.id), false)
      end as ok,
      case
        when q.type = 'written' then 0::numeric
        when q.type = 'hotspot' then
          case
            when q.hotspot_zones is not null and jsonb_typeof(q.hotspot_zones) = 'array' and jsonb_array_length(q.hotspot_zones) > 0
              then round(q.marks * hotspot_zone_hits_count(q.hotspot_zones, coalesce(a.hotspot_taps, '[]'::jsonb))::numeric / jsonb_array_length(q.hotspot_zones), 2)
            when a.click_x is not null and a.click_y is not null and q.target_x is not null and q.target_y is not null
              and sqrt(power(a.click_x - q.target_x, 2) + power(a.click_y - q.target_y, 2)) <= coalesce(q.target_radius, 6)
              then q.marks::numeric
            else 0::numeric
          end
        else case when coalesce((select o.is_correct from quiz_question_options o where o.id = a.selected_option_id and o.question_id = q.id), false)
                  then q.marks::numeric else 0::numeric end
      end as got
    from exam_answers a
    join quiz_questions q on q.id = a.question_id and q.quiz_id = v_quiz and not q.is_hidden
    where a.participant_id in (select id from exam_participants where session_id = p_session_id)
  )
  select
    ep.id,
    coalesce(count(*) filter (where ans.answered), 0)::int,
    coalesce(count(*) filter (where ans.answered and ans.qtype <> 'written' and ans.ok), 0)::int,
    coalesce(count(*) filter (where ans.answered and ans.qtype <> 'written' and not ans.ok), 0)::int,
    coalesce(count(*) filter (where ans.answered and ans.qtype = 'written'), 0)::int,
    coalesce(sum(ans.got) filter (where ans.answered), 0)::numeric,
    v_possible,
    ep.stopped_at,
    ep.stop_reason
  from exam_participants ep
  left join ans on ans.pid = ep.id
  where ep.session_id = p_session_id
  group by ep.id, ep.stopped_at, ep.stop_reason, ep.joined_at
  order by ep.joined_at;
end;
$$;

create or replace function get_exam_live_questions(p_session_id uuid)
returns table (question_id uuid, question_order int, question_text text, qtype text, attempted int, correct int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_quiz uuid;
begin
  select es.quiz_id into v_quiz from exam_sessions es where es.id = p_session_id and es.company_id = current_quiz_admin_company_id();
  if v_quiz is null then raise exception 'Exam not found or not authorized.'; end if;

  return query
  select q.id, (row_number() over (order by q.display_order))::int, left(q.question_text, 140), q.type::text,
    count(*) filter (where (case
        when q.type = 'written' then (coalesce(trim(a.text_answer), '') <> '' or coalesce(cardinality(a.image_paths), 0) > 0)
        when q.type = 'hotspot' then (a.click_x is not null or jsonb_array_length(coalesce(a.hotspot_taps, '[]'::jsonb)) > 0)
        else a.selected_option_id is not null end))::int,
    count(*) filter (where q.type = 'hotspot' and (
        case when q.hotspot_zones is not null and jsonb_typeof(q.hotspot_zones) = 'array' and jsonb_array_length(q.hotspot_zones) > 0
               then hotspot_zone_hits_count(q.hotspot_zones, coalesce(a.hotspot_taps, '[]'::jsonb)) >= jsonb_array_length(q.hotspot_zones)
             else false end)
      or q.type in ('mcq', 'truefalse') and coalesce((select o.is_correct from quiz_question_options o where o.id = a.selected_option_id and o.question_id = q.id), false))::int
  from quiz_questions q
  left join exam_answers a on a.question_id = q.id
    and a.participant_id in (select id from exam_participants where session_id = p_session_id)
  where q.quiz_id = v_quiz and not q.is_hidden
  group by q.id, q.display_order, q.question_text, q.type
  order by q.display_order;
end;
$$;

revoke all on function stop_exam_participant(uuid, text) from public;
revoke all on function resume_exam_participant(uuid) from public;
revoke all on function get_exam_my_control(uuid) from public;
revoke all on function get_exam_live_admin(uuid) from public;
revoke all on function get_exam_live_questions(uuid) from public;
grant execute on function stop_exam_participant(uuid, text) to authenticated;
grant execute on function resume_exam_participant(uuid) to authenticated;
grant execute on function get_exam_my_control(uuid) to authenticated;
grant execute on function get_exam_live_admin(uuid) to authenticated;
grant execute on function get_exam_live_questions(uuid) to authenticated;
