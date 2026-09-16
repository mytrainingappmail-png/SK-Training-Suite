-- advance_quiz_session had no protection against a concurrent advance —
-- if the same session is hosted from two tabs/devices at once (e.g. the
-- TV screen in one tab, the admin also monitoring from their phone in
-- another), or if the host's own client-side timer and a participant's
-- heartbeat-triggered auto-advance (quiz_participant_heartbeat, which IS
-- already guarded this way) both fire within the same moment, two calls
-- could each read the same current_question_index and both advance it —
-- skipping a whole question. Fixes it the same way the heartbeat already
-- does: the final UPDATE only applies if current_question_index still
-- matches what was just read; if another call already moved it, this one
-- treats that as success too (returns the question that's actually live
-- now) rather than blindly advancing again on top of it.
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
  v_phase_after text;
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
    update quiz_sessions
    set phase = 'ended', ended_at = now()
    where id = p_session_id and current_question_index = v_idx and phase <> 'ended';
  else
    update quiz_sessions
    set phase = 'question', current_question_index = v_next_index, question_started_at = now()
    where id = p_session_id and current_question_index = v_idx;
  end if;

  -- Whether this call's own update matched or another concurrent call
  -- already moved things along, report back whatever is actually true
  -- right now rather than what THIS call assumed it just did.
  select phase into v_phase_after from quiz_sessions where id = p_session_id;
  return v_phase_after;
end;
$function$;
