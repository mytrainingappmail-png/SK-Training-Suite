-- Two additions for live quizzes and exams (additive; nothing existing changes unless the trainer switches it on):
--
-- 1. TOPICS - every question can carry a topic (e.g. "RERA", "Payment plan"). The Results screens use it to show which topics a
--    trainee / the whole team is weak in. Topics are free text chosen by the trainer (suggested from what the company already uses).
--
-- 2. BACKGROUND - a faded logo / the trainer's own image (and optionally the trainee's own name) behind the questions on the
--    trainee's screen. The company sets the default in Quiz Settings; a single quiz or exam can follow it, switch it off or use its
--    own image. The opacity is limited to a range that keeps the text readable.

-- ── Topics ───────────────────────────────────────────────────────────────────
alter table quiz_questions add column if not exists topic text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'quiz_questions_topic_len') then
    alter table quiz_questions add constraint quiz_questions_topic_len check (topic is null or char_length(topic) between 1 and 60);
  end if;
end $$;

create index if not exists idx_quiz_questions_topic on quiz_questions (topic) where topic is not null;

-- Questions that are linked copies of each other (an edit pushed "everywhere") now carry the topic along too.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.sync_question_copies(uuid, uuid[])'::regprocedure);
  if position('hotspot_zones = m.hotspot_zones' in d) = 0 then
    raise exception 'sync_question_copies has an unexpected shape - topic sync not applied';
  end if;
  d := replace(d, 'hotspot_zones = m.hotspot_zones', 'hotspot_zones = m.hotspot_zones, topic = m.topic');
  execute d;
end $$;

