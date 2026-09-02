-- Two small admin-configurable settings: the falling motivational
-- words/quotes shown on the trainee login/join landing screen, and how
-- long (in minutes) a trainee's post-quiz result screen stays open before
-- auto-closing back to Join Quiz — previously a hardcoded 5 minutes.

alter table quiz_settings add column if not exists login_motivational_words text;
alter table quiz_settings add column if not exists result_close_minutes integer not null default 5;

drop function if exists get_quiz_public_branding();
create function get_quiz_public_branding()
returns table (
  company_name text, brand_name text, brand_tagline text, brand_logo_url text,
  login_background_url text, login_banner_url text, favicon_url text, footer_text text,
  login_motivational_words text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.company_name, s.brand_name, s.brand_tagline, s.brand_logo_url,
         s.login_background_url, s.login_banner_url, s.favicon_url, s.footer_text,
         s.login_motivational_words
  from companies c
  left join quiz_settings s on s.company_id = c.id
  where c.live_quiz_enabled = true
  order by c.created_at asc
  limit 1;
$$;

drop function if exists get_quiz_player_settings(uuid);
create function get_quiz_player_settings(p_session_id uuid)
returns table (
  option_font_size integer, option_colors jsonb, sound_enabled boolean,
  brand_name text, brand_logo_url text, favicon_url text,
  result_pass_title text, result_pass_message text,
  result_improve_title text, result_improve_message text,
  result_fail_title text, result_fail_message text,
  cert_eligibility text, result_close_minutes integer
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
    coalesce(qs.sound_enabled, true), qs.brand_name, qs.brand_logo_url, qs.favicon_url,
    qs.result_pass_title, qs.result_pass_message,
    qs.result_improve_title, qs.result_improve_message,
    qs.result_fail_title, qs.result_fail_message,
    coalesce(qs.cert_eligibility, 'all_pass'),
    coalesce(qs.result_close_minutes, 5)
  from quiz_sessions sess
  left join quiz_settings qs on qs.company_id = sess.company_id
  where sess.id = p_session_id;
$$;
