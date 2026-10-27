-- Test codes (V001) and questions that stay the same everywhere they are used.
--
-- 1. Every quiz / exam gets a short code (first letter of its title + a running number, e.g. V001). Editable, unique per company.
-- 2. Every question gets a stable identity (origin_uid) that survives re-saving a test and is shared by every copy of it
--    (merged / copied into other tests). Editing a question in one test can then update it in all the tests that have it.
--    (The old source_question_id link broke every time the source test was saved, because saving re-creates its questions.)
-- Additive only: new columns, new functions, no change to how existing screens read data.

-- ── 1. Test codes ──────────────────────────────────────────────────────────────────────────────────────────────────────────
alter table quizzes add column if not exists code text;

create or replace function quiz_code_prefix(p_title text)
returns text
language sql
immutable
as $$
  select coalesce((regexp_match(upper(coalesce(p_title, '')), '([A-Z])'))[1], 'T');
$$;

create or replace function next_quiz_code(p_company uuid, p_prefix text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n int;
begin
  select coalesce(max(((regexp_match(upper(z.code), '^' || p_prefix || '([0-9]+)$'))[1])::int), 0) + 1
    into n
  from quizzes z
  where z.company_id = p_company and upper(z.code) ~ ('^' || p_prefix || '[0-9]+$');
  return p_prefix || lpad(n::text, 3, '0');
end;
$$;

create or replace function quizzes_set_code()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.code is null or btrim(new.code) = '' then
      new.code := next_quiz_code(new.company_id, quiz_code_prefix(new.title));
    else
      new.code := upper(btrim(new.code));
      -- e.g. a test restored from the Bin whose number was handed out again meanwhile
      if exists (select 1 from quizzes z where z.company_id = new.company_id and lower(z.code) = lower(new.code)) then
        new.code := next_quiz_code(new.company_id, quiz_code_prefix(new.title));
      end if;
    end if;
  else
    if new.code is null or btrim(new.code) = '' then new.code := old.code; else new.code := upper(btrim(new.code)); end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quizzes_set_code on quizzes;
create trigger trg_quizzes_set_code before insert or update of code on quizzes for each row execute function quizzes_set_code();

-- give every existing test a code, oldest first
do $$
declare
  r record;
begin
  for r in select id, company_id, title from quizzes where code is null order by created_at, id loop
    update quizzes set code = next_quiz_code(r.company_id, quiz_code_prefix(r.title)) where id = r.id;
  end loop;
end $$;

alter table quizzes alter column code set not null;
create unique index if not exists quizzes_company_code_uq on quizzes (company_id, lower(code));
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quizzes_code_format_check') then
    alter table quizzes add constraint quizzes_code_format_check check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,15}$');
  end if;
end $$;

-- ── 2. Questions that are the same question everywhere ─────────────────────────────────────────────────────────────────────
alter table quiz_questions add column if not exists origin_uid uuid;
alter table quiz_questions add column if not exists home_quiz_id uuid references quizzes(id) on delete set null;

update quiz_questions set origin_uid = id where origin_uid is null;

-- copies made by an earlier merge share the identity of the question they came from (follow the chain a few steps)
do $$
declare
  i int;
begin
  for i in 1..5 loop
    update quiz_questions q
       set origin_uid = s.origin_uid
      from quiz_questions s
     where q.source_question_id = s.id and q.origin_uid <> s.origin_uid;
  end loop;
end $$;

-- the "home" test of a question: where the original lives (or the test it is in, when the original is gone)
update quiz_questions q
   set home_quiz_id = coalesce((select r.quiz_id from quiz_questions r where r.id = q.origin_uid), q.quiz_id)
 where q.home_quiz_id is null;

alter table quiz_questions alter column origin_uid set default gen_random_uuid();
alter table quiz_questions alter column origin_uid set not null;
create index if not exists idx_quiz_questions_origin on quiz_questions (origin_uid);

create or replace function quiz_questions_set_home()
returns trigger
language plpgsql
as $$
begin
  if new.home_quiz_id is null then new.home_quiz_id := new.quiz_id; end if;
  return new;
end;
$$;

drop trigger if exists trg_quiz_questions_set_home on quiz_questions;
create trigger trg_quiz_questions_set_home before insert on quiz_questions for each row execute function quiz_questions_set_home();

