-- Same server-clock discipline as start/advance/pause/resume — endSession()
-- (the host's explicit "🛑 End" button) was the one remaining place still
-- stamping a session timestamp (ended_at) from the client's own Date.now().
-- Lower stakes than question_started_at (nothing times out based on
-- ended_at), but there's no reason to leave one client-clock-dependent
-- write sitting next to four server-authoritative ones.
create or replace function end_quiz_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update quiz_sessions
  set phase = 'ended', ended_at = now()
  where id = p_session_id
    and company_id = current_quiz_admin_company_id()
    and current_quiz_admin_can_edit();

  if not found then
    raise exception 'Session not found or not authorized.';
  end if;
end;
$function$;
