-- ============================================================================
-- LOCATIONS for the Live Quiz / Exam module
--
-- The trainer keeps their own list of locations (Mohali, Gurgaon, ... - nothing is built in; add as many as needed).
-- A quiz or exam can be given a location. The admin screens then have a location switch: pick "Mohali" and only
-- Mohali's quizzes and exams show, and the Results and Dashboard show only Mohali's sessions. "All locations" shows everything.
--
-- A session (a quiz that was run) remembers the location its quiz had AT THE TIME it was launched, so changing a quiz's
-- location later never rewrites old results.
-- ============================================================================

create table if not exists public.quiz_locations (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  name          text not null,
  active        boolean not null default true,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint quiz_locations_name_len check (char_length(btrim(name)) between 1 and 60)
);

create unique index if not exists quiz_locations_company_name on public.quiz_locations (company_id, lower(btrim(name)));

alter table public.quiz_locations enable row level security;

drop policy if exists quiz_locations_select on public.quiz_locations;
create policy quiz_locations_select on public.quiz_locations for select
  using (company_id = current_quiz_admin_company_id());
drop policy if exists quiz_locations_insert on public.quiz_locations;
create policy quiz_locations_insert on public.quiz_locations for insert
  with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
drop policy if exists quiz_locations_update on public.quiz_locations;
create policy quiz_locations_update on public.quiz_locations for update
  using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit())
  with check (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());
drop policy if exists quiz_locations_delete on public.quiz_locations;
create policy quiz_locations_delete on public.quiz_locations for delete
  using (company_id = current_quiz_admin_company_id() and current_quiz_admin_can_edit());

revoke all on public.quiz_locations from anon;
grant select, insert, update, delete on public.quiz_locations to authenticated;

-- A quiz / exam, and every session started from it, can carry a location.
alter table public.quizzes       add column if not exists location_id uuid references public.quiz_locations(id) on delete set null;
alter table public.quiz_sessions add column if not exists location_id uuid references public.quiz_locations(id) on delete set null;
alter table public.exam_sessions add column if not exists location_id uuid references public.quiz_locations(id) on delete set null;

create index if not exists quizzes_location_idx       on public.quizzes (location_id);
create index if not exists quiz_sessions_location_idx on public.quiz_sessions (location_id);
create index if not exists exam_sessions_location_idx on public.exam_sessions (location_id);

-- A new session takes the location of its quiz/exam at launch (frozen from then on).
create or replace function public.session_take_quiz_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.location_id is null then
    select qz.location_id into new.location_id from quizzes qz where qz.id = new.quiz_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quiz_session_location on public.quiz_sessions;
create trigger trg_quiz_session_location before insert on public.quiz_sessions
  for each row execute function public.session_take_quiz_location();
drop trigger if exists trg_exam_session_location on public.exam_sessions;
create trigger trg_exam_session_location before insert on public.exam_sessions
  for each row execute function public.session_take_quiz_location();

-- The results view also carries the session's location (last column, so "create or replace" is allowed).
create or replace view quiz_session_results as
SELECT qs.id AS session_id,
    qs.quiz_id,
    qs.company_id,
    qz.title AS quiz_title,
    qz.passing_score_pct,
    qz.improve_threshold_pct,
    qs.started_at,
    qs.ended_at,
    ( SELECT count(*) AS count
           FROM quiz_questions qq
          WHERE ((qq.quiz_id = qz.id) AND (NOT qq.is_hidden))) AS total_questions,
    qp.id AS participant_id,
    qp.display_name,
    qp.score,
    qp.correct_count,
    qp.total_response_time_ms,
    rank() OVER (PARTITION BY qs.id ORDER BY qp.correct_count DESC, qp.total_response_time_ms) AS rank,
        CASE
            WHEN (( SELECT count(*) AS count
               FROM quiz_questions qq
              WHERE ((qq.quiz_id = qz.id) AND (NOT qq.is_hidden))) = 0) THEN (0)::numeric
            ELSE round(((100.0 * (qp.correct_count)::numeric) / (( SELECT count(*) AS count
               FROM quiz_questions qq
              WHERE ((qq.quiz_id = qz.id) AND (NOT qq.is_hidden))))::numeric))
        END AS percent_correct,
        CASE
            WHEN (( SELECT count(*) AS count
               FROM quiz_questions qq
              WHERE ((qq.quiz_id = qz.id) AND (NOT qq.is_hidden))) = 0) THEN 'FAIL'::text
            WHEN (round(((100.0 * (qp.correct_count)::numeric) / (( SELECT count(*) AS count
               FROM quiz_questions qq
              WHERE ((qq.quiz_id = qz.id) AND (NOT qq.is_hidden))))::numeric)) >= (qz.passing_score_pct)::numeric) THEN 'PASS'::text
            WHEN (round(((100.0 * (qp.correct_count)::numeric) / (( SELECT count(*) AS count
               FROM quiz_questions qq
              WHERE ((qq.quiz_id = qz.id) AND (NOT qq.is_hidden))))::numeric)) >= (qz.improve_threshold_pct)::numeric) THEN 'NEED_IMPROVEMENT'::text
            ELSE 'FAIL'::text
        END AS grade,
    qs.folder_id,
    qs.is_practice,
    qs.location_id
   FROM ((quiz_sessions qs
     JOIN quizzes qz ON ((qz.id = qs.quiz_id)))
     JOIN quiz_participants qp ON ((qp.session_id = qs.id)));

insert into help_articles (category, title, display_order, keywords, content_html)
select 'live_quiz', 'Running Quizzes and Exams Location-wise', 11, 'location, city, mohali, gurgaon, branch, centre, location wise, filter, dashboard, switch',
$art$<p>If you run tests in different cities, give each quiz or exam a <strong>location</strong> and switch between locations with one click.</p>
<h2>Add your locations</h2>
<ul>
<li>Open <strong>Settings → Locations</strong>, type a name (for example Mohali) and press <strong>Add</strong>. Add as many as you need — nothing is built in.</li>
<li>You can rename a location, hide it, or delete it. Deleting a location does not delete any quiz; those quizzes simply show under “No location”.</li>
</ul>
<h2>Give a quiz or exam a location</h2>
<p>In the quiz or exam builder pick the <strong>Location</strong>. A new quiz made while a location is switched on starts with that location already selected.</p>
<h2>Switch location</h2>
<p>When you have at least one location, a <strong>📍 location</strong> switch appears at the top. Choose a location and:</p>
<ul>
<li><strong>Quizzes</strong> and <strong>Exams</strong> show only that location's.</li>
<li><strong>Results</strong> and the <strong>Dashboard</strong> show only that location's sessions and numbers.</li>
<li><strong>All locations</strong> shows everything.</li>
</ul>
<p>A session remembers the location its quiz had when you launched it, so changing a quiz's location later does not change old results. Surveys are not location-based.</p>$art$
where not exists (select 1 from help_articles where title = 'Running Quizzes and Exams Location-wise');
