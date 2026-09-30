-- Exam input hardening.
--
-- Found in a design review: save_exam_answer only checked that
-- hotspot_taps was an array of <=40 items, never the elements. Grading then
-- did (tap->>'x')::numeric, which throws on {"x":"abc"} — and because
-- exam_finalize_session grades every participant in one loop with no
-- exception handling, a single poisoned row aborted finalization for the
-- whole session (end_exam_session and the admin poll both call it).
--
-- Fixes, all signature-preserving (create or replace keeps existing grants):
--  1. save_exam_answer rebuilds taps as clean {x,y,correct?,label?}, drops
--     anything non-numeric / outside 0-100, caps the count at the question's
--     zone count, ignores taps for non-hotspot questions, and locks the
--     participant row so a save can't slip in after a concurrent submit.
--  2. hotspot_zone_hits_count skips malformed taps instead of throwing.
--  3. exam_finalize_session and submit_exam isolate grading failures.
--  4. A CHECK on exam_answers.hotspot_taps as a last line of defence.

-- ── 2. tolerant hit counting ────────────────────────────────────────────
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
    if jsonb_typeof(tap) = 'object'
       and jsonb_typeof(tap->'x') = 'number'
       and jsonb_typeof(tap->'y') = 'number' then
      zi := hotspot_zone_index_hit(p_zones, (tap->>'x')::numeric, (tap->>'y')::numeric);
      if zi is not null and not (zi = any(hit_zones)) then
        hit_zones := array_append(hit_zones, zi);
      end if;
    end if;
  end loop;

  return coalesce(array_length(hit_zones, 1), 0);
end;
$function$;

