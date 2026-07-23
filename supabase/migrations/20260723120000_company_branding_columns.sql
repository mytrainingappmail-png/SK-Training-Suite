-- Real, admin-uploadable branding fields — the whole point is that any
-- admin (or a future customer's own admin/web developer) can change these
-- from Company Management without ever needing a code change or redeploy.
-- login_logo_url:  the image shown on the login page's dark hero panel.
-- app_icon_url:     the square icon used for the browser tab, PWA "Install
--                   app" prompt, and home-screen icon.
-- Both are nullable — when empty, the app falls back to the bundled
-- default asset, exactly as it does today.

alter table companies add column if not exists login_logo_url text not null default '';
alter table companies add column if not exists app_icon_url text not null default '';

drop function if exists get_public_branding();

create or replace function get_public_branding()
returns table (company_name text, logo text, login_logo_url text, app_icon_url text)
language sql
security definer
set search_path = public
as $$
  select company_name, logo, login_logo_url, app_icon_url
  from companies
  where active = true
  order by created_at asc
  limit 1;
$$;

grant execute on function get_public_branding() to anon, authenticated;
