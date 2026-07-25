-- ============================================================================
-- LIVE QUIZ MODULE — Phase 1 (foundation + core host/join/play/results loop)
--
-- Optional, paid, per-company premium add-on (companies.live_quiz_enabled),
-- same on/off pattern as market_analytics_enabled — only the platform
-- operator can flip it (companies_update_platform_operator already covers
-- this; no new company-level RLS policy needed here).
--
-- Deliberately isolated from core LMS data: its own admin identity
-- (quiz_admins, backed by a SEPARATE Supabase Auth user pool via the
-- internal email pattern "quiz.{companycode}.{username}@internal.sktraining",
-- never employees/auth_user_id), its own roster (quiz_roster, not FK'd to
-- employees), so the whole module stays genuinely removable.
--
-- SECURITY DESIGN (deliberately stronger than the reference app this is
-- modeled on, which sent full quiz data — including which option is
-- correct — to every browser up front, and trusted the CLIENT to report
-- its own score):
--   * quiz_questions / quiz_question_options are readable ONLY by the
--     quiz_admins of the owning company. Participants NEVER get direct
--     table access to them.
--   * Participants join anonymously via supabase.auth.signInAnonymously()
--     on a SEPARATE Supabase client instance (see src/lib/supabaseQuiz.ts),
--     so every participant action is still tied to a real auth.uid().
--   * All participant-facing question/answer flow goes through SECURITY
--     DEFINER RPCs (find_quiz_session_by_pin, join_quiz_session,
--     get_current_quiz_question, submit_quiz_answer) so a participant's
--     browser is only ever shown the CURRENT question, never told which
--     option is correct until after they answer, and correctness/scoring
--     is computed server-side, not trusted from the client.
-- ============================================================================

-- ── Feature flag ─────────────────────────────────────────────────────────
alter table companies add column if not exists live_quiz_enabled boolean not null default false;
-- companies_update_platform_operator (added by the market-analytics
-- migration) already permits the platform operator to update ANY column
-- on companies, including this new one — no additional policy needed.

-- ── Quiz admin identity (separate auth pool) ────────────────────────────
create table if not exists quiz_admins (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  auth_user_id uuid unique,
  username text not null,
  display_name text not null default '',
  role text not null default 'admin' check (role in ('super_admin','admin')),
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  unique (company_id, username)
);
create index if not exists idx_quiz_admins_company on quiz_admins (company_id);

create or replace function current_quiz_admin_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from quiz_admins
  where auth_user_id = auth.uid() and status = 'active'
  limit 1;
$$;

create or replace function current_quiz_admin_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from quiz_admins
  where auth_user_id = auth.uid() and status = 'active'
  limit 1;
$$;

alter table quiz_admins enable row level security;
drop policy if exists quiz_admins_company_scoped on quiz_admins;
create policy quiz_admins_company_scoped on quiz_admins
  for all using (company_id = current_quiz_admin_company_id())
  with check (company_id = current_quiz_admin_company_id());
-- A brand-new company's very first quiz admin can't satisfy the policy
-- above yet (no row exists for current_quiz_admin_company_id() to find) —
-- that bootstrap insert always goes through the provision-quiz-admin-auth
-- edge function using the service role key, which bypasses RLS entirely,
-- exactly like provision-employee-auth already does for employees.

-- ── Quiz content ─────────────────────────────────────────────────────────
create table if not exists quiz_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  created_by uuid references quiz_admins(id) on delete set null,
  title text not null,
  description text not null default '',
  category_id uuid references quiz_categories(id) on delete set null,
  difficulty text not null default 'Medium' check (difficulty in ('Easy','Medium','Hard')),
  default_timer_seconds int not null default 30 check (default_timer_seconds between 5 and 300),
  passing_score_pct int not null default 60 check (passing_score_pct between 1 and 100),
  improve_threshold_pct int not null default 40 check (improve_threshold_pct between 1 and 100),
  shuffle_options boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_quizzes_company on quizzes (company_id);

create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  question_text text not null,
  type text not null default 'mcq' check (type in ('mcq','truefalse')),
  timer_seconds int,
  marks int not null default 1 check (marks >= 1),
  explanation text not null default '',
  display_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_quiz_questions_quiz on quiz_questions (quiz_id, display_order);

