-- Live-quiz session resilience: a server-anchored question clock plus a
-- participant heartbeat that can auto-advance/auto-end a session even if
-- the host's own browser tab stalls (backgrounded, screen-locked, etc.) —
-- previously the ENTIRE timer/auto-advance mechanism lived in a single
-- setInterval on the host's tab, with no server-side fallback at all.
-- The heartbeat also doubles as lightweight presence ("last seen Xs ago")
-- for the host's participant list.

alter table quiz_sessions add column if not exists question_started_at timestamptz;
alter table quiz_participants add column if not exists last_seen_at timestamptz;

-- Called periodically by every participant's own device while a question
-- is live. Always safe to call — it only ever advances the session when
-- the CURRENT question's timer has actually expired (checked server-side,
-- never trusts the caller), and the WHERE clause's own re-check of
-- question_started_at makes concurrent calls from many devices at once
-- naturally collapse into a single real advance instead of skipping
-- multiple questions.
drop function if exists quiz_participant_heartbeat(uuid);
create function quiz_participant_heartbeat(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
  v_phase text;
  v_idx int;
  v_order uuid[];
  v_started_at timestamptz;
  v_current_qid uuid;
  v_timer_seconds int;
  v_default_timer int;
  v_total int;
begin
  select id into v_participant_id
  from quiz_participants where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    return; -- not a participant of this session — silently a no-op, never an error the UI has to handle
  end if;

  update quiz_participants set last_seen_at = now() where id = v_participant_id;

  select qs.phase, qs.current_question_index, qs.question_order, qs.question_started_at, qz.default_timer_seconds
    into v_phase, v_idx, v_order, v_started_at, v_default_timer
  from quiz_sessions qs
  join quizzes qz on qz.id = qs.quiz_id
  where qs.id = p_session_id;

  if v_phase is distinct from 'question' or v_started_at is null or v_order is null then
    return;
  end if;

  v_total := coalesce(array_length(v_order, 1), 0);
  -- Postgres arrays are 1-indexed; current_question_index is 0-based.
  v_current_qid := v_order[v_idx + 1];
  select coalesce(timer_seconds, v_default_timer, 30) into v_timer_seconds
  from quiz_questions where id = v_current_qid;
  v_timer_seconds := coalesce(v_timer_seconds, v_default_timer, 30);

  if v_idx + 1 >= v_total then
    update quiz_sessions
    set phase = 'ended', ended_at = now()
    where id = p_session_id
      and phase = 'question'
      and question_started_at = v_started_at
      and question_started_at + make_interval(secs => v_timer_seconds) <= now();
  else
    update quiz_sessions
    set current_question_index = current_question_index + 1,
        question_started_at = now()
    where id = p_session_id
      and phase = 'question'
      and question_started_at = v_started_at
      and question_started_at + make_interval(secs => v_timer_seconds) <= now();
  end if;
end;
$$;
