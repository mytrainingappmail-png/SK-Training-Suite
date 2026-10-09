-- Recycle Bin for Live Quiz admins. Deleting a quiz / exam, a live-quiz or exam session (with all its results), or a
-- survey (with its responses) no longer destroys it at once: the full record is copied into recycle_bin first, kept for
-- 30 days, and can be restored with one click (Live Quiz → Bin). It happens inside the database, so every way of
-- deleting is covered — single delete, bulk delete, "Delete All" — without changing any of the screens that delete.
--
-- recycle_bin.company_id deliberately has no foreign key: when a whole company is removed its rows cascade away and the
-- bin must not block that.

create table if not exists recycle_bin (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  entity_type text not null check (entity_type in ('quiz', 'quiz_session', 'exam_session', 'survey')),
  entity_id uuid not null,
  title text not null default '',
  subtitle text not null default '',
  payload jsonb not null,
  deleted_by uuid,
  deleted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists idx_recycle_bin_company on recycle_bin (company_id, deleted_at desc);

alter table recycle_bin enable row level security;

drop policy if exists recycle_bin_admin_read on recycle_bin;
create policy recycle_bin_admin_read on recycle_bin
  for select using (company_id = current_quiz_admin_company_id());

drop policy if exists recycle_bin_admin_delete on recycle_bin;
create policy recycle_bin_admin_delete on recycle_bin
  for delete using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());

-- ── Copy a record into the bin just before it is deleted ───────────────────────────────────────────────────────────

create or replace function recycle_quiz() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into recycle_bin (company_id, entity_type, entity_id, title, subtitle, payload, deleted_by)
  values (
    old.company_id, 'quiz', old.id, coalesce(old.title, ''), case when old.mode = 'exam' then 'Exam' else 'Quiz' end,
    jsonb_build_object(
      'quiz', to_jsonb(old),
      'questions', coalesce((select jsonb_agg(to_jsonb(q) order by q.display_order) from quiz_questions q where q.quiz_id = old.id), '[]'::jsonb),
      'options', coalesce((select jsonb_agg(to_jsonb(o)) from quiz_question_options o where o.question_id in (select id from quiz_questions where quiz_id = old.id)), '[]'::jsonb)
    ),
    auth.uid()
  );
  return old;
end;
$$;

create or replace function recycle_quiz_session() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  select title into v_title from quizzes where id = old.quiz_id;
  -- deleted together with its quiz: the quiz is already in the bin, take the name from there
  if v_title is null then
    select rb.title into v_title from recycle_bin rb where rb.entity_type = 'quiz' and rb.entity_id = old.quiz_id order by rb.deleted_at desc limit 1;
  end if;
  insert into recycle_bin (company_id, entity_type, entity_id, title, subtitle, payload, deleted_by)
  values (
    old.company_id, 'quiz_session', old.id, coalesce(v_title, 'Quiz session'),
    'Live quiz results · ' || to_char(coalesce(old.ended_at, old.created_at), 'DD Mon YYYY'),
    jsonb_build_object(
      'session', to_jsonb(old),
      'participants', coalesce((select jsonb_agg(to_jsonb(p)) from quiz_participants p where p.session_id = old.id), '[]'::jsonb),
      'answers', coalesce((select jsonb_agg(to_jsonb(a)) from quiz_answers a where a.session_id = old.id), '[]'::jsonb)
    ),
    auth.uid()
  );
  return old;
end;
$$;

create or replace function recycle_exam_session() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  select title into v_title from quizzes where id = old.quiz_id;
  if v_title is null then
    select rb.title into v_title from recycle_bin rb where rb.entity_type = 'quiz' and rb.entity_id = old.quiz_id order by rb.deleted_at desc limit 1;
  end if;
  insert into recycle_bin (company_id, entity_type, entity_id, title, subtitle, payload, deleted_by)
  values (
    old.company_id, 'exam_session', old.id, coalesce(v_title, 'Exam session'),
    'Exam results · ' || to_char(old.created_at, 'DD Mon YYYY'),
    jsonb_build_object(
      'session', to_jsonb(old),
      'participants', coalesce((select jsonb_agg(to_jsonb(p)) from exam_participants p where p.session_id = old.id), '[]'::jsonb),
      'answers', coalesce((select jsonb_agg(to_jsonb(a)) from exam_answers a where a.participant_id in (select id from exam_participants where session_id = old.id)), '[]'::jsonb)
    ),
    auth.uid()
  );
  return old;
end;
$$;

