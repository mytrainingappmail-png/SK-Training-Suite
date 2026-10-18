-- ============================================================================
-- INFO TIPS — the little "i" next to a button/heading that explains what it does.
--
-- Platform-wide (one set of tips for every company, no company_id) and written
-- ONLY by the platform operator (same rule as discount codes / plans / settings,
-- see 20260722130000_platform_operator_scoping.sql). Everybody — including people
-- who are not logged in, e.g. a trainee on the exam page — can READ the active tips.
--
-- A tip is attached to a control by:  route (the screen, ids replaced by :id, or '*'
-- for "everywhere in the app")  +  label (the visible text of the control).
-- ============================================================================

create table if not exists public.info_tips (
  id          uuid primary key default gen_random_uuid(),
  route       text not null,
  label       text not null,
  label_key   text generated always as (lower(btrim(label))) stored,
  title       text,
  body        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint info_tips_route_len  check (char_length(route) between 1 and 200),
  constraint info_tips_label_len  check (char_length(btrim(label)) between 1 and 80),
  constraint info_tips_title_len  check (title is null or char_length(title) <= 80),
  constraint info_tips_body_len   check (char_length(btrim(body)) between 1 and 600)
);

create unique index if not exists info_tips_route_label_key on public.info_tips (route, label_key);

create or replace function public.info_tips_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists info_tips_touch on public.info_tips;
create trigger info_tips_touch before update on public.info_tips
  for each row execute function public.info_tips_touch();

alter table public.info_tips enable row level security;

drop policy if exists info_tips_read on public.info_tips;
create policy info_tips_read on public.info_tips
  for select to anon, authenticated
  using (active or public.current_company_is_platform_operator());

drop policy if exists info_tips_insert on public.info_tips;
create policy info_tips_insert on public.info_tips
  for insert to authenticated
  with check (public.current_company_is_platform_operator());

drop policy if exists info_tips_update on public.info_tips;
create policy info_tips_update on public.info_tips
  for update to authenticated
  using (public.current_company_is_platform_operator())
  with check (public.current_company_is_platform_operator());

drop policy if exists info_tips_delete on public.info_tips;
create policy info_tips_delete on public.info_tips
  for delete to authenticated
  using (public.current_company_is_platform_operator());

revoke all on public.info_tips from anon;
grant select on public.info_tips to anon;
grant select, insert, update, delete on public.info_tips to authenticated;

-- "Am I the platform owner?" — used only to decide whether to show the Edit-tips switch.
-- Safe for anyone to call (answers false when not logged in); the real protection is the policies above.
create or replace function public.info_tips_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_company_is_platform_operator(), false)
$$;

revoke all on function public.info_tips_is_owner() from public;
grant execute on function public.info_tips_is_owner() to anon, authenticated;

