-- Lets the admin control the trainee landing screen's logo size and
-- placement, instead of a fixed small centered mark — "top_center" keeps
-- it inline above the heading (today's look, just scalable), "top_left"/
-- "top_right" pin it to a screen corner (and the Admin-access link swaps
-- to the opposite corner automatically so the two never collide).

alter table quiz_settings add column if not exists login_logo_position text not null default 'top_center'
  check (login_logo_position in ('top_left', 'top_center', 'top_right'));
alter table quiz_settings add column if not exists login_logo_scale integer not null default 100;

drop function if exists get_quiz_public_branding();
create function get_quiz_public_branding()
returns table (
  company_name text, brand_name text, brand_tagline text, brand_logo_url text,
  login_background_url text, login_banner_url text, favicon_url text, footer_text text,
  login_motivational_words text, login_words_enabled boolean,
  login_logo_position text, login_logo_scale int
)
language sql
stable
security definer
set search_path = public
as $$
  select c.company_name, s.brand_name, s.brand_tagline, s.brand_logo_url,
         s.login_background_url, s.login_banner_url, s.favicon_url, s.footer_text,
         s.login_motivational_words, coalesce(s.login_words_enabled, true),
         coalesce(s.login_logo_position, 'top_center'), coalesce(s.login_logo_scale, 100)
  from companies c
  left join quiz_settings s on s.company_id = c.id
  where c.live_quiz_enabled = true
  order by c.created_at asc
  limit 1;
$$;
