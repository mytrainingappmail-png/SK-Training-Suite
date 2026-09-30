-- Login RPC hardening, step 1 of 2 (additive — the old RPCs stay until the new
-- client is live; step 2 removes them and the plaintext password column).
--
-- Problems in the old pre-login RPCs (all callable by anyone with the public
-- anon key):
--   * login_lookup_employee / _any_company returned the employee's PLAINTEXT
--     password, their internal id and auth_user_id, plus name, email, mobile;
--   * login_record_failed_attempt(id, attempts, lock) took the counter from the
--     caller, so anyone could reset it to 0 (defeating the lockout) or lock any
--     account; login_record_successful_login(id) let anyone UNLOCK any account.
--
-- New behaviour:
--   * login_lookup returns only what the login screen needs: canonical
--     company/employee code, active, locked state, super-admin flag, and
--     whether the employee has a login. No password, no ids, no PII.
--   * login_record_failed counts and locks on the SERVER. Lock is timed
--     (15 minutes) instead of permanent; an admin-set lock (account_locked)
--     still needs an admin to clear.
--   * login_record_success works only for a signed-in user and only on their
--     own row.

alter table employees add column if not exists locked_until timestamptz;

create or replace function login_lookup(p_employee_code text, p_company_code text default null)
returns table (
  company_code   text,
  employee_code  text,
  active         boolean,
  is_locked      boolean,
  locked_until   timestamptz,
  is_super_admin boolean,
  has_login      boolean
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
    (e.auth_user_id is not null) as has_login
  from employees e
  join companies c on c.id = e.company_id and c.active = true
  where (e.employee_code = p_employee_code or lower(e.email) = lower(p_employee_code))
    and (coalesce(trim(p_company_code), '') = '' or lower(c.company_code) = lower(trim(p_company_code)))
$$;

revoke all on function login_lookup(text, text) from public;
grant execute on function login_lookup(text, text) to anon, authenticated;

create or replace function login_record_failed(p_company_code text, p_employee_code text)
returns void
language plpgsql
security definer
set search_path = public
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
    and lower(c.company_code) = lower(trim(p_company_code))
    and e.employee_code = p_employee_code
    -- attempts made while already locked don't extend the lock
    and not (e.locked_until is not null and e.locked_until > now());
end;
$$;

revoke all on function login_record_failed(text, text) from public;
grant execute on function login_record_failed(text, text) to anon, authenticated;

create or replace function login_record_success()
returns void
language sql
security definer
set search_path = public
as $$
  update employees
  set failed_login_attempts = 0,
      locked_until = null,
      last_login = now()
  where auth_user_id = auth.uid();
$$;

revoke all on function login_record_success() from public, anon;
grant execute on function login_record_success() to authenticated;

-- When an administrator unlocks an account, also clear the timed lock and the
-- counter so the employee can sign in straight away.
create or replace function employees_reset_lock_on_unlock()
returns trigger
language plpgsql
as $$
begin
  if coalesce(old.account_locked, false) = true and coalesce(new.account_locked, false) = false then
    new.locked_until := null;
    new.failed_login_attempts := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_employees_reset_lock_on_unlock on employees;
create trigger trg_employees_reset_lock_on_unlock before update on employees
  for each row execute function employees_reset_lock_on_unlock();

-- Lock state can't be edited by non-admins either (extends the Phase 2 guard).
create or replace function guard_employees_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and not current_employee_is_company_admin()
     and not current_company_is_platform_operator() then
    if new.company_id is distinct from old.company_id
       or new.auth_user_id is distinct from old.auth_user_id
       or new.employee_code is distinct from old.employee_code
       or new.active is distinct from old.active
       or new.account_locked is distinct from old.account_locked
       or new.locked_until is distinct from old.locked_until
       or new.failed_login_attempts is distinct from old.failed_login_attempts then
      raise exception 'Only an administrator can change these employee fields.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
