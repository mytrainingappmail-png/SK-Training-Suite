-- Adds an editable favicon (browser tab icon) and a free-text footer
-- (company address/contact info) to quiz_settings, and threads both
-- through to the two pre-existing pre-auth/participant RPCs. Both RPCs
-- change their OUT-parameter signature, so each needs an explicit
-- DROP FUNCTION before CREATE — CREATE OR REPLACE cannot do this
-- (SQLSTATE 42P13, hit and fixed the same way earlier in this module).

alter table quiz_settings add column if not exists favicon_url text;
alter table quiz_settings add column if not exists footer_text text;

drop function if exists get_quiz_player_settings(uuid);
create function get_quiz_player_settings(p_session_id uuid)
returns table (
  option_font_size int, option_colors jsonb, sound_enabled boolean,
  brand_name text, brand_logo_url text, favicon_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(qs.option_font_size, 16), coalesce(qs.option_colors, '[
      {"box":"#DC2626","font":"#FFFFFF"},
      {"box":"#2563EB","font":"#FFFFFF"},
      {"box":"#16A34A","font":"#FFFFFF"},
      {"box":"#78350F","font":"#FFFFFF"}
    ]'::jsonb),
    coalesce(qs.sound_enabled, true), qs.brand_name, qs.brand_logo_url, qs.favicon_url
  from quiz_sessions sess
  left join quiz_settings qs on qs.company_id = sess.company_id
  where sess.id = p_session_id;
$$;

drop function if exists get_quiz_public_branding();
create function get_quiz_public_branding()
returns table (
  company_name text,
  brand_name text,
  brand_tagline text,
  brand_logo_url text,
  login_background_url text,
  login_banner_url text,
  favicon_url text,
  footer_text text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.company_name, s.brand_name, s.brand_tagline, s.brand_logo_url,
         s.login_background_url, s.login_banner_url, s.favicon_url, s.footer_text
  from companies c
  left join quiz_settings s on s.company_id = c.id
  where c.live_quiz_enabled = true
  order by c.created_at asc
  limit 1;
$$;

grant execute on function get_quiz_public_branding() to anon, authenticated;
