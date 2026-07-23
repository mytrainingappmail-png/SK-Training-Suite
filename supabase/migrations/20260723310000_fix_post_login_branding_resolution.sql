-- Real bug: get_public_branding(null) ALWAYS fell back to "oldest active
-- company", even for an authenticated employee calling it post-login (the
-- sidebar/header logo + company name go through this same RPC with no
-- company code, since loadBranding() is also used pre-login). So every
-- company except the very first one ever created (S&K Enterprise) saw the
-- WRONG logo/name in their own sidebar after logging in - Realty Smartz's
-- Amit Arora would see "Siddharth & Kunal Enterprise" in the sidebar even
-- though the Dashboard heading (which reads the company table directly,
-- not through this RPC) correctly showed "Realty Smartz Pvt Ltd".
--
-- Fix: when no explicit company_code is given, prefer the CALLER'S OWN
-- company (current_employee_company_id()) if they're logged in; only fall
-- back to "oldest active company" for the true pre-login/anonymous case
-- (the login screen before anything has been typed).

create or replace function get_public_branding(p_company_code text default null)
returns table (company_name text, logo text, login_logo_url text, app_icon_url text, favicon text)
language sql
security definer
set search_path = public
as $$
  select c.company_name, c.logo, c.login_logo_url, c.app_icon_url, c.favicon
  from companies c
  where c.active = true
    and c.id = coalesce(
      (select id from companies where active = true and p_company_code is not null and lower(company_code) = lower(trim(p_company_code))),
      current_employee_company_id(),
      (select id from companies where active = true order by created_at asc limit 1)
    )
  limit 1;
$$;

grant execute on function get_public_branding(text) to anon, authenticated;
