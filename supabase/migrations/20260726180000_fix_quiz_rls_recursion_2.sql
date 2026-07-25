-- ============================================================================
-- LIVE QUIZ MODULE — quiz_participants_visible STILL raised "infinite
-- recursion detected in policy" after the previous fix, because its
-- second OR clause queried quiz_participants directly (a same-table
-- subquery inside quiz_participants' own policy) — Postgres re-applies
-- RLS to that inner query too, which re-enters the same policy per row.
-- Same underlying gotcha as the cross-table case, just same-table this
-- time. Fix: route EVERY remaining raw subquery in these policies
-- through a SECURITY DEFINER helper (which bypasses RLS internally), not
-- just the cross-table ones.
-- ============================================================================

create or replace function is_my_quiz_participant(p_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from quiz_participants where id = p_participant_id and auth_user_id = auth.uid());
$$;

drop policy if exists quiz_participants_visible on quiz_participants;
create policy quiz_participants_visible on quiz_participants
  for select using (
    quiz_session_company_id(session_id) = current_quiz_admin_company_id()
    or is_quiz_session_participant(session_id)
  );

drop policy if exists quiz_answers_visible on quiz_answers;
create policy quiz_answers_visible on quiz_answers
  for select using (
    quiz_session_company_id(session_id) = current_quiz_admin_company_id()
    or is_my_quiz_participant(participant_id)
  );
