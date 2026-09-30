-- Rollback for 20261001120000_login_rpc_hardening.sql
drop trigger if exists trg_employees_reset_lock_on_unlock on employees;
drop function if exists employees_reset_lock_on_unlock();
drop function if exists login_record_success();
drop function if exists login_record_failed(text, text);
drop function if exists login_lookup(text, text);
-- restore the Phase 2 version of the guard (without locked_until)
create or replace function guard_employees_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon')
     and not current_employee_is_company_admin()
     and not current_company_is_platform_operator() then
    if new.company_id is distinct from old.company_id
       or new.auth_user_id is distinct from old.auth_user_id
       or new.employee_code is distinct from old.employee_code
       or new.active is distinct from old.active
       or new.account_locked is distinct from old.account_locked
       or new.failed_login_attempts is distinct from old.failed_login_attempts then
      raise exception 'Only an administrator can change these employee fields.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
-- (the locked_until column is left in place; it is harmless when unused)