-- ── 3. grading failures never block finishing ───────────────────────────
create or replace function exam_finalize_session(p_session_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
begin
  for v_pid in select ep.id from exam_participants ep where ep.session_id = p_session_id and ep.submitted_at is null loop
    update exam_participants set submitted_at = now(), submit_reason = p_reason where id = v_pid;
    begin
      perform exam_grade_participant(v_pid);
    exception when others then
      -- The participant stays submitted; their answers just remain ungraded
      -- for an admin to look at. One bad row must not hold the whole session open.
      raise warning 'exam_finalize_session: grading failed for participant %: %', v_pid, sqlerrm;
    end;
  end loop;
  update exam_sessions set finished_at = now() where id = p_session_id and finished_at is null;
end;
$$;

create or replace function submit_exam(p_session_id uuid, p_reason text default 'manual')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_sub timestamptz;
begin
  -- FOR UPDATE serialises against save_exam_answer (which also locks this
  -- row), so an answer can't land after the grade pass and silently score 0.
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid()
  for update;
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  if v_sub is not null then return; end if; -- already submitted: idempotent

  update exam_participants
  set submitted_at = now(), submit_reason = case when p_reason = 'timeout' then 'timeout' else 'manual' end
  where id = v_pid;

  begin
    perform exam_grade_participant(v_pid);
  exception when others then
    raise warning 'submit_exam: grading failed for participant %: %', v_pid, sqlerrm;
  end;
end;
$$;

-- ── 1. save_exam_answer: validate and sanitise taps, lock the row ───────
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
returns table (saved_is_correct boolean)
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
  v_marks int;
  v_zone_count int;
  v_empty boolean;
  v_taps jsonb := '[]'::jsonb;
  v_is_correct boolean;
  v_marks_awarded numeric;
  v_auto_graded boolean;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid()
  for update;
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  if v_sub is not null then raise exception 'You have already submitted this exam.'; end if;

  select * into v_s from exam_sessions es where es.id = p_session_id;
  if now() < v_s.opens_at then raise exception 'The exam has not started yet.'; end if;
  if v_s.finished_at is not null or now() > v_s.deadline_at + interval '20 seconds' then
    raise exception 'The exam time is over — answers are locked.';
  end if;

  select q.type, q.marks,
         case when jsonb_typeof(q.hotspot_zones) = 'array' then jsonb_array_length(q.hotspot_zones) end
    into v_type, v_marks, v_zone_count
  from quiz_questions q where q.id = p_question_id and q.quiz_id = v_s.quiz_id and not q.is_hidden;
  if v_type is null then raise exception 'That question is not part of this exam.'; end if;

  if p_selected_option_id is not null and not exists (
    select 1 from quiz_question_options o where o.id = p_selected_option_id and o.question_id = p_question_id
  ) then raise exception 'That option does not belong to this question.'; end if;

  if p_text_answer is not null and length(p_text_answer) > 20000 then raise exception 'Answer is too long.'; end if;

  if p_hotspot_taps is not null then
    if jsonb_typeof(p_hotspot_taps) <> 'array' then raise exception 'Invalid tap data.'; end if;
    if jsonb_array_length(p_hotspot_taps) > 40 then raise exception 'Too many tapped points.'; end if;

    -- Only a hotspot question carries taps. Rebuild each one from scratch:
    -- numeric x/y inside the 0-100 image space, optional boolean `correct`,
    -- optional label capped at 80 chars — nothing else the client sent survives.
    if v_type = 'hotspot' then
      select coalesce(jsonb_agg(
               jsonb_strip_nulls(jsonb_build_object(
                 'x', n.x,
                 'y', n.y,
                 'correct', case when jsonb_typeof(e.t->'correct') = 'boolean' then e.t->'correct' end,
                 'label', case when jsonb_typeof(e.t->'label') = 'string' then to_jsonb(left(e.t->>'label', 80)) end
               )) order by e.ord), '[]'::jsonb)
        into v_taps
      from jsonb_array_elements(p_hotspot_taps) with ordinality as e(t, ord),
           lateral (select
             case when jsonb_typeof(e.t) = 'object' and jsonb_typeof(e.t->'x') = 'number' and jsonb_typeof(e.t->'y') = 'number'
                  then (e.t->>'x')::numeric end as x,
             case when jsonb_typeof(e.t) = 'object' and jsonb_typeof(e.t->'x') = 'number' and jsonb_typeof(e.t->'y') = 'number'
                  then (e.t->>'y')::numeric end as y
           ) n
      where n.x between 0 and 100 and n.y between 0 and 100
        and e.ord <= coalesce(v_zone_count, 1);
    end if;
  end if;

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
    return query select null::boolean;
    return;
  end if;

  if v_type in ('mcq', 'truefalse') and p_selected_option_id is not null then
    v_is_correct := coalesce((select o.is_correct from quiz_question_options o where o.id = p_selected_option_id), false);
    v_marks_awarded := case when v_is_correct then v_marks else 0 end;
    v_auto_graded := true;
  else
    v_is_correct := null;
    v_marks_awarded := null;
    v_auto_graded := false;
  end if;

  insert into exam_answers (participant_id, question_id, selected_option_id, click_x, click_y, text_answer, image_paths, flagged, hotspot_taps, is_correct, marks_awarded, auto_graded, updated_at)
  values (v_pid, p_question_id, p_selected_option_id, p_click_x, p_click_y, nullif(p_text_answer, ''), coalesce(p_image_paths, '{}'), coalesce(p_flagged, false), v_taps, v_is_correct, v_marks_awarded, v_auto_graded, now())
  on conflict (participant_id, question_id) do update
    set selected_option_id = excluded.selected_option_id,
        click_x = excluded.click_x,
        click_y = excluded.click_y,
        text_answer = excluded.text_answer,
        image_paths = excluded.image_paths,
        flagged = excluded.flagged,
        hotspot_taps = excluded.hotspot_taps,
        is_correct = excluded.is_correct,
        marks_awarded = excluded.marks_awarded,
        auto_graded = excluded.auto_graded,
        updated_at = now();

  return query select v_is_correct;
end;
$$;

-- ── 4. last line of defence on the column itself ────────────────────────
alter table exam_answers drop constraint if exists exam_answers_hotspot_taps_shape_check;
alter table exam_answers add constraint exam_answers_hotspot_taps_shape_check
  check (jsonb_typeof(hotspot_taps) = 'array' and jsonb_array_length(hotspot_taps) <= 50) not valid;
alter table exam_answers validate constraint exam_answers_hotspot_taps_shape_check;
