-- Live Quiz host: live right / wrong / answered per player, and Stop / Start (resume) for ONE player.
--
--  * get_quiz_live_admin      how many questions each player has answered so far and how many of those are right and wrong.
--  * stop_quiz_participant    the host pauses one player (indiscipline); resume_quiz_participant lets them play again.
--                             While paused the database itself refuses that player's answers, so going offline or editing
--                             the page cannot get round it. The quiz keeps moving for everyone else.
--  * get_quiz_my_control      what the player's own phone asks every few seconds to know whether it was paused.
-- Marks and ranking are untouched; a paused player simply gets no answer recorded for the questions that pass meanwhile.

alter table quiz_participants add column if not exists stopped_at timestamptz;
alter table quiz_participants add column if not exists stop_reason text;

create or replace function quiz_block_stopped_answers() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from quiz_participants qp where qp.id = new.participant_id and qp.stopped_at is not null) then
    raise exception 'The host has paused you. Please wait — you can play again when they resume you.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quiz_block_stopped_answers on quiz_answers;
create trigger trg_quiz_block_stopped_answers before insert on quiz_answers
  for each row execute function quiz_block_stopped_answers();

create or replace function stop_quiz_participant(p_participant_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
  v_phase text;
begin
  select qs.company_id, qs.phase into v_company, v_phase
  from quiz_participants qp join quiz_sessions qs on qs.id = qp.session_id
  where qp.id = p_participant_id;
  if v_company is null then raise exception 'Player not found.'; end if;
  if v_company is distinct from current_quiz_admin_company_id() or not current_quiz_admin_can_edit() then
    raise exception 'You are not allowed to do this.';
  end if;
  if v_phase = 'ended' then raise exception 'The quiz has already ended.'; end if;
  update quiz_participants set stopped_at = now(), stop_reason = nullif(trim(coalesce(p_reason, '')), '') where id = p_participant_id;
end;
$$;

create or replace function resume_quiz_participant(p_participant_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
begin
  select qs.company_id into v_company
  from quiz_participants qp join quiz_sessions qs on qs.id = qp.session_id
  where qp.id = p_participant_id;
  if v_company is null then raise exception 'Player not found.'; end if;
  if v_company is distinct from current_quiz_admin_company_id() or not current_quiz_admin_can_edit() then
    raise exception 'You are not allowed to do this.';
  end if;
  update quiz_participants set stopped_at = null, stop_reason = null where id = p_participant_id;
end;
$$;

create or replace function get_quiz_my_control(p_session_id uuid)
returns table (stopped boolean, stop_reason text)
language sql stable security definer set search_path = public as $$
  select (qp.stopped_at is not null), qp.stop_reason
  from quiz_participants qp
  where qp.session_id = p_session_id and qp.auth_user_id = auth.uid();
$$;

create or replace function get_quiz_live_admin(p_session_id uuid)
returns table (participant_id uuid, answered_count int, correct_count int, wrong_count int, stopped_at timestamptz, stop_reason text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from quiz_sessions s where s.id = p_session_id and s.company_id = current_quiz_admin_company_id()) then
    raise exception 'Session not found or not authorized.';
  end if;
  return query
  select qp.id,
    count(a.id)::int,
    (count(a.id) filter (where a.is_correct))::int,
    (count(a.id) filter (where not coalesce(a.is_correct, false)))::int,
    qp.stopped_at,
    qp.stop_reason
  from quiz_participants qp
  left join quiz_answers a on a.participant_id = qp.id and a.session_id = p_session_id
  where qp.session_id = p_session_id
  group by qp.id, qp.stopped_at, qp.stop_reason, qp.joined_at
  order by qp.joined_at;
end;
$$;

revoke all on function stop_quiz_participant(uuid, text) from public;
revoke all on function resume_quiz_participant(uuid) from public;
revoke all on function get_quiz_my_control(uuid) from public;
revoke all on function get_quiz_live_admin(uuid) from public;
grant execute on function stop_quiz_participant(uuid, text) to authenticated;
grant execute on function resume_quiz_participant(uuid) to authenticated;
grant execute on function get_quiz_my_control(uuid) to authenticated;
grant execute on function get_quiz_live_admin(uuid) to authenticated;
