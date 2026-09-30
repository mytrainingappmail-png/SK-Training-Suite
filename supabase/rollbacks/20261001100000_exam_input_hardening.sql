-- Rollback for 20261001100000_exam_input_hardening.sql
-- Restores the pre-hardening definitions. save_exam_answer's previous
-- definition is the one in 20260930100000_exam_answer_reveal.sql — re-run
-- that file's `create or replace function save_exam_answer(...)` block.

alter table exam_answers drop constraint if exists exam_answers_hotspot_taps_shape_check;

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
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  if v_sub is not null then return; end if;

  update exam_participants
  set submitted_at = now(), submit_reason = case when p_reason = 'timeout' then 'timeout' else 'manual' end
  where id = v_pid;
  perform exam_grade_participant(v_pid);
end;
$$;

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
    perform exam_grade_participant(v_pid);
  end loop;
  update exam_sessions set finished_at = now() where id = p_session_id and finished_at is null;
end;
$$;

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
