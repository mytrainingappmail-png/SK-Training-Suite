-- Surfaces the company_code through the same branding lookup the header
-- already calls post-login — lets the app show "your company code is
-- SKE001" at the top of the admin panel, so it's not something only
-- rememberable from the login screen.

drop function if exists get_public_branding(text);
create function get_public_branding(p_company_code text default null::text)
returns table (company_name text, logo text, login_logo_url text, app_icon_url text, favicon text, company_code text)
language sql
security definer
set search_path = public
as $$
  select c.company_name, c.logo, c.login_logo_url, c.app_icon_url, c.favicon, c.company_code
  from companies c
  where c.active = true
    and c.id = coalesce(
      (select id from companies where active = true and p_company_code is not null and lower(company_code) = lower(trim(p_company_code))),
      current_employee_company_id(),
      (select id from companies where active = true order by created_at asc limit 1)
    )
  limit 1;
$$;
