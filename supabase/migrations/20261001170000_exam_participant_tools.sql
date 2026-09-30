-- Trainer tools for exam participants: fix a mistyped name, or wipe one
-- participant's attempt so they can start over (only while the exam is running).

create or replace function rename_exam_participant(p_participant_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(trim(coalesce(p_name, '')), 80);
begin
  if v_name = '' then raise exception 'Enter a name.'; end if;
  update exam_participants ep
  set display_name = v_name
  from exam_sessions es
  where ep.id = p_participant_id and es.id = ep.session_id
    and es.company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit();
  if not found then raise exception 'Participant not found or not authorized.'; end if;
end;
$$;

create or replace function reset_exam_participant(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s exam_sessions;
begin
  select es.* into v_s
  from exam_participants ep join exam_sessions es on es.id = ep.session_id
  where ep.id = p_participant_id and es.company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit();
  if v_s.id is null then raise exception 'Participant not found or not authorized.'; end if;
  if v_s.finished_at is not null or now() >= v_s.deadline_at then
    raise exception 'The exam has ended, so an attempt can no longer be reset.';
  end if;

  delete from exam_answers where participant_id = p_participant_id;
  delete from exam_tap_checks where participant_id = p_participant_id;
  update exam_participants set submitted_at = null, submit_reason = null, tab_switches = 0 where id = p_participant_id;
end;
$$;

revoke all on function rename_exam_participant(uuid, text), reset_exam_participant(uuid) from public, anon;
grant execute on function rename_exam_participant(uuid, text), reset_exam_participant(uuid) to authenticated;
