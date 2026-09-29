-- Admin-configurable lobby music for the Exam module — a candidate who
-- joins early waits in a lobby until the paper opens (see exam_sessions
-- opens_at); this gives that wait a motivational tune instead of dead air.
-- Mirrors the existing champ_music/champ_music_url/champ_music_volume
-- pattern exactly (same "builtin | custom | off" shape, a plain URL for
-- "custom" — nothing hardcoded, the admin can swap the track any time).

alter table quiz_settings
  add column if not exists exam_lobby_music text not null default 'builtin',
  add column if not exists exam_lobby_music_url text,
  add column if not exists exam_lobby_music_volume int not null default 60;

alter table quiz_settings
  add constraint exam_lobby_music_check check (exam_lobby_music in ('builtin', 'custom', 'off'));

-- Extend the public (pre-auth) branding RPC so the exam paper — which
-- loads before any employee auth context beyond the throwaway player
-- identity — can read the lobby music choice the same way it already
-- reads the logo/company name.
drop function if exists get_quiz_public_branding();
create function get_quiz_public_branding()
returns table (
  company_name text, brand_name text, brand_tagline text, brand_logo_url text,
  login_background_url text, login_banner_url text, favicon_url text, footer_text text,
  login_motivational_words text, login_words_enabled boolean,
  login_logo_position text, login_logo_scale int,
  exam_lobby_music text, exam_lobby_music_url text, exam_lobby_music_volume int
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
         coalesce(s.exam_lobby_music, 'builtin'), s.exam_lobby_music_url, coalesce(s.exam_lobby_music_volume, 60)
  from companies c
  left join quiz_settings s on s.company_id = c.id
  where c.live_quiz_enabled = true
  order by c.created_at asc
  limit 1;
$$;
