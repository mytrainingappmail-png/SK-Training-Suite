-- Retry my mistakes (exam) + Hindi (Devanagari + English) version of questions.
-- Additive only: new columns, new functions. No existing function or table is changed in behaviour.

-- ── 1. Exam: the questions this trainee got wrong, with options, for the "Practice my mistakes" screen ──────────────────────
-- Same gate as get_my_exam_result: only the trainee who submitted, and only once the trainer has released results.
-- Only choice questions (mcq / true-false) can be practised again; written and map-tap questions are left out.
create or replace function get_my_exam_mistakes(p_session_id uuid)
returns table (
  question_id uuid,
  question_order int,
  question_text text,
  explanation text,
  options jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  select * into v_s from exam_sessions es where es.id = p_session_id;
  if not v_s.results_released or v_sub is null then raise exception 'Your result is not available yet.'; end if;

  return query
  select q.id, q.display_order, q.question_text, coalesce(q.explanation, ''),
    (select coalesce(jsonb_agg(jsonb_build_object('option_id', o.id, 'option_text', o.option_text, 'is_correct', o.is_correct)
                               order by o.display_order), '[]'::jsonb)
       from quiz_question_options o where o.question_id = q.id)
  from quiz_questions q
  left join exam_answers a on a.question_id = q.id and a.participant_id = v_pid
  where q.quiz_id = v_s.quiz_id and not q.is_hidden
    and q.type in ('mcq', 'truefalse')
    and coalesce(a.is_correct, false) = false
  order by q.display_order;
end;
$$;

grant execute on function get_my_exam_mistakes(uuid) to authenticated;

-- ── 2. Hindi (Devanagari + English words) version of a question, its options and its explanation ─────────────────────────
alter table quiz_questions add column if not exists question_text_hi text;
alter table quiz_questions add column if not exists explanation_hi text;
alter table quiz_question_options add column if not exists option_text_hi text;

-- The trainee's screens already carry the English text; this only fetches the Hindi side for the questions / options the
-- screen is showing (it asks by id, so a participant can never read ahead to a question they have not reached).
-- The Hindi explanation is only given once the explanation may be seen anyway: after a live quiz has ended, or after an
-- exam's results are released to the trainee who submitted.
create or replace function get_my_translations(p_session_id uuid, p_ids uuid[])
returns table (
  question_id uuid,
  question_text_hi text,
  explanation_hi text,
  option_id uuid,
  option_text_hi text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quiz uuid;
  v_reveal boolean := false;
begin
  select s.quiz_id, (s.ended_at is not null) into v_quiz, v_reveal
  from quiz_sessions s
  where s.id = p_session_id
    and exists (select 1 from quiz_participants p where p.session_id = s.id and p.auth_user_id = auth.uid());

  if v_quiz is null then
    select s.quiz_id, (s.results_released and exists (
             select 1 from exam_participants p
             where p.session_id = s.id and p.auth_user_id = auth.uid() and p.submitted_at is not null))
      into v_quiz, v_reveal
    from exam_sessions s
    where s.id = p_session_id
      and exists (select 1 from exam_participants p where p.session_id = s.id and p.auth_user_id = auth.uid());
  end if;

  if v_quiz is null then raise exception 'You have not joined this session.'; end if;

  return query
  select q.id,
         q.question_text_hi,
         case when v_reveal then q.explanation_hi else null end,
         o.id,
         o.option_text_hi
  from quiz_questions q
  left join quiz_question_options o on o.question_id = q.id
  where q.quiz_id = v_quiz
    and (q.id = any (p_ids) or o.id = any (p_ids))
    and (q.question_text_hi is not null or q.explanation_hi is not null or o.option_text_hi is not null);
end;
$$;

grant execute on function get_my_translations(uuid, uuid[]) to authenticated;

-- ── 3. Live quiz lobby: wait music + a start countdown ───────────────────────────────────────────────────────────────────
-- The trainer's default music for quiz lobbies (same three choices as the exam lobby: built-in chime / own link / off).
alter table quiz_settings
  add column if not exists quiz_lobby_music text not null default 'builtin',
  add column if not exists quiz_lobby_music_url text,
  add column if not exists quiz_lobby_music_volume int not null default 60;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quiz_lobby_music_check') then
    alter table quiz_settings add constraint quiz_lobby_music_check check (quiz_lobby_music in ('builtin', 'custom', 'off'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quiz_lobby_music_volume_check') then
    alter table quiz_settings add constraint quiz_lobby_music_volume_check check (quiz_lobby_music_volume between 0 and 100);
  end if;
end $$;

-- A session keeps the music it had when it was launched (the players read the session row), and an optional start time.
alter table quiz_sessions
  add column if not exists lobby_music text,
  add column if not exists lobby_music_url text,
  add column if not exists lobby_music_volume int,
  add column if not exists scheduled_start_at timestamptz;

-- The host sets "start in N seconds" (or clears it with 0) while the quiz is still in the lobby. The time is stamped by the
-- database's own clock, so every phone counts down to the same moment. The host's screen starts the quiz when it reaches zero.
create or replace function set_quiz_start_timer(p_session_id uuid, p_seconds int)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_at timestamptz;
begin
  v_at := case when coalesce(p_seconds, 0) > 0 then now() + make_interval(secs => least(p_seconds, 86400)) else null end;

  update quiz_sessions
  set scheduled_start_at = v_at
  where id = p_session_id
    and phase = 'lobby'
    and company_id = current_quiz_admin_company_id()
    and current_quiz_admin_can_edit();

  if not found then
    raise exception 'Session not found, already started, or not authorized.';
  end if;
  return v_at;
end;
$$;

grant execute on function set_quiz_start_timer(uuid, int) to authenticated;
