-- ============================================================================
-- OPEN TEST LINK  (no PIN, every trainee's own timer)
--
-- A trainer can switch on an "open link" for any quiz or exam. Trainees open the link (or scan the QR), type their name and
-- press Start - whenever they like, no PIN, no host. THEIR OWN timer starts the moment they press Start.
--
-- How it works: every attempt is an ordinary session of its own (one trainee), created the moment they press Start, so the
-- whole quiz / exam engine (timers, answers, grading, certificates, reveal rules, results) is used unchanged.
-- Those one-trainee sessions carry open_link_id; the session lists hide them (the trainer sees them as attempts on the link's page,
-- and the trainee rows still count in Results and the Dashboard).
--
-- Controlled by the trainer, per quiz / exam: on / off, an optional open and close time, how many attempts one name may make,
-- and whether an exam's result is shown to the trainee straight away.
-- ============================================================================

create table if not exists public.quiz_open_links (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  quiz_id         uuid not null unique references quizzes(id) on delete cascade,
  token           text not null unique default substr(md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text), 1, 16),
  enabled         boolean not null default false,
  opens_at        timestamptz,
  closes_at       timestamptz,
  max_attempts    integer check (max_attempts is null or max_attempts between 1 and 50),
  release_results text not null default 'immediate' check (release_results in ('immediate', 'manual')),
  created_at      timestamptz not null default now()
);

alter table public.quiz_open_links enable row level security;
drop policy if exists quiz_open_links_select on public.quiz_open_links;
create policy quiz_open_links_select on public.quiz_open_links for select
  using (company_id = current_quiz_admin_company_id());
drop policy if exists quiz_open_links_insert on public.quiz_open_links;
create policy quiz_open_links_insert on public.quiz_open_links for insert
  with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
drop policy if exists quiz_open_links_update on public.quiz_open_links;
create policy quiz_open_links_update on public.quiz_open_links for update
  using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit())
  with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
drop policy if exists quiz_open_links_delete on public.quiz_open_links;
create policy quiz_open_links_delete on public.quiz_open_links for delete
  using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
revoke all on public.quiz_open_links from anon;
grant select, insert, update, delete on public.quiz_open_links to authenticated;

alter table public.quiz_sessions add column if not exists open_link_id uuid references public.quiz_open_links(id) on delete set null;
alter table public.exam_sessions add column if not exists open_link_id uuid references public.quiz_open_links(id) on delete set null;
create index if not exists quiz_sessions_open_link_idx on public.quiz_sessions (open_link_id) where open_link_id is not null;
create index if not exists exam_sessions_open_link_idx on public.exam_sessions (open_link_id) where open_link_id is not null;

-- When the one trainee of an open exam attempt submits, that attempt's exam is over.
create or replace function public.open_exam_attempt_finish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.submitted_at is not null and old.submitted_at is null then
    update exam_sessions set finished_at = now()
     where id = new.session_id and open_link_id is not null and finished_at is null;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_open_exam_attempt_finish on public.exam_participants;
create trigger trg_open_exam_attempt_finish after update of submitted_at on public.exam_participants
  for each row execute function public.open_exam_attempt_finish();

-- "Show the trainee their result straight away" - only when nothing is waiting to be marked by hand.
create or replace function public.open_exam_attempt_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.finished_at is not null and old.finished_at is null and new.open_link_id is not null and not new.results_released then
    if exists (select 1 from quiz_open_links l where l.id = new.open_link_id and l.release_results = 'immediate')
       and not exists (select 1 from quiz_questions q where q.quiz_id = new.quiz_id and q.type = 'written' and not q.is_hidden) then
      update exam_sessions set results_released = true, results_released_at = now() where id = new.id;
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_open_exam_attempt_release on public.exam_sessions;
create trigger trg_open_exam_attempt_release after update of finished_at on public.exam_sessions
  for each row execute function public.open_exam_attempt_release();

