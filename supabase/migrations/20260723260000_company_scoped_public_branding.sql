-- get_public_branding() previously did `order by created_at asc limit 1` —
-- always returning whichever company was created FIRST (S&K Enterprise),
-- regardless of which company is actually about to log in. That was fine
-- when this schema only ever had one company; now that Realty Smartz Pvt
-- Ltd is a real, separate company, this is why an uploaded Realty Smartz
-- logo never showed on the login page — the RPC never even looked at it.
--
-- Fix: accept an optional company_code so the login page can resolve the
-- RIGHT company's branding once the user starts typing it. Falls back to
-- the old "first active company" behavior when no code is given yet (so
-- the login page still shows something sensible before typing starts).
-- Also now returns `favicon` (previously unused anywhere in the app).

drop function if exists get_public_branding();

create or replace function get_public_branding(p_company_code text default null)
returns table (company_name text, logo text, login_logo_url text, app_icon_url text, favicon text)
language sql
security definer
set search_path = public
as $$
  select company_name, logo, login_logo_url, app_icon_url, favicon
  from companies
  where active = true
    and (p_company_code is null or lower(company_code) = lower(trim(p_company_code)))
  order by (p_company_code is null)::int, created_at asc
  limit 1;
$$;

grant execute on function get_public_branding(text) to anon, authenticated;
