-- Running percentage on the Live Quiz leaderboards: how much of what a player has answered so far is right (right answers / answers
-- given), changing with every answer. Two switches in the quiz settings:
--   leaderboard_show_percent  - the host's leaderboard (default ON; the host already sees right / wrong counts there)
--   live_top_show_percent     - the top ranks on the trainee's own screen (default OFF, that board shows names and places only)
-- The trainee board keeps its existing rule: it is off whenever a quiz hides right / wrong from players.

alter table public.quiz_settings
  add column if not exists leaderboard_show_percent boolean not null default true,
  add column if not exists live_top_show_percent boolean not null default false;

create or replace function public.quiz_effective_live_top(p_session_id uuid)
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
    'refresh_seconds', coalesce(s.live_top_refresh_seconds, 5),
    'show_percent', coalesce(s.live_top_show_percent, false)
  );
end;
$$;
revoke all on function public.quiz_effective_live_top(uuid) from public, anon, authenticated;

-- the board gains a "percent" column (null unless the company switched it on)
drop function if exists public.get_quiz_live_top(uuid);
create or replace function public.get_quiz_live_top(p_session_id uuid)
returns table (rank integer, display_name text, is_me boolean, percent integer)
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
  v_pct boolean;
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
  v_pct := coalesce((v_cfg->>'show_percent')::boolean, false);

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
         r.id = v_me,
         case when v_pct then (select round(100.0 * count(*) filter (where a.is_correct) / nullif(count(*), 0))::integer from quiz_answers a where a.participant_id = r.id) else null end
  from ranked r
  where r.rk <= v_n or (v_show_me and r.id = v_me)
  order by r.rk;
end;
$$;
revoke all on function public.get_quiz_live_top(uuid) from public, anon;
grant execute on function public.get_quiz_live_top(uuid) to authenticated;
