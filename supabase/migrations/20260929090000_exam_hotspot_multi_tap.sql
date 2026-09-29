-- Multi-point hotspot answers for the Exam module.
--
-- Until now a hotspot question scored a SINGLE tap, all-or-nothing: one
-- correct zone found -> full marks, anything else -> zero. A question with
-- many landmarks (e.g. 16 numbered spots on one map, one mark each) needs
-- the trainee to identify EACH spot separately and get partial credit for
-- however many they found, not lose everything over one miss. This adds a
-- hotspot_taps array (one {x,y} per confirmed tap, capped at the number of
-- zones) alongside the existing single click_x/click_y, and grades hotspot
-- answers by counting how many DISTINCT zones were correctly identified.
-- click_x/click_y stay for the legacy single-target (target_x/target_y)
-- fallback path — untouched.

alter table exam_answers add column if not exists hotspot_taps jsonb not null default '[]'::jsonb;

-- ── Helpers ─────────────────────────────────────────────────────────────

-- Same shape-matching logic as hotspot_zone_hit, but returns which zone
-- (0-based index into the zones array) a point landed in, or null. Lets the
-- caller de-duplicate taps that land in the same zone twice.
create or replace function hotspot_zone_index_hit(p_zones jsonb, p_x numeric, p_y numeric)
returns int
language plpgsql
immutable
set search_path = public
as $function$
declare
  z jsonb;
  pts jsonb;
  n int;
  i int;
  j int;
  inside boolean;
  xi numeric; yi numeric; xj numeric; yj numeric;
  shape text;
  idx int := 0;
begin
  if p_zones is null or jsonb_typeof(p_zones) <> 'array' then
    return null;
  end if;

  for z in select * from jsonb_array_elements(p_zones) loop
    shape := z->>'shape';
    if shape = 'circle' then
      if sqrt(power(p_x - (z->>'x')::numeric, 2) + power(p_y - (z->>'y')::numeric, 2)) <= (z->>'r')::numeric then
        return idx;
      end if;
    elsif shape = 'rect' then
      if p_x >= (z->>'x')::numeric and p_x <= (z->>'x')::numeric + (z->>'w')::numeric
         and p_y >= (z->>'y')::numeric and p_y <= (z->>'y')::numeric + (z->>'h')::numeric then
        return idx;
      end if;
    elsif shape = 'poly' then
      pts := z->'points';
      n := coalesce(jsonb_array_length(pts), 0);
      if n >= 3 then
        inside := false;
        j := n - 1;
        for i in 0 .. n - 1 loop
          xi := (pts->i->>0)::numeric; yi := (pts->i->>1)::numeric;
          xj := (pts->j->>0)::numeric; yj := (pts->j->>1)::numeric;
          if ((yi > p_y) <> (yj > p_y)) and (p_x < (xj - xi) * (p_y - yi) / (yj - yi) + xi) then
            inside := not inside;
          end if;
          j := i;
        end loop;
        if inside then
          return idx;
        end if;
      end if;
    end if;
    idx := idx + 1;
  end loop;

  return null;
end;
$function$;

-- Count of DISTINCT zones hit across every tap in p_taps ([{x,y}, ...]).
-- Two taps landing in the same zone only count once — a trainee can't farm
-- extra marks by tapping one spot repeatedly.
create or replace function hotspot_zone_hits_count(p_zones jsonb, p_taps jsonb)
returns int
language plpgsql
immutable
set search_path = public
as $function$
declare
  hit_zones int[] := '{}';
  tap jsonb;
  zi int;
begin
  if p_zones is null or jsonb_typeof(p_zones) <> 'array'
     or p_taps is null or jsonb_typeof(p_taps) <> 'array' then
    return 0;
  end if;

  for tap in select * from jsonb_array_elements(p_taps) loop
    zi := hotspot_zone_index_hit(p_zones, (tap->>'x')::numeric, (tap->>'y')::numeric);
    if zi is not null and not (zi = any(hit_zones)) then
      hit_zones := array_append(hit_zones, zi);
    end if;
  end loop;

  return coalesce(array_length(hit_zones, 1), 0);
end;
$function$;

-- ── Grading ─────────────────────────────────────────────────────────────

