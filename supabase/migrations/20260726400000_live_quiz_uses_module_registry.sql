-- Live Quiz's real server-side gate, quiz_module_enabled_for_company(), still
-- read the old ad-hoc companies.live_quiz_enabled column directly. Now that
-- company access is customized through the app_modules/company_modules
-- registry (see 20260726390000_app_modules_registry.sql), toggling Live Quiz
-- off for a company in the new Company Modules screen must actually take
-- effect here too — otherwise the old column goes stale and the quiz-admin
-- login guard, PIN lookup, join, and answer submission would keep using
-- whatever live_quiz_enabled happened to be at migration time.
create or replace function quiz_module_enabled_for_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_company_module_enabled(p_company_id, 'live_quiz');
$$;

-- Same reasoning — these two read the raw column directly instead of going
-- through quiz_module_enabled_for_company().
create or replace function get_my_quiz_company_flag()
returns table (company_id uuid, live_quiz_enabled boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, quiz_module_enabled_for_company(c.id)
  from quiz_admins qa
  join companies c on c.id = qa.company_id
  where qa.auth_user_id = auth.uid() and qa.status = 'active'
  limit 1;
$$;

create or replace function get_company_for_quiz_login(p_company_code text)
returns table (id uuid, active boolean, live_quiz_enabled boolean)
language sql
stable
security definer
set search_path = public
as $$
  select id, active, quiz_module_enabled_for_company(id)
  from companies where lower(company_code) = lower(p_company_code);
$$;