-- ── Background: company default ──────────────────────────────────────────────
alter table quiz_settings
  add column if not exists bg_kind text not null default 'none',
  add column if not exists bg_image_url text,
  add column if not exists bg_opacity integer not null default 10,
  add column if not exists bg_layout text not null default 'center',
  add column if not exists bg_name_watermark boolean not null default false,
  add column if not exists bg_name_opacity integer not null default 6;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'quiz_settings_bg_kind_check') then
    alter table quiz_settings add constraint quiz_settings_bg_kind_check check (bg_kind in ('none', 'logo', 'image'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quiz_settings_bg_opacity_check') then
    alter table quiz_settings add constraint quiz_settings_bg_opacity_check check (bg_opacity between 3 and 25);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quiz_settings_bg_layout_check') then
    alter table quiz_settings add constraint quiz_settings_bg_layout_check check (bg_layout in ('center', 'tile', 'corner', 'fill'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quiz_settings_bg_name_opacity_check') then
    alter table quiz_settings add constraint quiz_settings_bg_name_opacity_check check (bg_name_opacity between 2 and 15);
  end if;
end $$;

-- ── Background: one quiz / exam may differ (null = follow the company default) ──
alter table quizzes
  add column if not exists bg_kind text,
  add column if not exists bg_image_url text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'quizzes_bg_kind_check') then
    alter table quizzes add constraint quizzes_bg_kind_check check (bg_kind is null or bg_kind in ('none', 'logo', 'image'));
  end if;
end $$;

-- What a trainee's screen should actually show for this quiz: the quiz's own choice if it has one, else the company default.
-- Returns one small json object (kind none/logo/image, url, opacity, layout, name watermark on/off and its opacity).
create or replace function quiz_effective_background(p_quiz_id uuid, p_company_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s quiz_settings;
  z record;
  v_kind text;
  v_url text;
begin
  select * into s from quiz_settings where company_id = p_company_id;
  select qz.bg_kind, qz.bg_image_url into z from quizzes qz where qz.id = p_quiz_id;

  v_kind := coalesce(z.bg_kind, s.bg_kind, 'none');
  v_url := case v_kind
             when 'logo' then s.brand_logo_url
             when 'image' then case when z.bg_kind = 'image' then z.bg_image_url else s.bg_image_url end
             else null
           end;
  if v_kind <> 'none' and v_url is null then v_kind := 'none'; end if;

  return jsonb_build_object(
    'kind', v_kind,
    'url', v_url,
    'opacity', coalesce(s.bg_opacity, 10),
    'layout', coalesce(s.bg_layout, 'center'),
    'name_watermark', coalesce(s.bg_name_watermark, false),
    'name_opacity', coalesce(s.bg_name_opacity, 6)
  );
end;
$$;
revoke all on function quiz_effective_background(uuid, uuid) from public, anon, authenticated;

-- Live quiz trainee screen: the settings it already got, plus the background.
drop function if exists public.get_quiz_player_settings(uuid);
create or replace function public.get_quiz_player_settings(p_session_id uuid)
 returns table(option_font_size integer, option_colors jsonb, sound_enabled boolean, brand_name text, brand_logo_url text, favicon_url text, result_pass_title text, result_pass_message text, result_improve_title text, result_improve_message text, result_fail_title text, result_fail_message text, cert_eligibility text, result_close_minutes integer, rank_titles_enabled boolean, rank_titles jsonb, bg jsonb)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(qs.option_font_size, 16), coalesce(qs.option_colors, '[
      {"box":"#DC2626","font":"#FFFFFF"},
      {"box":"#2563EB","font":"#FFFFFF"},
      {"box":"#16A34A","font":"#FFFFFF"},
      {"box":"#78350F","font":"#FFFFFF"}
    ]'::jsonb),
    coalesce(qs.sound_enabled, true), qs.brand_name, qs.brand_logo_url, qs.favicon_url,
    qs.result_pass_title, qs.result_pass_message,
    qs.result_improve_title, qs.result_improve_message,
    qs.result_fail_title, qs.result_fail_message,
    coalesce(qs.cert_eligibility, 'all_pass'),
    coalesce(qs.result_close_minutes, 5),
    coalesce(qs.rank_titles_enabled, true), coalesce(qs.rank_titles, public.default_rank_titles()),
    public.quiz_effective_background(sess.quiz_id, sess.company_id)
  from quiz_sessions sess
  left join quiz_settings qs on qs.company_id = sess.company_id
  where sess.id = p_session_id;
$function$;
revoke all on function public.get_quiz_player_settings(uuid) from public, anon;
grant execute on function public.get_quiz_player_settings(uuid) to authenticated;

-- Exam trainee screen: the same, added to the session-scoped settings.
drop function if exists get_exam_session_settings(uuid);
create or replace function get_exam_session_settings(p_session_id uuid)
returns table (
  company_name text, brand_name text, brand_tagline text, brand_logo_url text,
  login_background_url text, login_banner_url text, favicon_url text, footer_text text,
  login_motivational_words text, login_words_enabled boolean, login_logo_position text, login_logo_scale integer,
  exam_lobby_music text, exam_lobby_music_url text, exam_lobby_music_volume integer,
  exam_reveal_answers boolean, exam_hotspot_feedback_seconds integer, exam_hotspot_feedback_size text,
  bg jsonb
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.company_name::text, s.brand_name, s.brand_tagline, s.brand_logo_url,
         s.login_background_url, s.login_banner_url, s.favicon_url, s.footer_text,
         s.login_motivational_words, coalesce(s.login_words_enabled, true),
         coalesce(s.login_logo_position, 'top_center'), coalesce(s.login_logo_scale, 100),
         coalesce(s.exam_lobby_music, 'builtin'), s.exam_lobby_music_url, coalesce(s.exam_lobby_music_volume, 60),
         es.reveal_answers, es.hotspot_feedback_seconds, es.hotspot_feedback_size,
         public.quiz_effective_background(es.quiz_id, es.company_id)
  from exam_sessions es
  join companies c on c.id = es.company_id
  left join quiz_settings s on s.company_id = es.company_id
  where es.id = p_session_id
    and exists (select 1 from exam_participants ep where ep.session_id = es.id and ep.auth_user_id = auth.uid());
$$;
revoke all on function get_exam_session_settings(uuid) from public, anon;
grant execute on function get_exam_session_settings(uuid) to authenticated;

-- ── Topic report for an exam: every candidate's answers, for the trainer ─────
-- One row per candidate and answered question (a candidate with no answers still appears once, question_id null).
create or replace function get_exam_topic_answers(p_session_id uuid)
returns table (participant_id uuid, display_name text, question_id uuid, is_correct boolean, marks_awarded numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from exam_sessions s where s.id = p_session_id and s.company_id = current_quiz_admin_company_id()) then
    raise exception 'Exam not found or not authorized.';
  end if;
  return query
  select ep.id, ep.display_name, a.question_id, a.is_correct, a.marks_awarded
  from exam_participants ep
  left join exam_answers a on a.participant_id = ep.id
  where ep.session_id = p_session_id
  order by ep.joined_at, ep.id, a.question_id;
end;
$$;
revoke all on function get_exam_topic_answers(uuid) from public, anon;
grant execute on function get_exam_topic_answers(uuid) to authenticated;
