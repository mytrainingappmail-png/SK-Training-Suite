-- A simple on/off switch for the falling-words effect on the trainee
-- login/join landing screen — independent of the word list itself, which
-- login_motivational_words already covers.

alter table quiz_settings add column if not exists login_words_enabled boolean not null default true;

drop function if exists get_quiz_public_branding();
create function get_quiz_public_branding()
returns table (
  company_name text, brand_name text, brand_tagline text, brand_logo_url text,
  login_background_url text, login_banner_url text, favicon_url text, footer_text text,
  login_motivational_words text, login_words_enabled boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.company_name, s.brand_name, s.brand_tagline, s.brand_logo_url,
         s.login_background_url, s.login_banner_url, s.favicon_url, s.footer_text,
         s.login_motivational_words, coalesce(s.login_words_enabled, true)
  from companies c
  left join quiz_settings s on s.company_id = c.id
  where c.live_quiz_enabled = true
  order by c.created_at asc
  limit 1;
$$;