create or replace function recycle_survey() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into recycle_bin (company_id, entity_type, entity_id, title, subtitle, payload, deleted_by)
  values (
    old.company_id, 'survey', old.id, coalesce(old.title, ''), 'Survey',
    jsonb_build_object(
      'survey', to_jsonb(old),
      'questions', coalesce((select jsonb_agg(to_jsonb(q) order by q.display_order) from survey_questions q where q.survey_id = old.id), '[]'::jsonb),
      'options', coalesce((select jsonb_agg(to_jsonb(o)) from survey_question_options o where o.question_id in (select id from survey_questions where survey_id = old.id)), '[]'::jsonb),
      'sessions', coalesce((select jsonb_agg(to_jsonb(s)) from survey_sessions s where s.survey_id = old.id), '[]'::jsonb),
      'session_participants', coalesce((select jsonb_agg(to_jsonb(sp)) from survey_session_participants sp where sp.session_id in (select id from survey_sessions where survey_id = old.id)), '[]'::jsonb),
      'responses', coalesce((select jsonb_agg(to_jsonb(r)) from survey_responses r where r.survey_id = old.id), '[]'::jsonb),
      'answers', coalesce((select jsonb_agg(to_jsonb(a)) from survey_answers a where a.response_id in (select id from survey_responses where survey_id = old.id)), '[]'::jsonb)
    ),
    auth.uid()
  );
  return old;
end;
$$;

drop trigger if exists trg_recycle_quiz on quizzes;
create trigger trg_recycle_quiz before delete on quizzes for each row execute function recycle_quiz();
drop trigger if exists trg_recycle_quiz_session on quiz_sessions;
create trigger trg_recycle_quiz_session before delete on quiz_sessions for each row execute function recycle_quiz_session();
drop trigger if exists trg_recycle_exam_session on exam_sessions;
create trigger trg_recycle_exam_session before delete on exam_sessions for each row execute function recycle_exam_session();
drop trigger if exists trg_recycle_survey on surveys;
create trigger trg_recycle_survey before delete on surveys for each row execute function recycle_survey();

-- ── Restore ────────────────────────────────────────────────────────────────────────────────────────────────────────

create or replace function restore_from_recycle_bin(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  b recycle_bin%rowtype;
  v_quiz uuid;
begin
  select * into b from recycle_bin where id = p_id;
  if not found then raise exception 'That item is no longer in the bin.'; end if;
  if b.company_id is distinct from current_quiz_admin_company_id() or not current_quiz_admin_can_edit() then
    raise exception 'You are not allowed to restore this.';
  end if;

  if b.entity_type = 'quiz' then
    insert into quizzes select (jsonb_populate_record(null::quizzes, b.payload->'quiz')).*;
    insert into quiz_questions select * from jsonb_populate_recordset(null::quiz_questions, b.payload->'questions');
    insert into quiz_question_options select * from jsonb_populate_recordset(null::quiz_question_options, b.payload->'options');

  elsif b.entity_type = 'quiz_session' then
    v_quiz := (b.payload->'session'->>'quiz_id')::uuid;
    if not exists (select 1 from quizzes where id = v_quiz) then
      raise exception 'The quiz these results belong to was deleted too — restore that quiz first, then these results.';
    end if;
    insert into quiz_sessions select (jsonb_populate_record(null::quiz_sessions, b.payload->'session')).*;
    insert into quiz_participants select * from jsonb_populate_recordset(null::quiz_participants, b.payload->'participants');
    insert into quiz_answers select * from jsonb_populate_recordset(null::quiz_answers, b.payload->'answers');

  elsif b.entity_type = 'exam_session' then
    v_quiz := (b.payload->'session'->>'quiz_id')::uuid;
    if not exists (select 1 from quizzes where id = v_quiz) then
      raise exception 'The exam these results belong to was deleted too — restore that exam first, then these results.';
    end if;
    insert into exam_sessions select (jsonb_populate_record(null::exam_sessions, b.payload->'session')).*;
    insert into exam_participants select * from jsonb_populate_recordset(null::exam_participants, b.payload->'participants');
    insert into exam_answers select * from jsonb_populate_recordset(null::exam_answers, b.payload->'answers');

  elsif b.entity_type = 'survey' then
    insert into surveys select (jsonb_populate_record(null::surveys, b.payload->'survey')).*;
    insert into survey_questions select * from jsonb_populate_recordset(null::survey_questions, b.payload->'questions');
    insert into survey_question_options select * from jsonb_populate_recordset(null::survey_question_options, b.payload->'options');
    insert into survey_sessions select * from jsonb_populate_recordset(null::survey_sessions, b.payload->'sessions');
    insert into survey_session_participants select * from jsonb_populate_recordset(null::survey_session_participants, b.payload->'session_participants');
    insert into survey_responses select * from jsonb_populate_recordset(null::survey_responses, b.payload->'responses');
    insert into survey_answers select * from jsonb_populate_recordset(null::survey_answers, b.payload->'answers');
  end if;

  delete from recycle_bin where id = p_id;
  return b.title;
exception
  when unique_violation then
    raise exception 'It looks like this was already restored.';
end;
$$;

-- Old entries are cleared whenever someone opens the bin.
create or replace function purge_recycle_bin() returns void
language sql security definer set search_path = public as $$
  delete from recycle_bin where expires_at < now();
$$;

revoke all on function restore_from_recycle_bin(uuid) from public;
revoke all on function purge_recycle_bin() from public;
grant execute on function restore_from_recycle_bin(uuid) to authenticated;
grant execute on function purge_recycle_bin() to authenticated;
