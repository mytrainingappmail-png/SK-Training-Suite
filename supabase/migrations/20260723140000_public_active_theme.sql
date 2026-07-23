-- Lets the login page and sidebar apply the active theme's colors. Same
-- narrow, non-sensitive, pre-login-safe pattern as get_public_branding().
-- Only exposes color/font fields — nothing else in the themes table.

create or replace function get_active_theme()
returns table (primary_color text, secondary_color text, sidebar_color text, header_color text)
language sql
security definer
set search_path = public
as $$
  select primary_color, secondary_color, sidebar_color, header_color
  from themes
  where active = true
  order by created_at desc
  limit 1;
$$;

grant execute on function get_active_theme() to anon, authenticated;