create or replace function exam_grade_participant(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update exam_answers ea
  set is_correct = g.ok,
      marks_awarded = g.awarded,
      auto_graded = true
  from (
    select a.id as answer_id,
      case q.type
        when 'hotspot' then
          case
            when q.hotspot_zones is not null and jsonb_typeof(q.hotspot_zones) = 'array' and jsonb_array_length(q.hotspot_zones) > 0
              then hotspot_zone_hits_count(q.hotspot_zones, coalesce(a.hotspot_taps, '[]'::jsonb)) >= jsonb_array_length(q.hotspot_zones)
            when a.click_x is not null and a.click_y is not null and q.target_x is not null and q.target_y is not null
              then sqrt(power(a.click_x - q.target_x, 2) + power(a.click_y - q.target_y, 2)) <= coalesce(q.target_radius, 6)
            else false
          end
        else coalesce((select o.is_correct from quiz_question_options o where o.id = a.selected_option_id and o.question_id = q.id), false)
      end as ok,
      case q.type
        when 'hotspot' then
          case
            -- Zone-based: partial credit, one share of the marks per distinct correct zone found.
            when q.hotspot_zones is not null and jsonb_typeof(q.hotspot_zones) = 'array' and jsonb_array_length(q.hotspot_zones) > 0
              then round(
                     q.marks * hotspot_zone_hits_count(q.hotspot_zones, coalesce(a.hotspot_taps, '[]'::jsonb))::numeric
                     / jsonb_array_length(q.hotspot_zones), 2)
            -- Legacy single-target question (no zones): all-or-nothing, unchanged.
            when a.click_x is not null and a.click_y is not null and q.target_x is not null and q.target_y is not null
              and sqrt(power(a.click_x - q.target_x, 2) + power(a.click_y - q.target_y, 2)) <= coalesce(q.target_radius, 6)
              then q.marks
            else 0
          end
        else
          case when coalesce((select o.is_correct from quiz_question_options o where o.id = a.selected_option_id and o.question_id = q.id), false)
            then q.marks else 0 end
      end as awarded
    from exam_answers a
    join quiz_questions q on q.id = a.question_id
    where a.participant_id = p_participant_id and q.type in ('mcq', 'truefalse', 'hotspot')
  ) g
  where ea.id = g.answer_id and ea.auto_graded = false;
end;
$$;

-- ── Save / read answers ─────────────────────────────────────────────────

-- Gains a 9th parameter (p_hotspot_taps), which changes the function's
-- identity for Postgres/PostgREST purposes — CREATE OR REPLACE on a
-- changed argument list creates a SEPARATE overload rather than replacing
-- this one in place, leaving the old 8-arg version (and its grant) behind.
-- Drop it explicitly so only the new signature exists.
drop function if exists save_exam_answer(uuid, uuid, uuid, numeric, numeric, text, text[], boolean);
create or replace function save_exam_answer(
  p_session_id uuid,
  p_question_id uuid,
  p_selected_option_id uuid default null,
  p_click_x numeric default null,
  p_click_y numeric default null,
  p_text_answer text default null,
  p_image_paths text[] default null,
  p_flagged boolean default false,
  p_hotspot_taps jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
  v_prefix text;
  v_type text;
  v_empty boolean;
  v_taps jsonb;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  if v_sub is not null then raise exception 'You have already submitted this exam.'; end if;

  select * into v_s from exam_sessions es where es.id = p_session_id;
  if now() < v_s.opens_at then raise exception 'The exam has not started yet.'; end if;
  if v_s.finished_at is not null or now() > v_s.deadline_at + interval '20 seconds' then
    raise exception 'The exam time is over — answers are locked.';
  end if;

  select q.type into v_type from quiz_questions q where q.id = p_question_id and q.quiz_id = v_s.quiz_id and not q.is_hidden;
  if v_type is null then raise exception 'That question is not part of this exam.'; end if;

  if p_selected_option_id is not null and not exists (
    select 1 from quiz_question_options o where o.id = p_selected_option_id and o.question_id = p_question_id
  ) then raise exception 'That option does not belong to this question.'; end if;

  if p_text_answer is not null and length(p_text_answer) > 20000 then raise exception 'Answer is too long.'; end if;

  if p_hotspot_taps is not null then
    if jsonb_typeof(p_hotspot_taps) <> 'array' then raise exception 'Invalid tap data.'; end if;
    if jsonb_array_length(p_hotspot_taps) > 40 then raise exception 'Too many tapped points.'; end if;
  end if;
  v_taps := coalesce(p_hotspot_taps, '[]'::jsonb);

  v_prefix := p_session_id::text || '/' || v_pid::text || '/';
  if p_image_paths is not null then
    if cardinality(p_image_paths) > 5 then raise exception 'You can attach up to 5 photos per answer.'; end if;
    if exists (select 1 from unnest(p_image_paths) pth where left(pth, length(v_prefix)) <> v_prefix) then
      raise exception 'Invalid photo.';
    end if;
  end if;

  v_empty := p_selected_option_id is null and p_click_x is null and jsonb_array_length(v_taps) = 0
    and coalesce(trim(p_text_answer), '') = ''
    and coalesce(cardinality(p_image_paths), 0) = 0 and not coalesce(p_flagged, false);

  if v_empty then
    delete from exam_answers where participant_id = v_pid and question_id = p_question_id;
    return;
  end if;

  insert into exam_answers (participant_id, question_id, selected_option_id, click_x, click_y, text_answer, image_paths, flagged, hotspot_taps, updated_at)
  values (v_pid, p_question_id, p_selected_option_id, p_click_x, p_click_y, nullif(p_text_answer, ''), coalesce(p_image_paths, '{}'), coalesce(p_flagged, false), v_taps, now())
  on conflict (participant_id, question_id) do update
    set selected_option_id = excluded.selected_option_id,
        click_x = excluded.click_x,
        click_y = excluded.click_y,
        text_answer = excluded.text_answer,
        image_paths = excluded.image_paths,
        flagged = excluded.flagged,
        hotspot_taps = excluded.hotspot_taps,
        updated_at = now();
end;
$$;

-- Return signature gains saved_hotspot_taps and hotspot_zone_count, which
-- CREATE OR REPLACE can't do in place. hotspot_zone_count tells the player
-- how many points to expect (16, say) WITHOUT sending the zone geometry
-- itself, which would leak the answer.
drop function if exists get_exam_paper(uuid);
create or replace function get_exam_paper(p_session_id uuid)
returns table (
  question_position int, question_id uuid, question_text text, type text, marks int, image_url text,
  option_id uuid, option_text text, option_order int,
  saved_selected_option_id uuid, saved_click_x numeric, saved_click_y numeric,
  saved_text text, saved_image_paths text[], saved_flagged boolean, saved_hotspot_taps jsonb,
  hotspot_zone_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
  v_shuffle_q boolean;
  v_shuffle_o boolean;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  select * into v_s from exam_sessions es where es.id = p_session_id;
  if now() < v_s.opens_at then raise exception 'The exam has not started yet.'; end if;
  if v_sub is not null then raise exception 'You have already submitted this exam.'; end if;
  if v_s.finished_at is not null or now() > v_s.deadline_at + interval '90 seconds' then raise exception 'This exam''s time is over.'; end if;

  select coalesce(qz.shuffle_questions_per_participant, false), coalesce(qz.shuffle_options, false)
    into v_shuffle_q, v_shuffle_o from quizzes qz where qz.id = v_s.quiz_id;

  return query
  with qs as (
    select q.*, row_number() over (
      order by case when v_shuffle_q then md5(q.id::text || v_pid::text) else lpad(q.display_order::text, 10, '0') end
    )::int as pos
    from quiz_questions q where q.quiz_id = v_s.quiz_id and not q.is_hidden
  )
  select qs.pos, qs.id, qs.question_text, qs.type, qs.marks, qs.image_url,
    o.id, o.option_text,
    case when o.id is null then null
         when v_shuffle_o and qs.type <> 'truefalse' then (row_number() over (partition by qs.id order by md5(o.id::text || v_pid::text)))::int
         else (row_number() over (partition by qs.id order by o.display_order))::int end,
    a.selected_option_id, a.click_x, a.click_y, a.text_answer, coalesce(a.image_paths, '{}'::text[]), coalesce(a.flagged, false),
    coalesce(a.hotspot_taps, '[]'::jsonb),
    case when qs.hotspot_zones is not null and jsonb_typeof(qs.hotspot_zones) = 'array' then jsonb_array_length(qs.hotspot_zones) else null end
  from qs
  left join quiz_question_options o on o.question_id = qs.id
  left join exam_answers a on a.question_id = qs.id and a.participant_id = v_pid
  order by qs.pos, 9;
end;
$$;

-- ── Admin visibility (answered-count / detail checks now also count taps) ─

create or replace function get_exam_participants_admin(p_session_id uuid)
returns table (
  participant_id uuid, display_name text, joined_at timestamptz, submitted_at timestamptz,
  submit_reason text, tab_switches int, answered_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from exam_sessions s where s.id = p_session_id and s.company_id = current_quiz_admin_company_id()) then
    raise exception 'Exam not found or not authorized.';
  end if;
  return query
  select ep.id, ep.display_name, ep.joined_at, ep.submitted_at, ep.submit_reason, ep.tab_switches,
    (select count(*)::int from exam_answers a where a.participant_id = ep.id
      and (a.selected_option_id is not null or a.click_x is not null or coalesce(trim(a.text_answer), '') <> ''
           or cardinality(a.image_paths) > 0 or jsonb_array_length(coalesce(a.hotspot_taps, '[]'::jsonb)) > 0))
  from exam_participants ep
  where ep.session_id = p_session_id
  order by ep.joined_at;
end;
$$;

create or replace function get_exam_question_stats(p_session_id uuid)
returns table (question_id uuid, question_order int, question_text text, type text, marks int, attempted int, correct int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_s exam_sessions;
begin
  select * into v_s from exam_sessions es where es.id = p_session_id and es.company_id = current_quiz_admin_company_id();
  if v_s.id is null then raise exception 'Exam not found or not authorized.'; end if;
  if v_s.finished_at is null then raise exception 'Results are available only after the exam has finished.'; end if;

  return query
  select q.id, q.display_order, q.question_text, q.type, q.marks,
    (select count(*)::int from exam_answers a join exam_participants ep on ep.id = a.participant_id
      where a.question_id = q.id and ep.session_id = p_session_id
        and (a.selected_option_id is not null or a.click_x is not null or coalesce(trim(a.text_answer), '') <> ''
             or cardinality(a.image_paths) > 0 or jsonb_array_length(coalesce(a.hotspot_taps, '[]'::jsonb)) > 0)),
    (select count(*)::int from exam_answers a join exam_participants ep on ep.id = a.participant_id
      where a.question_id = q.id and ep.session_id = p_session_id and a.is_correct is true)
  from quiz_questions q
  where q.quiz_id = v_s.quiz_id and not q.is_hidden
  order by q.display_order;
end;
$$;

drop function if exists get_exam_participant_detail(uuid);
create or replace function get_exam_participant_detail(p_participant_id uuid)
returns table (
  answer_id uuid, question_id uuid, question_order int, question_text text, type text, marks int, explanation text,
  image_url text, selected_option_text text, correct_option_text text, text_answer text, image_paths text[],
  click_x numeric, click_y numeric, hotspot_taps jsonb, hotspot_zones jsonb, answered boolean, flagged boolean,
  is_correct boolean, marks_awarded numeric, grader_comment text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_s exam_sessions;
begin
  select es.* into v_s from exam_participants ep join exam_sessions es on es.id = ep.session_id
  where ep.id = p_participant_id and es.company_id = current_quiz_admin_company_id();
  if v_s.id is null then raise exception 'Not found or not authorized.'; end if;
  if v_s.finished_at is null then raise exception 'Results are available only after the exam has finished.'; end if;

  return query
  select a.id, q.id, q.display_order, q.question_text, q.type, q.marks, q.explanation,
    q.image_url,
    (select o.option_text from quiz_question_options o where o.id = a.selected_option_id),
    (select string_agg(o.option_text, ' / ' order by o.display_order) from quiz_question_options o where o.question_id = q.id and o.is_correct),
    a.text_answer, coalesce(a.image_paths, '{}'::text[]), a.click_x, a.click_y, coalesce(a.hotspot_taps, '[]'::jsonb), q.hotspot_zones,
    (a.id is not null and (a.selected_option_id is not null or a.click_x is not null or coalesce(trim(a.text_answer), '') <> ''
      or cardinality(a.image_paths) > 0 or jsonb_array_length(coalesce(a.hotspot_taps, '[]'::jsonb)) > 0)),
    coalesce(a.flagged, false),
    a.is_correct, a.marks_awarded, a.grader_comment
  from quiz_questions q
  left join exam_answers a on a.question_id = q.id and a.participant_id = p_participant_id
  where q.quiz_id = v_s.quiz_id and not q.is_hidden
  order by q.display_order;
end;
$$;

create or replace function get_my_exam_result(p_session_id uuid)
returns table (
  question_order int, question_text text, type text, marks int,
  my_answer_text text, my_selected_option_text text, correct_option_text text,
  is_correct boolean, marks_awarded numeric, grader_comment text, answered boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  select * into v_s from exam_sessions es where es.id = p_session_id;
  if not v_s.results_released or v_sub is null then raise exception 'Your result is not available yet.'; end if;

  return query
  select q.display_order, q.question_text, q.type, q.marks,
    a.text_answer,
    (select o.option_text from quiz_question_options o where o.id = a.selected_option_id),
    (select string_agg(o.option_text, ' / ' order by o.display_order) from quiz_question_options o where o.question_id = q.id and o.is_correct),
    a.is_correct, a.marks_awarded, a.grader_comment,
    (a.id is not null and (a.selected_option_id is not null or a.click_x is not null or coalesce(trim(a.text_answer), '') <> ''
      or cardinality(a.image_paths) > 0 or jsonb_array_length(coalesce(a.hotspot_taps, '[]'::jsonb)) > 0))
  from quiz_questions q
  left join exam_answers a on a.question_id = q.id and a.participant_id = v_pid
  where q.quiz_id = v_s.quiz_id and not q.is_hidden
  order by q.display_order;
end;
$$;

grant execute on function get_exam_participant_detail(uuid) to authenticated;
grant execute on function get_exam_paper(uuid) to authenticated;
grant execute on function save_exam_answer(uuid, uuid, uuid, numeric, numeric, text, text[], boolean, jsonb) to authenticated;
