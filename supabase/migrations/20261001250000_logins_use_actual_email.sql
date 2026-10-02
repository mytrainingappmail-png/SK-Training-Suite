-- Same fix as 20261001240000 (employees), for the Live Quiz admin and Calling App
-- logins: they rebuilt the sign-in email from the company's CURRENT code, so renaming
-- a company would have locked those users out too. The lookups now return the account's
-- real email and the apps sign in with it.

drop function if exists get_quiz_admin_login_info(text);
create function get_quiz_admin_login_info(p_username text)
returns table (company_code text, live_quiz_enabled boolean, login_email text)
language sql
stable
security definer
set search_path = public
as $$
  select c.company_code::text, c.live_quiz_enabled,
         (select u.email::text from auth.users u where u.id = qa.auth_user_id)
  from quiz_admins qa
  join companies c on c.id = qa.company_id
  where lower(qa.username) = lower(p_username) and qa.status = 'active'
  limit 1;
$$;
revoke all on function get_quiz_admin_login_info(text) from public;
grant execute on function get_quiz_admin_login_info(text) to anon, authenticated;

drop function if exists get_calling_app_admin_login_info(text);
create function get_calling_app_admin_login_info(p_username text)
returns table (company_code text, module_enabled boolean, login_email text)
language sql
stable
security definer
set search_path = public
as $$
  select c.company_code::text, current_company_module_enabled(c.id, 'calling_app'),
         (select u.email::text from auth.users u where u.id = ca.auth_user_id)
  from calling_app_admins ca
  join companies c on c.id = ca.company_id
  where lower(ca.username) = lower(p_username) and ca.status = 'active'
  limit 1;
$$;
revoke all on function get_calling_app_admin_login_info(text) from public;
grant execute on function get_calling_app_admin_login_info(text) to anon, authenticated;