-- What a trainee sees on the link page (callable before signing in).
create or replace function public.get_open_test_info(p_token text)
returns table(title text, mode text, description text, question_count integer, duration_minutes integer, pass_pct integer, status text, company_name text, max_attempts integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l quiz_open_links;
  qz quizzes;
  v_status text;
begin
  select * into l from quiz_open_links where token = p_token;
  if l.id is null then
    return query select null::text, null::text, null::text, 0, 0, 0, 'unavailable'::text, null::text, null::integer;
    return;
  end if;
  select * into qz from quizzes where id = l.quiz_id;
  v_status := case
    when not l.enabled or qz.status <> 'published' or not quiz_module_enabled_for_company(l.company_id) then 'unavailable'
    when l.opens_at is not null and now() < l.opens_at then 'not_yet'
    when l.closes_at is not null and now() >= l.closes_at then 'closed'
    else 'open' end;
  return query select qz.title::text, qz.mode::text, qz.description::text,
    (select count(*)::int from quiz_questions q where q.quiz_id = qz.id and not q.is_hidden),
    case when qz.mode = 'exam' then coalesce(qz.exam_duration_minutes, 60) else null end,
    qz.passing_score_pct, v_status,
    (select c.company_name::text from companies c where c.id = l.company_id), l.max_attempts;
end;
$$;

-- Start an attempt: creates the trainee's own session and joins them. Reopening the link while an attempt is still running
-- takes them back to it (the timer is never reset).
create or replace function public.start_open_test(p_token text, p_name text)
returns table(kind text, session_id uuid, participant_id uuid, quiz_title text)
language plpgsql
security definer
set search_path = public
as $$
declare
  l quiz_open_links;
  qz quizzes;
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_sid uuid;
  v_pid uuid;
  v_used integer;
  v_pin text;
  v_reveal boolean;
  v_fb_seconds integer;
  v_fb_size text;
  v_order uuid[];
  v_seconds integer;
  i integer;
begin
  if auth.uid() is null then raise exception 'Please try again.'; end if;
  if v_name = '' then raise exception 'Please enter your name.'; end if;
  if char_length(v_name) > 80 then raise exception 'That name is too long.'; end if;

  select * into l from quiz_open_links where token = p_token;
  if l.id is null or not l.enabled then raise exception 'This test link is not active.'; end if;
  select * into qz from quizzes where id = l.quiz_id;
  if qz.status <> 'published' or not quiz_module_enabled_for_company(l.company_id) then raise exception 'This test link is not active.'; end if;
  if l.opens_at is not null and now() < l.opens_at then raise exception 'This test has not opened yet.'; end if;
  if l.closes_at is not null and now() >= l.closes_at then raise exception 'This test is closed.'; end if;

  -- an attempt of this browser that is still running: go back to it
  if qz.mode = 'exam' then
    select es.id, ep.id into v_sid, v_pid
      from exam_sessions es join exam_participants ep on ep.session_id = es.id
     where es.open_link_id = l.id and ep.auth_user_id = auth.uid()
       and ep.submitted_at is null and es.finished_at is null and now() < es.deadline_at
     order by es.created_at desc limit 1;
    if v_sid is not null then
      return query select 'exam'::text, v_sid, v_pid, qz.title;
      return;
    end if;
  else
    select qs.id, qp.id into v_sid, v_pid
      from quiz_sessions qs join quiz_participants qp on qp.session_id = qs.id
     where qs.open_link_id = l.id and qp.auth_user_id = auth.uid() and qs.phase <> 'ended'
     order by qs.created_at desc limit 1;
    if v_sid is not null then
      return query select 'quiz'::text, v_sid, v_pid, qz.title;
      return;
    end if;
  end if;

  -- attempts allowed for one name
  if l.max_attempts is not null then
    select (select count(*) from exam_participants ep join exam_sessions es on es.id = ep.session_id
             where es.open_link_id = l.id and lower(ep.display_name) = lower(v_name))
         + (select count(*) from quiz_participants qp join quiz_sessions qs on qs.id = qp.session_id
             where qs.open_link_id = l.id and lower(qp.display_name) = lower(v_name))
      into v_used;
    if v_used >= l.max_attempts then
      raise exception 'You have already used your % attempt% of this test.', l.max_attempts, case when l.max_attempts = 1 then '' else 's' end;
    end if;
  end if;

  if qz.mode = 'exam' then
    if not exists (select 1 from quiz_questions q where q.quiz_id = qz.id and not q.is_hidden) then raise exception 'This exam has no questions yet.'; end if;
    v_seconds := greatest(60, coalesce(qz.exam_duration_minutes, 60) * 60);
    select coalesce(s.exam_reveal_answers, true), coalesce(s.exam_hotspot_feedback_seconds, 3), coalesce(s.exam_hotspot_feedback_size, 'small')
      into v_reveal, v_fb_seconds, v_fb_size
      from (select 1) one left join quiz_settings s on s.company_id = l.company_id;
    if qz.reveal_answers is not null then v_reveal := qz.reveal_answers; end if;
    for i in 1 .. 10 loop
      v_pin := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
      begin
        insert into exam_sessions (quiz_id, company_id, host_admin_id, pin, duration_seconds, opens_at, deadline_at,
                                   reveal_answers, hotspot_feedback_seconds, hotspot_feedback_size, open_link_id)
        values (qz.id, l.company_id, null, v_pin, v_seconds, now(), now() + make_interval(secs => v_seconds),
                coalesce(v_reveal, true), coalesce(v_fb_seconds, 3), coalesce(v_fb_size, 'small'), l.id)
        returning id into v_sid;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
    if v_sid is null then raise exception 'Could not start the test. Please try again.'; end if;
    insert into exam_participants (session_id, auth_user_id, display_name) values (v_sid, auth.uid(), v_name) returning id into v_pid;
    return query select 'exam'::text, v_sid, v_pid, qz.title;
  else
    select array_agg(q.id order by case when qz.shuffle_questions then random() end, q.display_order) into v_order
      from quiz_questions q where q.quiz_id = qz.id and not q.is_hidden;
    if v_order is null then raise exception 'This quiz has no questions yet.'; end if;
    select coalesce(s.quiz_reveal_answers, true) into v_reveal
      from (select 1) one left join quiz_settings s on s.company_id = l.company_id;
    if qz.reveal_answers is not null then v_reveal := qz.reveal_answers; end if;
    for i in 1 .. 10 loop
      v_pin := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
      begin
        insert into quiz_sessions (quiz_id, company_id, pin, phase, current_question_index, question_order, started_at, question_started_at,
                                   join_mode, reveal_answers, allow_early_next, open_link_id)
        values (qz.id, l.company_id, v_pin, 'question', 0, v_order, now(), now(), 'open', coalesce(v_reveal, true), true, l.id)
        returning id into v_sid;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
    if v_sid is null then raise exception 'Could not start the test. Please try again.'; end if;
    insert into quiz_participants (session_id, auth_user_id, display_name) values (v_sid, auth.uid(), v_name) returning id into v_pid;
    return query select 'quiz'::text, v_sid, v_pid, qz.title;
  end if;
end;
$$;

-- Admin: every attempt on one link (exams and quizzes alike).
create or replace function public.get_open_test_attempts(p_link_id uuid)
returns table(kind text, session_id uuid, participant_id uuid, display_name text, started_at timestamptz, finished_at timestamptz,
              status text, marks_obtained numeric, total_marks numeric, percent numeric, result text, pending_written integer, tab_switches integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l quiz_open_links;
begin
  select * into l from quiz_open_links where id = p_link_id and company_id = current_quiz_admin_company_id();
  if l.id is null then raise exception 'Link not found or not authorized.'; end if;

  return query
  select 'exam'::text, es.id, ep.id, ep.display_name, ep.joined_at, ep.submitted_at,
    case when ep.submitted_at is not null then (case when ep.submit_reason = 'timeout' then 'time_up' else 'finished' end)
         when now() < es.deadline_at then 'in_progress' else 'not_submitted' end,
    got.m, tot.m,
    case when tot.m > 0 then round(100.0 * got.m / tot.m, 1) else 0 end,
    case when ep.submitted_at is null then null
         when tot.m > 0 and round(100.0 * got.m / tot.m, 1) >= qz.passing_score_pct then 'PASS' else 'FAIL' end,
    (select count(*)::int from exam_answers a join quiz_questions q on q.id = a.question_id
      where a.participant_id = ep.id and q.type = 'written' and a.marks_awarded is null
        and (coalesce(trim(a.text_answer), '') <> '' or cardinality(a.image_paths) > 0)),
    ep.tab_switches
  from exam_sessions es
  join exam_participants ep on ep.session_id = es.id
  join quizzes qz on qz.id = es.quiz_id
  cross join lateral (select coalesce(sum(a.marks_awarded), 0)::numeric as m from exam_answers a
                        join quiz_questions hq on hq.id = a.question_id and not hq.is_hidden where a.participant_id = ep.id) got
  cross join lateral (select coalesce(sum(q.marks), 0)::numeric as m from quiz_questions q where q.quiz_id = es.quiz_id and not q.is_hidden) tot
  where es.open_link_id = l.id
  union all
  select 'quiz'::text, qs.id, qp.id, qp.display_name, qp.joined_at, case when qs.phase = 'ended' then qs.ended_at end,
    case when qs.phase = 'ended' then 'finished' else 'in_progress' end,
    r.marks_obtained::numeric, r.total_marks::numeric, r.percent_correct::numeric,
    case when qs.phase = 'ended' then r.grade end, 0, qp.tab_switch_count
  from quiz_sessions qs
  join quiz_participants qp on qp.session_id = qs.id
  left join quiz_session_results r on r.participant_id = qp.id
  where qs.open_link_id = l.id
  order by 5 desc;
end;
$$;

-- Admin: close attempts that were abandoned (browser closed) so they finish and show in results.
create or replace function public.open_test_sweep(p_link_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := current_quiz_admin_company_id();
  v_n integer := 0;
  s record;
begin
  if v_company is null then return 0; end if;
  for s in
    select es.id from exam_sessions es join quiz_open_links l on l.id = es.open_link_id
     where l.company_id = v_company and (p_link_id is null or l.id = p_link_id)
       and es.finished_at is null and es.deadline_at + interval '3 minutes' < now()
  loop
    perform exam_finalize_session(s.id, 'timeout');
    v_n := v_n + 1;
  end loop;
  update quiz_sessions qs
     set phase = 'ended', ended_at = now()
   where qs.phase <> 'ended' and qs.open_link_id is not null
     and exists (select 1 from quiz_open_links l where l.id = qs.open_link_id and l.company_id = v_company and (p_link_id is null or l.id = p_link_id))
     and coalesce((select max(p.last_seen_at) from quiz_participants p where p.session_id = qs.id), qs.question_started_at, qs.created_at) < now() - interval '15 minutes';
  return v_n;
end;
$$;

revoke all on function public.get_open_test_info(text) from public;
grant execute on function public.get_open_test_info(text) to anon, authenticated;
revoke all on function public.start_open_test(text, text) from public, anon;
grant execute on function public.start_open_test(text, text) to authenticated;
revoke all on function public.get_open_test_attempts(uuid) from public, anon;
grant execute on function public.get_open_test_attempts(uuid) to authenticated;
revoke all on function public.open_test_sweep(uuid) from public, anon;
grant execute on function public.open_test_sweep(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.quiz_move_ahead(p_session_id uuid, p_from_index integer DEFAULT NULL::integer)
 RETURNS TABLE(question_index integer, started_at timestamp with time zone, finished boolean, moved boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pid uuid; v_stopped timestamptz; v_phase text; v_allow boolean; v_order uuid[]; v_quiz uuid;
  v_idx int; v_started timestamptz; v_total int; v_qid uuid; v_timer int; v_answered boolean;
begin
  select p.id, p.stopped_at into v_pid, v_stopped
  from quiz_participants p where p.session_id = p_session_id and p.auth_user_id = auth.uid() for update;
  if v_pid is null then raise exception 'Not a participant in this session.'; end if;

  select s.phase, s.allow_early_next, s.question_order, s.quiz_id into v_phase, v_allow, v_order, v_quiz
  from quiz_sessions s where s.id = p_session_id;
  if not coalesce(v_allow, false) then raise exception 'Moving ahead is not switched on for this quiz.'; end if;
  if v_phase <> 'question' then raise exception 'The quiz is not running right now.'; end if;
  if v_stopped is not null then raise exception 'The host has paused you. Please wait — you can play again when they resume you.'; end if;

  v_total := coalesce(array_length(v_order, 1), 0);
  select e.idx, e.started_at into v_idx, v_started from quiz_effective_position(p_session_id, v_pid) e;

  -- a stale or double tap: report where the player is, change nothing
  if (p_from_index is not null and p_from_index <> v_idx) or v_idx >= v_total then
    return query select v_idx, v_started, v_idx >= v_total, false;
    return;
  end if;

  v_qid := quiz_current_question_id(p_session_id, v_pid);
  v_answered := v_qid is not null and exists (select 1 from quiz_answers a where a.participant_id = v_pid and a.question_id = v_qid);
  select coalesce(
           (select q2.timer_seconds from quiz_questions q2 where q2.id = v_order[v_idx + 1]),
           (select qq.timer_seconds from quiz_questions qq where qq.id = v_qid),
           (select qz.default_timer_seconds from quizzes qz where qz.id = v_quiz), 30)
    into v_timer;
  if not v_answered and not (v_started is not null and now() >= v_started + make_interval(secs => v_timer)) then
    raise exception 'Answer this question first.';
  end if;

  update quiz_participants
  set my_index = v_idx + 1,
      my_q_started_at = case when v_idx + 1 >= v_total then null else now() end
  where id = v_pid;

  select e.idx, e.started_at into v_idx, v_started from quiz_effective_position(p_session_id, v_pid) e;
  if v_idx >= v_total and exists (select 1 from quiz_sessions os where os.id = p_session_id and os.open_link_id is not null) then
    update quiz_sessions set phase = 'ended', ended_at = now() where id = p_session_id and phase = 'question';
  end if;
  return query select v_idx, v_started, v_idx >= v_total, true;
end $function$;

CREATE OR REPLACE FUNCTION public.quiz_participant_heartbeat(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_participant_id uuid;
  v_phase text;
  v_idx int;
  v_order uuid[];
  v_started_at timestamptz;
  v_current_qid uuid;
  v_timer_seconds int;
  v_default_timer int;
  v_total int;
begin
  select id into v_participant_id
  from quiz_participants where session_id = p_session_id and auth_user_id = auth.uid();
  if v_participant_id is null then
    return; -- not a participant of this session — silently a no-op, never an error the UI has to handle
  end if;

  -- Presence is only recorded every few seconds: each write is pushed to every
  -- screen that is watching the session.
  update quiz_participants set last_seen_at = now()
  where id = v_participant_id and (last_seen_at is null or last_seen_at < now() - interval '8 seconds');

  select qs.phase, qs.current_question_index, qs.question_order, qs.question_started_at, qz.default_timer_seconds
    into v_phase, v_idx, v_order, v_started_at, v_default_timer
  from quiz_sessions qs
  join quizzes qz on qz.id = qs.quiz_id
  where qs.id = p_session_id;

  if v_phase is distinct from 'question' or v_started_at is null or v_order is null then
    return;
  end if;

  v_total := coalesce(array_length(v_order, 1), 0);
  v_current_qid := v_order[v_idx + 1];
  select coalesce(timer_seconds, v_default_timer, 30) into v_timer_seconds
  from quiz_questions where id = v_current_qid;
  v_timer_seconds := coalesce(v_timer_seconds, v_default_timer, 30);

  -- Only a safety net: the host's own screen advances at about timer + 2.5 s
  -- (after showing the answer). Act only when the host clearly isn't doing it.
  if v_started_at + make_interval(secs => v_timer_seconds + (case when exists (select 1 from quiz_sessions os where os.id = p_session_id and os.open_link_id is not null) then 1 else 6 end)) > now() then
    return;
  end if;

  if v_idx + 1 >= v_total then
    update quiz_sessions
    set phase = 'ended', ended_at = now()
    where id = p_session_id and phase = 'question' and question_started_at = v_started_at;
  else
    update quiz_sessions
    set current_question_index = current_question_index + 1,
        question_started_at = now()
    where id = p_session_id and phase = 'question' and question_started_at = v_started_at;
  end if;
end;
$function$;


insert into help_articles (category, title, display_order, keywords, content_html)
select 'live_quiz', 'Open Test Link: Start Any Time, No PIN', 12, 'open link, no pin, any time, own timer, qr, self paced, whatsapp link, trainee start',
$art$<p>Normally a quiz or exam is run by you with a PIN and one shared start. An <strong>Open Test Link</strong> lets every trainee start the test <strong>themselves, at any time, without a PIN</strong>. Each trainee's own timer starts the moment they press <em>Start</em>.</p>
<h2>Switch it on</h2>
<ol>
<li>On the Quizzes or Exams list press <strong>🔗 Open link</strong> on the test.</li>
<li>Turn <strong>Open link</strong> on. Copy the link or show the QR code — send it on WhatsApp.</li>
</ol>
<h2>What you control</h2>
<ul>
<li><strong>On / Off</strong> — switch the link off any time; nobody can start a new attempt.</li>
<li><strong>Opens / closes</strong> — an optional start and end date and time.</li>
<li><strong>Attempts per name</strong> — for example 1, so one name cannot take the test twice.</li>
<li><strong>Exam result</strong> — show it to the trainee straight away, or only after you release it. (An exam with written answers always waits for you to mark and release.)</li>
</ul>
<h2>What trainees see</h2>
<p>They open the link, type their name and press Start. An exam gives them its full paper time from that moment; a quiz gives each question its own timer. If they reopen the link while a test is running they go back to it — the timer is never restarted.</p>
<h2>Where the results are</h2>
<p>The link page lists every attempt (name, start time, marks, result). Finished attempts also appear in <strong>Results</strong> and the <strong>Dashboard</strong>. For an exam, press <em>View / mark</em> to check or mark written answers.</p>
<p>Note: anyone who has the link can take the test, so share it only with the people it is meant for, and switch it off when you are done.</p>$art$
where not exists (select 1 from help_articles where title = 'Open Test Link: Start Any Time, No PIN');
