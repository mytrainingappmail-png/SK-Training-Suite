-- Instant right/wrong feedback for exam answers, admin-toggleable.
--
-- Trainees couldn't tell if a tap/answer was right until the trainer
-- released results. Admin wants an immediate green/red per answer instead
-- (without showing the running score/marks, and without ever leaking the
-- hotspot zone geometry itself to the client — only "correct or not" and,
-- for hotspot, the tapped zone's own label if the admin set one).
--
-- MCQ/true-false: graded the moment they're saved (previously only at
-- submit time) so get_exam_paper can hand back is_correct on reload, no
-- extra round trip. Hotspot: a separate check_hotspot_tap RPC judges one
-- tap against the real zones server-side and returns just {is_correct,
-- zone_label} — the zones array itself never reaches the browser.

alter table quiz_settings
  add column if not exists exam_reveal_answers boolean not null default true,
  add column if not exists exam_hotspot_feedback_seconds int not null default 3,
  add column if not exists exam_hotspot_feedback_size text not null default 'small';

alter table quiz_settings drop constraint if exists exam_hotspot_feedback_size_check;
alter table quiz_settings add constraint exam_hotspot_feedback_size_check check (exam_hotspot_feedback_size in ('small', 'medium', 'large'));

alter table quiz_settings drop constraint if exists exam_hotspot_feedback_seconds_check;
alter table quiz_settings add constraint exam_hotspot_feedback_seconds_check check (exam_hotspot_feedback_seconds between 0 and 60);

