-- Owner hardening.
--
-- Platform-operator powers (every company's data, licences, plans, discount
-- codes...) are the keys to the whole product, so they now need to be earned
-- three ways at once:
--   1. the caller's company carries the platform-operator flag (only PLATFORM
--      should, once the cut-over is done), AND
--   2. the caller is a SUPER_ADMIN of that company, AND
--   3. if the account has two-step verification (an authenticator-app code)
--      set up, THIS session must have passed it (JWT aal = aal2). A stolen or
--      guessed password alone then yields a session with no operator powers.
-- Accounts without two-step verification enrolled are unaffected until they
-- enrol, so nobody is locked out by this change.

create or replace function current_user_mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke all on function current_user_mfa_ok() from public, anon;
grant execute on function current_user_mfa_ok() to authenticated;

create or replace function current_company_is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce((select c.is_platform_operator from companies c where c.id = current_employee_company_id()), false)
      then current_employee_is_company_admin() and current_user_mfa_ok()
    else false
  end
$$;

-- Operator companies (the platform owner's) are never timed-locked after wrong
-- passwords: an attacker could otherwise keep the owner locked out for ever just
-- by failing logins. The password is long and random, and two-step verification
-- (above) protects what a guessed password could reach.
create or replace function login_record_failed(p_company_code text, p_employee_code text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_setting text;
  v_max int := 5;
begin
  select setting_value into v_setting from settings
  where setting_key = 'max_login_attempts' and active = true limit 1;
  if v_setting ~ '^\d{1,3}$' then
    v_max := least(greatest(v_setting::int, 3), 20);
  end if;

  update employees e
  set failed_login_attempts = case
        when coalesce(e.failed_login_attempts, 0) + 1 >= v_max then 0
        else coalesce(e.failed_login_attempts, 0) + 1 end,
      locked_until = case
        when coalesce(e.failed_login_attempts, 0) + 1 >= v_max then now() + interval '15 minutes'
        else e.locked_until end
  from companies c
  where c.id = e.company_id
    and c.is_platform_operator = false
    and lower(c.company_code) = lower(trim(p_company_code))
    and e.employee_code = p_employee_code
    and not (e.locked_until is not null and e.locked_until > now());
end;
$$;
