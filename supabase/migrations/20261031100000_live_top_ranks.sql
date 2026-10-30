-- Live Quiz: the top ranks on the trainee's own screen, updating while the quiz runs (names and rank only - never points or marks).
-- Everything is the trainer's choice: on/off (company default, one quiz may differ), how many names (3-10), whether a trainee also
-- sees their own place, full or first name only, and how often the board refreshes. Off to begin with.
--
-- The board is ranked the same way the host's own leaderboard is (points, then faster total answer time, then who joined first).
-- It is switched off automatically while the quiz hides right/wrong from players - a moving rank would give the answer away.

-- ── Company default ──────────────────────────────────────────────────────────
alter table quiz_settings
  add column if not exists live_top_enabled boolean not null default false,
  add column if not exists live_top_count integer not null default 5,
  add column if not exists live_top_show_me boolean not null default true,
  add column if not exists live_top_name_style text not null default 'full',
  add column if not exists live_top_refresh_seconds integer not null default 5;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'quiz_settings_live_top_count_check') then
    alter table quiz_settings add constraint quiz_settings_live_top_count_check check (live_top_count between 3 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quiz_settings_live_top_name_style_check') then
    alter table quiz_settings add constraint quiz_settings_live_top_name_style_check check (live_top_name_style in ('full', 'first'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quiz_settings_live_top_refresh_check') then
    alter table quiz_settings add constraint quiz_settings_live_top_refresh_check check (live_top_refresh_seconds between 3 and 30);
  end if;
end $$;

-- ── One quiz may differ (null = follow the company default) ──────────────────
alter table quizzes add column if not exists live_top_enabled boolean;

-- What applies to this session right now: the quiz's own choice, else the company default - and never while right/wrong is hidden.
create or replace function quiz_effective_live_top(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sess record;
  s quiz_settings;
  z record;
  v_on boolean;
begin
  select qs.quiz_id, qs.company_id, qs.reveal_answers into sess from quiz_sessions qs where qs.id = p_session_id;
  if sess.quiz_id is null then
    return jsonb_build_object('enabled', false);
  end if;
  select * into s from quiz_settings where company_id = sess.company_id;
  select qz.live_top_enabled into z from quizzes qz where qz.id = sess.quiz_id;

  v_on := coalesce(z.live_top_enabled, s.live_top_enabled, false) and coalesce(sess.reveal_answers, true);

  return jsonb_build_object(
    'enabled', v_on,
    'count', coalesce(s.live_top_count, 5),
    'show_me', coalesce(s.live_top_show_me, true),
    'name_style', coalesce(s.live_top_name_style, 'full'),
    'refresh_seconds', coalesce(s.live_top_refresh_seconds, 5)
  );
end;
$$;
revoke all on function quiz_effective_live_top(uuid) from public, anon, authenticated;

-- ── Trainee screen: the same settings as before, plus the live board's setup ─
drop function if exists public.get_quiz_player_settings(uuid);
create or replace function public.get_quiz_player_settings(p_session_id uuid)
 returns table(option_font_size integer, option_colors jsonb, sound_enabled boolean, brand_name text, brand_logo_url text, favicon_url text, result_pass_title text, result_pass_message text, result_improve_title text, result_improve_message text, result_fail_title text, result_fail_message text, cert_eligibility text, result_close_minutes integer, rank_titles_enabled boolean, rank_titles jsonb, bg jsonb, live_top jsonb)
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
    public.quiz_effective_background(sess.quiz_id, sess.company_id),
    public.quiz_effective_live_top(sess.id)
  from quiz_sessions sess
  left join quiz_settings qs on qs.company_id = sess.company_id
  where sess.id = p_session_id;
$function$;
revoke all on function public.get_quiz_player_settings(uuid) from public, anon;
grant execute on function public.get_quiz_player_settings(uuid) to authenticated;

-- ── The board itself ─────────────────────────────────────────────────────────
-- Only a player of that session can ask. Returns rank and name (and which row is "me") - nothing about points, marks or answers.
-- Only players who have answered at least once are ranked. Empty while the board is off, or when the quiz is not running.
create or replace function get_quiz_live_top(p_session_id uuid)
returns table (rank integer, display_name text, is_me boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid;
  v_cfg jsonb;
  v_n integer;
  v_show_me boolean;
  v_first boolean;
begin
  select p.id into v_me from quiz_participants p where p.session_id = p_session_id and p.auth_user_id = auth.uid();
  if v_me is null then
    raise exception 'Not a participant in this session.';
  end if;

  v_cfg := quiz_effective_live_top(p_session_id);
  if not coalesce((v_cfg->>'enabled')::boolean, false) then
    return;
  end if;
  if not exists (select 1 from quiz_sessions s where s.id = p_session_id and s.phase in ('question', 'paused')) then
    return;
  end if;

  v_n := (v_cfg->>'count')::integer;
  v_show_me := coalesce((v_cfg->>'show_me')::boolean, true);
  v_first := (v_cfg->>'name_style') = 'first';

  return query
  with ranked as (
    select p.id, p.display_name as dn,
           (row_number() over (order by p.score desc, coalesce(p.total_response_time_ms, 0) asc, p.joined_at asc, p.id))::integer as rk
    from quiz_participants p
    where p.session_id = p_session_id
      and exists (select 1 from quiz_answers a where a.participant_id = p.id)
  )
  select r.rk,
         case when v_first then coalesce(nullif(split_part(btrim(r.dn), ' ', 1), ''), r.dn) else r.dn end,
         r.id = v_me
  from ranked r
  where r.rk <= v_n or (v_show_me and r.id = v_me)
  order by r.rk;
end;
$$;
revoke all on function get_quiz_live_top(uuid) from public, anon;
grant execute on function get_quiz_live_top(uuid) to authenticated;
