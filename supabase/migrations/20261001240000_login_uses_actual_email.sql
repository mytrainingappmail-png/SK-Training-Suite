-- Sign-in must not depend on the company's CURRENT code.
--
-- An employee's login email was built from the company code at the time the account
-- was made (e.g. ske001.00001@internal.sktraining). When the company was later renamed
-- SKE001 -> RMT001, the app kept building rmt001.00001@..., which does not exist, so
-- every RMT001 employee got "Invalid employee ID/email or password" even with the right
-- password (the 20 accounts were re-pointed by hand on 2026-10-02).
-- login_lookup now also returns the account's real email, and the app signs in with
-- that, so renaming a company can never lock its people out again.

drop function if exists login_lookup(text, text);

create function login_lookup(p_employee_code text, p_company_code text default null)
returns table (
  company_code   text,
  employee_code  text,
  active         boolean,
  is_locked      boolean,
  locked_until   timestamptz,
  is_super_admin boolean,
  has_login      boolean,
  login_email    text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.company_code::text,
    e.employee_code::text,
    e.active,
    (coalesce(e.account_locked, false) or (e.locked_until is not null and e.locked_until > now())) as is_locked,
    case when e.locked_until is not null and e.locked_until > now() then e.locked_until end as locked_until,
    exists (
      select 1 from employee_roles er
      join roles r on r.id = er.role_id
      where er.employee_id = e.id and er.active = true and r.role_code = 'SUPER_ADMIN'
    ) as is_super_admin,
    (e.auth_user_id is not null) as has_login,
    (select u.email::text from auth.users u where u.id = e.auth_user_id) as login_email
  from employees e
  join companies c on c.id = e.company_id and c.active = true
  where (e.employee_code = p_employee_code or lower(e.email) = lower(p_employee_code))
    and (coalesce(trim(p_company_code), '') = '' or lower(c.company_code) = lower(trim(p_company_code)))
$$;

revoke all on function login_lookup(text, text) from public;
grant execute on function login_lookup(text, text) to anon, authenticated;
