-- Lets the login page (and sidebar/header) show the company's real name and
-- logo from the companies table instead of a hardcoded file — so rebranding
-- becomes an admin-panel edit (Company Management), not a code change. Only
-- exposes company_name/logo (already public on any login screen anyway),
-- nothing else — safe to call with no session (anon).

create or replace function get_public_branding()
returns table (company_name text, logo text)
language sql
security definer
set search_path = public
as $$
  select company_name, logo
  from companies
  where active = true
  order by created_at asc
  limit 1;
$$;

grant execute on function get_public_branding() to anon, authenticated;