create table if not exists quiz_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references quiz_questions(id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  display_order int not null default 0
);
create index if not exists idx_quiz_options_question on quiz_question_options (question_id);

-- ── Strict-join-mode trainee directory (standalone, not FK'd to employees) ──
create table if not exists quiz_roster (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_code text not null default '',
  name text not null,
  phone text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_quiz_roster_company on quiz_roster (company_id);

alter table quiz_categories enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_question_options enable row level security;
alter table quiz_roster enable row level security;

drop policy if exists quiz_categories_admin_scoped on quiz_categories;
create policy quiz_categories_admin_scoped on quiz_categories
  for all using (company_id = current_quiz_admin_company_id())
  with check (company_id = current_quiz_admin_company_id());

drop policy if exists quizzes_admin_scoped on quizzes;
create policy quizzes_admin_scoped on quizzes
  for all using (company_id = current_quiz_admin_company_id())
  with check (company_id = current_quiz_admin_company_id());

drop policy if exists quiz_questions_admin_scoped on quiz_questions;
create policy quiz_questions_admin_scoped on quiz_questions
  for all using (quiz_id in (select id from quizzes where company_id = current_quiz_admin_company_id()))
  with check (quiz_id in (select id from quizzes where company_id = current_quiz_admin_company_id()));

drop policy if exists quiz_options_admin_scoped on quiz_question_options;
create policy quiz_options_admin_scoped on quiz_question_options
  for all using (question_id in (
    select qq.id from quiz_questions qq
    join quizzes qz on qz.id = qq.quiz_id
    where qz.company_id = current_quiz_admin_company_id()
  ))
  with check (question_id in (
    select qq.id from quiz_questions qq
    join quizzes qz on qz.id = qq.quiz_id
    where qz.company_id = current_quiz_admin_company_id()
  ));

drop policy if exists quiz_roster_admin_scoped on quiz_roster;
create policy quiz_roster_admin_scoped on quiz_roster
  for all using (company_id = current_quiz_admin_company_id())
  with check (company_id = current_quiz_admin_company_id());

-- ── Live sessions ────────────────────────────────────────────────────────
create table if not exists quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  host_admin_id uuid references quiz_admins(id) on delete set null,
  pin text not null,
  phase text not null default 'lobby' check (phase in ('lobby','question','paused','ended')),
  current_question_index int not null default 0,
  join_mode text not null default 'open' check (join_mode in ('open','strict')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_quiz_sessions_company on quiz_sessions (company_id);
-- PINs only need to be unique among currently-active sessions — once a
-- session ends its PIN is free to be reused, same as the reference app.
create unique index if not exists uq_quiz_sessions_active_pin on quiz_sessions (pin) where phase <> 'ended';

create table if not exists quiz_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  auth_user_id uuid not null,
  display_name text not null,
  score int not null default 0,
  correct_count int not null default 0,
  joined_at timestamptz not null default now(),
  unique (session_id, auth_user_id)
);
create index if not exists idx_quiz_participants_session on quiz_participants (session_id);

create table if not exists quiz_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references quiz_sessions(id) on delete cascade,
  participant_id uuid not null references quiz_participants(id) on delete cascade,
  question_id uuid not null references quiz_questions(id) on delete cascade,
  selected_option_id uuid references quiz_question_options(id) on delete set null,
  is_correct boolean not null default false,
  response_time_ms int not null default 0,
  answered_at timestamptz not null default now(),
  unique (participant_id, question_id)
);
create index if not exists idx_quiz_answers_session on quiz_answers (session_id);

alter table quiz_sessions enable row level security;
alter table quiz_participants enable row level security;
alter table quiz_answers enable row level security;

-- Sessions: the host's own company sees everything; a participant sees
-- only sessions they have actually joined (their quiz_participants row
-- is created by the join_quiz_session RPC below, itself SECURITY DEFINER
-- so it doesn't need its own session-select policy to run).
drop policy if exists quiz_sessions_visible on quiz_sessions;
create policy quiz_sessions_visible on quiz_sessions
  for select using (
    company_id = current_quiz_admin_company_id()
    or id in (select session_id from quiz_participants where auth_user_id = auth.uid())
  );

drop policy if exists quiz_sessions_admin_write on quiz_sessions;
create policy quiz_sessions_admin_write on quiz_sessions
  for insert with check (company_id = current_quiz_admin_company_id());
drop policy if exists quiz_sessions_admin_update on quiz_sessions;
create policy quiz_sessions_admin_update on quiz_sessions
  for update using (company_id = current_quiz_admin_company_id())
  with check (company_id = current_quiz_admin_company_id());

-- Participants: visible to the host, and to any fellow participant of the
-- SAME session (needed for the live leaderboard/podium everyone sees).
drop policy if exists quiz_participants_visible on quiz_participants;
create policy quiz_participants_visible on quiz_participants
  for select using (
    session_id in (select id from quiz_sessions where company_id = current_quiz_admin_company_id())
    or session_id in (select session_id from quiz_participants qp2 where qp2.auth_user_id = auth.uid())
  );
-- Row creation always goes through join_quiz_session (SECURITY DEFINER);
-- this direct-insert policy exists only as a defence-in-depth backstop.
drop policy if exists quiz_participants_self_insert on quiz_participants;
create policy quiz_participants_self_insert on quiz_participants
  for insert with check (auth_user_id = auth.uid());
drop policy if exists quiz_participants_self_update on quiz_participants;
create policy quiz_participants_self_update on quiz_participants
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Answers: visible to the host and to the answering participant only
-- (their own answer review at end of quiz). Writes always go through
-- submit_quiz_answer (SECURITY DEFINER) which computes correctness
-- server-side — no direct insert/update policy is granted at all, so a
-- participant's browser cannot self-report a fake "correct" answer.
drop policy if exists quiz_answers_visible on quiz_answers;
create policy quiz_answers_visible on quiz_answers
  for select using (
    session_id in (select id from quiz_sessions where company_id = current_quiz_admin_company_id())
    or participant_id in (select id from quiz_participants where auth_user_id = auth.uid())
  );

-- ── Results view (computed, not duplicated storage) ─────────────────────
create or replace view quiz_session_results as
select
  qs.id as session_id,
  qs.quiz_id,
  qs.company_id,
  qz.title as quiz_title,
  qz.passing_score_pct,
  qz.improve_threshold_pct,
  qs.started_at,
  qs.ended_at,
  (select count(*) from quiz_questions qq where qq.quiz_id = qz.id) as total_questions,
  qp.id as participant_id,
  qp.display_name,
  qp.score,
  qp.correct_count,
  case when (select count(*) from quiz_questions qq where qq.quiz_id = qz.id) = 0 then 0
       else round(100.0 * qp.correct_count / (select count(*) from quiz_questions qq where qq.quiz_id = qz.id))
  end as percent_correct,
  case
    when (select count(*) from quiz_questions qq where qq.quiz_id = qz.id) = 0 then 'FAIL'
    when round(100.0 * qp.correct_count / (select count(*) from quiz_questions qq where qq.quiz_id = qz.id)) >= qz.passing_score_pct then 'PASS'
    when round(100.0 * qp.correct_count / (select count(*) from quiz_questions qq where qq.quiz_id = qz.id)) >= qz.improve_threshold_pct then 'NEED_IMPROVEMENT'
    else 'FAIL'
  end as grade
from quiz_sessions qs
join quizzes qz on qz.id = qs.quiz_id
join quiz_participants qp on qp.session_id = qs.id;

-- ── Participant-facing RPCs (SECURITY DEFINER — see security note above) ──

create or replace function find_quiz_session_by_pin(p_pin text)
returns table (session_id uuid, quiz_title text, phase text, join_mode text, company_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select qs.id, qz.title, qs.phase, qs.join_mode, qs.company_id
  from quiz_sessions qs
  join quizzes qz on qz.id = qs.quiz_id
  where qs.pin = p_pin and qs.phase <> 'ended';
$$;

create or replace function join_quiz_session(p_session_id uuid, p_display_name text)
returns table (participant_id uuid, score int, correct_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_join_mode text;
  v_company_id uuid;
  v_roster_ok boolean;
  v_existing uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to join a quiz.';
  end if;

  select join_mode, company_id into v_join_mode, v_company_id
  from quiz_sessions where id = p_session_id and phase <> 'ended';

  if v_company_id is null then
    raise exception 'This quiz session is no longer available.';
  end if;

  if v_join_mode = 'strict' then
    select exists(
      select 1 from quiz_roster
      where company_id = v_company_id and active = true
        and (lower(name) = lower(trim(p_display_name)) or lower(employee_code) = lower(trim(p_display_name)))
    ) into v_roster_ok;
    if not v_roster_ok then
      raise exception 'You are not on the registered trainee list for this quiz.';
    end if;
  end if;

  select id into v_existing from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();

  if v_existing is null then
    insert into quiz_participants (session_id, auth_user_id, display_name)
    values (p_session_id, auth.uid(), trim(p_display_name))
    returning id into v_existing;
  end if;

  return query select qp.id, qp.score, qp.correct_count from quiz_participants qp where qp.id = v_existing;
end;
$$;

create or replace function get_current_quiz_question(p_session_id uuid)
returns table (
  question_id uuid, question_text text, type text, timer_seconds int,
  question_index int, total_questions int,
  option_id uuid, option_text text, option_order int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_is_participant boolean;
  v_quiz_id uuid;
  v_idx int;
  v_qid uuid;
begin
  select exists(
    select 1 from quiz_participants where session_id = p_session_id and auth_user_id = auth.uid()
  ) into v_is_participant;
  if not v_is_participant then
    raise exception 'Not a participant in this session.';
  end if;

  select quiz_id, current_question_index into v_quiz_id, v_idx
  from quiz_sessions where id = p_session_id and phase = 'question';
  if v_quiz_id is null then
    return;
  end if;

  select qq.id into v_qid from quiz_questions qq
  where qq.quiz_id = v_quiz_id order by qq.display_order limit 1 offset v_idx;
  if v_qid is null then
    return;
  end if;

  return query
  select
    qq.id, qq.question_text, qq.type, coalesce(qq.timer_seconds, qz.default_timer_seconds),
    v_idx, (select count(*) from quiz_questions where quiz_id = v_quiz_id),
    qo.id, qo.option_text, qo.display_order
  from quiz_questions qq
  join quizzes qz on qz.id = qq.quiz_id
  join quiz_question_options qo on qo.question_id = qq.id
  where qq.id = v_qid
  order by qo.display_order;
end;
$$;

create or replace function submit_quiz_answer(
  p_session_id uuid, p_question_id uuid, p_option_id uuid, p_response_time_ms int
)
returns table (is_correct boolean, correct_option_id uuid, points_awarded int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
  v_correct boolean := false;
  v_correct_option uuid;
  v_marks int;
  v_max_timer int;
  v_points int := 0;
  v_phase text;
begin
  select id into v_participant_id from quiz_participants
  where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    raise exception 'Not a participant in this session.';
  end if;

  select phase into v_phase from quiz_sessions where id = p_session_id;
  if v_phase <> 'question' then
    raise exception 'This question is no longer accepting answers.';
  end if;

  select id into v_correct_option from quiz_question_options
  where question_id = p_question_id and is_correct = true limit 1;

  if p_option_id is not null and p_option_id = v_correct_option then
    v_correct := true;
  end if;

  select qq.marks, coalesce(qq.timer_seconds, qz.default_timer_seconds)
    into v_marks, v_max_timer
  from quiz_questions qq join quizzes qz on qz.id = qq.quiz_id
  where qq.id = p_question_id;

  if v_correct then
    v_points := v_marks * 1000 + greatest(0, round((1 - (p_response_time_ms::numeric / (v_max_timer * 1000))) * 500))::int;
  end if;

  insert into quiz_answers (session_id, participant_id, question_id, selected_option_id, is_correct, response_time_ms)
  values (p_session_id, v_participant_id, p_question_id, p_option_id, v_correct, p_response_time_ms)
  on conflict (participant_id, question_id) do nothing;

  if found then
    update quiz_participants
    set score = score + v_points, correct_count = correct_count + (case when v_correct then 1 else 0 end)
    where id = v_participant_id;
  end if;

  return query select v_correct, v_correct_option, v_points;
end;
$$;

-- ── Realtime ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quiz_sessions') then
    alter publication supabase_realtime add table quiz_sessions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quiz_participants') then
    alter publication supabase_realtime add table quiz_participants;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quiz_answers') then
    alter publication supabase_realtime add table quiz_answers;
  end if;
end $$;
