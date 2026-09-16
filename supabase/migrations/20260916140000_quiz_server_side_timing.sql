-- Bug: "a question appears then skips within a couple of seconds."
-- Root cause — question_started_at was written by the HOST'S OWN BROWSER
-- (new Date().toISOString(), client-side JS) in startQuiz()/advanceQuestion(),
-- but the auto-advance safety net (quiz_participant_heartbeat, called every
-- 4s by every participant's device) checks expiry against the DATABASE
-- SERVER's own clock: question_started_at + timer_seconds <= now(). If the
-- host's device clock is behind real time by any meaningful amount — a
-- genuinely common state for an unsynced laptop/phone clock — every
-- question looks like it started earlier than it really did, so the
-- heartbeat (correctly, by its own logic) treats it as already expired
-- within moments of it actually appearing.
--
-- Fix: question_started_at is now set by the DATABASE itself (now()) via
-- these RPCs, never by a client's Date.now()/new Date() — the exact same
-- trusted-clock discipline quiz_participant_heartbeat's own auto-advance
-- already used. The host's browser no longer has any say in what "now" is.
--
-- Second bug fixed here: resumeSession() never touched question_started_at
-- at all, so pausing for longer than the question's own timer and then
-- resuming left it already-expired — the very next heartbeat would skip it
-- instantly. resume_quiz_session now shifts question_started_at forward by
-- exactly how long the pause lasted, so the remaining time is preserved
-- correctly instead of either "already expired" or "reset to full time."

alter table quiz_sessions add column if not exists paused_at timestamptz;

create or replace function start_quiz_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update quiz_sessions
  set phase = 'question',
      current_question_index = 0,
      started_at = now(),
      question_started_at = now(),
      paused_at = null
  where id = p_session_id
    and company_id = current_quiz_admin_company_id()
    and current_quiz_admin_can_edit();

  if not found then
    raise exception 'Session not found or not authorized.';
  end if;
end;
$function$;

-- Mirrors quizSessionService.ts's old advanceQuestion() logic, just with
-- "what time is it" and "how many questions total" both resolved from the
-- database itself instead of trusting client-supplied values.
create or replace function advance_quiz_session(p_session_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_idx int;
  v_order uuid[];
  v_total int;
  v_next_index int;
begin
  select current_question_index, question_order into v_idx, v_order
  from quiz_sessions
  where id = p_session_id
    and company_id = current_quiz_admin_company_id()
    and current_quiz_admin_can_edit();

  if not found then
    raise exception 'Session not found or not authorized.';
  end if;

  v_total := coalesce(array_length(v_order, 1), 0);
  v_next_index := v_idx + 1;

  if v_next_index >= v_total then
    update quiz_sessions set phase = 'ended', ended_at = now() where id = p_session_id;
    return 'ended';
  end if;

  update quiz_sessions
  set phase = 'question', current_question_index = v_next_index, question_started_at = now()
  where id = p_session_id;
  return 'question';
end;
$function$;

create or replace function pause_quiz_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update quiz_sessions
  set phase = 'paused', paused_at = now()
  where id = p_session_id
    and company_id = current_quiz_admin_company_id()
    and current_quiz_admin_can_edit();

  if not found then
    raise exception 'Session not found or not authorized.';
  end if;
end;
$function$;

create or replace function resume_quiz_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_paused_at timestamptz;
  v_started_at timestamptz;
begin
  select paused_at, question_started_at into v_paused_at, v_started_at
  from quiz_sessions
  where id = p_session_id
    and company_id = current_quiz_admin_company_id()
    and current_quiz_admin_can_edit();

  if not found then
    raise exception 'Session not found or not authorized.';
  end if;

  update quiz_sessions
  set phase = 'question',
      -- Shift the question's start point forward by exactly how long the
      -- pause lasted, so whatever time was left when paused is still left
      -- now — not "already expired" (the old bug) and not "reset to the
      -- full timer" (unfair to whoever already used some of it).
      question_started_at = case
        when v_paused_at is not null and v_started_at is not null
          then v_started_at + (now() - v_paused_at)
        else v_started_at
      end,
      paused_at = null
  where id = p_session_id;
end;
$function$;