-- ── Public branding RPC gains the reveal settings ──────────────────────
drop function if exists get_quiz_public_branding();
create or replace function get_quiz_public_branding()
returns table (
  company_name text, brand_name text, brand_tagline text, brand_logo_url text,
  login_background_url text, login_banner_url text, favicon_url text, footer_text text,
  login_motivational_words text, login_words_enabled boolean,
  login_logo_position text, login_logo_scale int,
  exam_lobby_music text, exam_lobby_music_url text, exam_lobby_music_volume int,
  exam_reveal_answers boolean, exam_hotspot_feedback_seconds int, exam_hotspot_feedback_size text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.company_name, s.brand_name, s.brand_tagline, s.brand_logo_url,
         s.login_background_url, s.login_banner_url, s.favicon_url, s.footer_text,
         s.login_motivational_words, coalesce(s.login_words_enabled, true),
         coalesce(s.login_logo_position, 'top_center'), coalesce(s.login_logo_scale, 100),
         coalesce(s.exam_lobby_music, 'builtin'), s.exam_lobby_music_url, coalesce(s.exam_lobby_music_volume, 60),
         coalesce(s.exam_reveal_answers, true), coalesce(s.exam_hotspot_feedback_seconds, 3), coalesce(s.exam_hotspot_feedback_size, 'small')
  from companies c
  left join quiz_settings s on s.company_id = c.id
  where c.live_quiz_enabled = true
  order by c.created_at asc
  limit 1;
$$;

-- ── One tap, judged server-side, zone geometry never leaves the DB ─────
create or replace function check_hotspot_tap(p_session_id uuid, p_question_id uuid, p_x numeric, p_y numeric)
returns table (is_correct boolean, zone_label text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
  v_zones jsonb;
  v_idx int;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  if v_sub is not null then raise exception 'You have already submitted this exam.'; end if;

  select * into v_s from exam_sessions es where es.id = p_session_id;
  if now() < v_s.opens_at or now() > v_s.deadline_at + interval '20 seconds' or v_s.finished_at is not null then
    raise exception 'The exam is not currently open.';
  end if;

  select q.hotspot_zones into v_zones
  from quiz_questions q where q.id = p_question_id and q.quiz_id = v_s.quiz_id and q.type = 'hotspot' and not q.is_hidden;
  if v_zones is null then raise exception 'That question is not part of this exam.'; end if;

  v_idx := hotspot_zone_index_hit(v_zones, p_x, p_y);
  if v_idx is null then
    return query select false, null::text;
  else
    return query select true, nullif(trim(coalesce(v_zones->v_idx->>'label', '')), '');
  end if;
end;
$$;

-- ── save_exam_answer now grades mcq/truefalse immediately ──────────────
-- (hotspot/written stay ungraded until submit, as before — hotspot needs
-- every tap together to score, written needs a human.) Return type changes
-- from void to a table, which CREATE OR REPLACE can't do in place even
-- with the same argument list, so drop first.
drop function if exists save_exam_answer(uuid, uuid, uuid, numeric, numeric, text, text[], boolean, jsonb);
create or replace function save_exam_answer(
  p_session_id uuid,
  p_question_id uuid,
  p_selected_option_id uuid default null,
  p_click_x numeric default null,
  p_click_y numeric default null,
  p_text_answer text default null,
  p_image_paths text[] default null,
  p_flagged boolean default false,
  p_hotspot_taps jsonb default null
)
returns table (saved_is_correct boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_sub timestamptz;
  v_s exam_sessions;
  v_prefix text;
  v_type text;
  v_marks int;
  v_empty boolean;
  v_taps jsonb;
  v_is_correct boolean;
  v_marks_awarded numeric;
  v_auto_graded boolean;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  if v_sub is not null then raise exception 'You have already submitted this exam.'; end if;

  select * into v_s from exam_sessions es where es.id = p_session_id;
  if now() < v_s.opens_at then raise exception 'The exam has not started yet.'; end if;
  if v_s.finished_at is not null or now() > v_s.deadline_at + interval '20 seconds' then
    raise exception 'The exam time is over — answers are locked.';
  end if;

  select q.type, q.marks into v_type, v_marks from quiz_questions q where q.id = p_question_id and q.quiz_id = v_s.quiz_id and not q.is_hidden;
  if v_type is null then raise exception 'That question is not part of this exam.'; end if;

  if p_selected_option_id is not null and not exists (
    select 1 from quiz_question_options o where o.id = p_selected_option_id and o.question_id = p_question_id
  ) then raise exception 'That option does not belong to this question.'; end if;

  if p_text_answer is not null and length(p_text_answer) > 20000 then raise exception 'Answer is too long.'; end if;

  if p_hotspot_taps is not null then
    if jsonb_typeof(p_hotspot_taps) <> 'array' then raise exception 'Invalid tap data.'; end if;
    if jsonb_array_length(p_hotspot_taps) > 40 then raise exception 'Too many tapped points.'; end if;
  end if;
  v_taps := coalesce(p_hotspot_taps, '[]'::jsonb);

  v_prefix := p_session_id::text || '/' || v_pid::text || '/';
  if p_image_paths is not null then
    if cardinality(p_image_paths) > 5 then raise exception 'You can attach up to 5 photos per answer.'; end if;
    if exists (select 1 from unnest(p_image_paths) pth where left(pth, length(v_prefix)) <> v_prefix) then
      raise exception 'Invalid photo.';
    end if;
  end if;

  v_empty := p_selected_option_id is null and p_click_x is null and jsonb_array_length(v_taps) = 0
    and coalesce(trim(p_text_answer), '') = ''
    and coalesce(cardinality(p_image_paths), 0) = 0 and not coalesce(p_flagged, false);

  if v_empty then
    delete from exam_answers where participant_id = v_pid and question_id = p_question_id;
    return query select null::boolean;
    return;
  end if;

  if v_type in ('mcq', 'truefalse') and p_selected_option_id is not null then
    v_is_correct := coalesce((select o.is_correct from quiz_question_options o where o.id = p_selected_option_id), false);
    v_marks_awarded := case when v_is_correct then v_marks else 0 end;
    v_auto_graded := true;
  else
    v_is_correct := null;
    v_marks_awarded := null;
    v_auto_graded := false;
  end if;

  insert into exam_answers (participant_id, question_id, selected_option_id, click_x, click_y, text_answer, image_paths, flagged, hotspot_taps, is_correct, marks_awarded, auto_graded, updated_at)
  values (v_pid, p_question_id, p_selected_option_id, p_click_x, p_click_y, nullif(p_text_answer, ''), coalesce(p_image_paths, '{}'), coalesce(p_flagged, false), v_taps, v_is_correct, v_marks_awarded, v_auto_graded, now())
  on conflict (participant_id, question_id) do update
    set selected_option_id = excluded.selected_option_id,
        click_x = excluded.click_x,
        click_y = excluded.click_y,
        text_answer = excluded.text_answer,
        image_paths = excluded.image_paths,
        flagged = excluded.flagged,
        hotspot_taps = excluded.hotspot_taps,
        is_correct = excluded.is_correct,
        marks_awarded = excluded.marks_awarded,
        auto_graded = excluded.auto_graded,
        updated_at = now();

  return query select v_is_correct;
end;
$$;

-- ── get_exam_paper hands back is_correct so a reload keeps the reveal ──
drop function if exists get_exam_paper(uuid);
create or replace function get_exam_paper(p_session_id uuid)
returns table (
  question_position int, question_id uuid, question_text text, type text, marks int, image_url text,
  option_id uuid, option_text text, option_order int,
  saved_selected_option_id uuid, saved_click_x numeric, saved_click_y numeric,
  saved_text text, saved_image_paths text[], saved_flagged boolean, saved_hotspot_taps jsonb,
  hotspot_zone_count int, saved_is_correct boolean
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
  v_shuffle_q boolean;
  v_shuffle_o boolean;
begin
  select ep.id, ep.submitted_at into v_pid, v_sub
  from exam_participants ep where ep.session_id = p_session_id and ep.auth_user_id = auth.uid();
  if v_pid is null then raise exception 'You have not joined this exam.'; end if;
  select * into v_s from exam_sessions es where es.id = p_session_id;
  if now() < v_s.opens_at then raise exception 'The exam has not started yet.'; end if;
  if v_sub is not null then raise exception 'You have already submitted this exam.'; end if;
  if v_s.finished_at is not null or now() > v_s.deadline_at + interval '90 seconds' then raise exception 'This exam''s time is over.'; end if;

  select coalesce(qz.shuffle_questions_per_participant, false), coalesce(qz.shuffle_options, false)
    into v_shuffle_q, v_shuffle_o from quizzes qz where qz.id = v_s.quiz_id;

  return query
  with qs as (
    select q.*, row_number() over (
      order by case when v_shuffle_q then md5(q.id::text || v_pid::text) else lpad(q.display_order::text, 10, '0') end
    )::int as pos
    from quiz_questions q where q.quiz_id = v_s.quiz_id and not q.is_hidden
  )
  select qs.pos, qs.id, qs.question_text, qs.type, qs.marks, qs.image_url,
    o.id, o.option_text,
    case when o.id is null then null
         when v_shuffle_o and qs.type <> 'truefalse' then (row_number() over (partition by qs.id order by md5(o.id::text || v_pid::text)))::int
         else (row_number() over (partition by qs.id order by o.display_order))::int end,
    a.selected_option_id, a.click_x, a.click_y, a.text_answer, coalesce(a.image_paths, '{}'::text[]), coalesce(a.flagged, false),
    coalesce(a.hotspot_taps, '[]'::jsonb),
    case when qs.hotspot_zones is not null and jsonb_typeof(qs.hotspot_zones) = 'array' then jsonb_array_length(qs.hotspot_zones) else null end,
    a.is_correct
  from qs
  left join quiz_question_options o on o.question_id = qs.id
  left join exam_answers a on a.question_id = qs.id and a.participant_id = v_pid
  order by qs.pos, 9;
end;
$$;

-- ── Grants (each drop above wipes the previous grant) ──────────────────
grant execute on function get_quiz_public_branding() to authenticated, anon;
grant execute on function check_hotspot_tap(uuid, uuid, numeric, numeric) to authenticated;
grant execute on function save_exam_answer(uuid, uuid, uuid, numeric, numeric, text, text[], boolean, jsonb) to authenticated;
grant execute on function get_exam_paper(uuid) to authenticated;

-- ── Backfill the two unlabeled zones on the real 16-landmark question ───
-- 14 of 16 zones already carry a label (added via the Hotspot editor's
-- "Label this area" field); by elimination against the question's own
-- numbered list, the 2 blank ones are IFFCO Chowk (#1) and Central
-- Peripheral Road (#12) — every other name in that list is already used.
-- Applied to both the live question and its demo-exam copy.
update quiz_questions
set hotspot_zones = jsonb_set(hotspot_zones, '{0,label}', '"IFFCO Chowk"')
where id in ('ca2afc29-327b-4644-bd17-b9368e92eff2')
  and hotspot_zones->0->>'label' is null;

update quiz_questions
set hotspot_zones = jsonb_set(hotspot_zones, '{14,label}', '"Central Peripheral Road"')
where id in ('ca2afc29-327b-4644-bd17-b9368e92eff2')
  and hotspot_zones->14->>'label' is null;

update quiz_questions
set hotspot_zones = jsonb_set(hotspot_zones, '{0,label}', '"IFFCO Chowk"')
where source_question_id = 'ca2afc29-327b-4644-bd17-b9368e92eff2'
  and hotspot_zones->0->>'label' is null;

update quiz_questions
set hotspot_zones = jsonb_set(hotspot_zones, '{14,label}', '"Central Peripheral Road"')
where source_question_id = 'ca2afc29-327b-4644-bd17-b9368e92eff2'
  and hotspot_zones->14->>'label' is null;