-- ── Starting tips: Exam host screen and Live Quiz host screen ───────────────
-- (The owner can change, hide or delete any of these from Settings → Info Tips.)
insert into public.info_tips (route, label, title, body) values
  ('/quiz-admin/exams/session/:id', 'Rename', 'Rename', 'Corrects the name shown for this employee in the list and in the results. Their answers and marks are not affected.'),
  ('/quiz-admin/exams/session/:id', 'Start over', 'Start over', 'Erases this employee''s answers so they can begin the paper again. The exam clock does not restart — they only have the time that is left. Use it when someone started by mistake or had a technical problem.'),
  ('/quiz-admin/exams/session/:id', 'Stop', 'Stop an employee', 'Pauses this employee: they cannot answer or submit until you press Resume. Their exam clock keeps running. You can type a reason, which they will see.'),
  ('/quiz-admin/exams/session/:id', 'Resume', 'Resume an employee', 'Lets a stopped employee answer and submit again.'),
  ('/quiz-admin/exams/session/:id', 'Reopen', 'Reopen a submission', 'Cancels this employee''s submission so they can answer again until the time is up. Use it when someone pressed Submit by mistake.'),
  ('/quiz-admin/exams/session/:id', 'End exam & show results', 'End the exam for everyone', 'Closes the exam right now. Anyone who has not submitted is submitted automatically with the answers saved so far, and the results appear on this screen.'),
  ('/quiz-admin/exams/session/:id', 'Everyone has submitted — Show results', 'Show results', 'Everyone has finished. Press to close the exam and open the results.'),
  ('/quiz-admin/exams/session/:id', 'Start now', 'Start now', 'Opens the paper immediately. Until then, employees who join wait in a lobby — the paper time only starts when it opens.'),
  ('/quiz-admin/exams/session/:id', 'Extend time for everyone', 'Extend time', 'Adds the minutes you type to the exam time of everyone who is still writing. Use it when the room is running late.'),
  ('/quiz-admin/exams/session/:id', 'Hide marks (projector)', 'Hide marks', 'Hides marks and right/wrong counts on THIS screen only, so you can project it to the room without showing scores. Employees'' own screens are not affected.'),
  ('/quiz-admin/exams/session/:id', 'Show marks', 'Show marks', 'Shows each employee''s marks and right/wrong counts on this screen. Hide them again before projecting it to the room.'),
  ('/quiz-admin/exams/session/:id', 'Missed most so far', 'Missed most so far', 'The questions that most employees have answered wrongly so far. Useful to know what to revise after the exam.'),
  ('/quiz-admin/exams/session/:id', 'Left the tab', 'Left the tab', 'How many times the employee switched away from the exam tab or app. A high number can mean they were looking something up.'),
  ('/quiz-admin/exams/session/:id', 'Copy link', 'Copy link', 'Copies the exam link so you can send it to employees.'),
  ('/quiz-admin/exams/session/:id', 'Copy PIN', 'Copy PIN', 'Copies the exam PIN. Employees type it on the exam link to join.'),
  ('/quiz-admin/exams/session/:id', 'Copy both (WhatsApp-ready)', 'Copy link and PIN', 'Copies the link and the PIN together as one message, ready to paste into WhatsApp.'),
  ('/quiz-admin/exams/session/:id', 'Download CSV', 'Download CSV', 'Downloads the results as a spreadsheet file (CSV) that opens in Excel.'),
  ('/quiz-admin/exams/session/:id', 'Release results to employees', 'Release results', 'Lets each employee see their own result on their screen. Mark the written answers first — unmarked ones count as 0.'),
  ('/quiz-admin/exams/session/:id', 'Results shared with employees — click to hide', 'Results are visible to employees', 'Employees can see their results right now. Click to hide them again.'),

  ('/quiz-admin/host/:id', 'Start Quiz', 'Start Quiz', 'Shows the first question to everyone who has joined. Wait until all players are in the lobby.'),
  ('/quiz-admin/host/:id', 'Next Question', 'Next Question', 'Moves everyone on to the next question. If you do nothing, the quiz moves on by itself when the timer ends.'),
  ('/quiz-admin/host/:id', 'Finish Quiz', 'Finish Quiz', 'Closes the quiz and shows the final leaderboard and results.'),
  ('/quiz-admin/host/:id', 'End', 'End the quiz', 'Stops the quiz for everyone straight away. Answers already given are kept and counted.'),
  ('/quiz-admin/host/:id', 'Stop', 'Pause a player', 'Pauses this player: they cannot answer until you press Start again. The quiz keeps going for everyone else. You can type a reason, which they will see.'),
  ('/quiz-admin/host/:id', 'Start', 'Start a paused player', 'Lets a paused player answer again.'),
  ('/quiz-admin/host/:id', 'Export CSV', 'Export CSV', 'Downloads every answer of this quiz as a spreadsheet file (CSV) that opens in Excel.'),
  ('/quiz-admin/host/:id', 'View Results', 'View Results', 'Opens the saved results of this quiz.')
on conflict (route, label_key) do nothing;