-- is a test running or scheduled right now? (its questions must not change under the trainees)
create or replace function quiz_is_in_use(p_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from quiz_sessions s where s.quiz_id = p_quiz_id and s.ended_at is null and not coalesce(s.is_practice, false))
      or exists (select 1 from exam_sessions e where e.quiz_id = p_quiz_id and e.finished_at is null);
$$;

-- Where else do these questions live? (other tests of the same company that hold a copy)
create or replace function get_question_links(p_origin_uids uuid[], p_exclude_quiz uuid)
returns table (
  r_origin_uid uuid,
  r_question_id uuid,
  r_quiz_id uuid,
  r_title text,
  r_code text,
  r_mode text,
  r_is_home boolean,
  r_in_use boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select q.origin_uid, q.id, z.id, z.title, z.code, z.mode, (q.home_quiz_id = z.id), quiz_is_in_use(z.id)
  from quiz_questions q
  join quizzes z on z.id = q.quiz_id
  where z.company_id = current_quiz_admin_company_id()
    and q.origin_uid = any (p_origin_uids)
    and (p_exclude_quiz is null or z.id <> p_exclude_quiz)
  order by z.code;
$$;

-- Make the other copies of these questions identical to the version saved in p_quiz_id: question, Hindi, explanation, type,
-- picture / marked area and every option (same order). Marks, timers, hidden flag and position stay each test's own.
-- A test that is running or scheduled is skipped (reported with updated = false) so nothing changes under live trainees.
create or replace function sync_question_copies(p_quiz_id uuid, p_origin_uids uuid[])
returns table (
  r_origin_uid uuid,
  r_quiz_id uuid,
  r_title text,
  r_code text,
  r_updated boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := current_quiz_admin_company_id();
  m quiz_questions;
  c record;
  v_max int;
begin
  if v_company is null or not current_quiz_admin_can_edit() then
    raise exception 'You are not allowed to change questions.';
  end if;
  if not exists (select 1 from quizzes z where z.id = p_quiz_id and z.company_id = v_company) then
    raise exception 'Test not found.';
  end if;

  for m in select * from quiz_questions q where q.quiz_id = p_quiz_id and q.origin_uid = any (p_origin_uids) loop
    select coalesce(max(o.display_order), -1) into v_max from quiz_question_options o where o.question_id = m.id;

    for c in
      select q.id as qid, z.id as zid, z.title as ztitle, z.code as zcode
      from quiz_questions q
      join quizzes z on z.id = q.quiz_id
      where q.origin_uid = m.origin_uid and q.id <> m.id and z.id <> p_quiz_id and z.company_id = v_company
      order by z.code
    loop
      if quiz_is_in_use(c.zid) then
        return query select m.origin_uid, c.zid, c.ztitle, c.zcode, false;
        continue;
      end if;

      update quiz_questions t
         set question_text = m.question_text, question_text_hi = m.question_text_hi,
             explanation = m.explanation, explanation_hi = m.explanation_hi,
             type = m.type, image_url = m.image_url,
             target_x = m.target_x, target_y = m.target_y, target_radius = m.target_radius,
             hotspot_zones = m.hotspot_zones
       where t.id = c.qid;

      update quiz_question_options o
         set option_text = s.option_text, option_text_hi = s.option_text_hi, is_correct = s.is_correct
        from quiz_question_options s
       where s.question_id = m.id and o.question_id = c.qid and o.display_order = s.display_order;

      insert into quiz_question_options (question_id, option_text, option_text_hi, is_correct, display_order)
      select c.qid, s.option_text, s.option_text_hi, s.is_correct, s.display_order
        from quiz_question_options s
       where s.question_id = m.id
         and not exists (select 1 from quiz_question_options o where o.question_id = c.qid and o.display_order = s.display_order);

      delete from quiz_question_options o where o.question_id = c.qid and o.display_order > v_max;

      return query select m.origin_uid, c.zid, c.ztitle, c.zcode, true;
    end loop;
  end loop;
end;
$$;

grant execute on function get_question_links(uuid[], uuid) to authenticated;
grant execute on function sync_question_copies(uuid, uuid[]) to authenticated;

-- internal helper: only the functions above (which run with their owner's rights) use it
revoke execute on function quiz_is_in_use(uuid) from public, anon, authenticated;
