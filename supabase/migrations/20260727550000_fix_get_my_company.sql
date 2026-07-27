-- Real bug: companyRepository.getCompany() does
-- `.from("companies").select("*").limit(1).single()` with no explicit
-- filter, relying on RLS to narrow it to exactly one row. That was safe
-- when authenticated_see_own_company was the only SELECT policy (it can
-- only ever return the caller's own company) -- but 20260727480000 added
-- companies_select_platform_operator so a platform operator can see every
-- company, which means `.limit(1)` with no ORDER BY now returns an
-- ARBITRARY company for that operator, not necessarily their own. Caught
-- live: Company Management loaded and then silently overwrote a
-- different company's branding while logged in as a different one.
--
-- Fix: a SECURITY DEFINER RPC that resolves deterministically via
-- current_employee_company_id(), so "my company" always means exactly
-- that regardless of how many rows RLS happens to expose.
create or replace function get_my_company()
returns companies
language sql
security definer
set search_path = public
as $$
  select * from companies where id = current_employee_company_id();
$$;

grant execute on function get_my_company() to authenticated;
