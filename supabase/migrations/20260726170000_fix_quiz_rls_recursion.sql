-- ============================================================================
-- LIVE QUIZ MODULE — fix "infinite recursion detected in policy" on
-- quiz_sessions / quiz_participants.
--
-- quiz_sessions_visible referenced quiz_participants in its own USING
-- expression, and quiz_participants_visible referenced quiz_sessions
-- right back — a genuine cross-table policy cycle (not the harmless
-- same-table self-reference quiz_participants_visible ALSO has, which is
-- fine on its own). Postgres detects and rejects that cycle at evaluation
-- time. Fixed the same way current_quiz_admin_company_id() already
-- avoids self-recursion on quiz_admins: SECURITY DEFINER helper
-- functions that look up the other table directly, bypassing ITS RLS
-- instead of re-entering the policy graph.
-- ============================================================================

create or replace function is_quiz_session_participant(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from quiz_participants where session_id = p_session_id and auth_user_id = auth.uid()
  );
$$;

create or replace function quiz_session_company_id(p_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from quiz_sessions where id = p_session_id;
$$;

drop policy if exists quiz_sessions_visible on quiz_sessions;
create policy quiz_sessions_visible on quiz_sessions
  for select using (
    company_id = current_quiz_admin_company_id()
    or is_quiz_session_participant(id)
  );

drop policy if exists quiz_participants_visible on quiz_participants;
create policy quiz_participants_visible on quiz_participants
  for select using (
    quiz_session_company_id(session_id) = current_quiz_admin_company_id()
    or session_id in (select session_id from quiz_participants qp2 where qp2.auth_user_id = auth.uid())
  );

drop policy if exists quiz_answers_visible on quiz_answers;
create policy quiz_answers_visible on quiz_answers
  for select using (
    quiz_session_company_id(session_id) = current_quiz_admin_company_id()
    or participant_id in (select id from quiz_participants where auth_user_id = auth.uid())
  );
