-- Login RPC hardening, step 2 of 2 — run ONLY after the client that uses
-- login_lookup / login_record_failed / login_record_success is live and login
-- has been confirmed working.
--
-- Removes the old pre-login RPCs (they returned the plaintext password, ids and
-- personal details to anyone with the public anon key, and let callers set or
-- reset lockout counters) and deletes the plaintext password column itself.
-- Passwords exist only on Supabase Auth logins from here on.

-- Safety: refuse to run while any active employee still has no real login —
-- dropping the column would leave them with no way to sign in.
do $$
declare v_n int;
begin
  select count(*) into v_n from employees where active = true and auth_user_id is null;
  if v_n > 0 then
    raise exception '% active employee(s) still have no login (auth_user_id). Create their logins first.', v_n;
  end if;
end $$;

drop function if exists login_lookup_employee(text, uuid);
drop function if exists login_lookup_employee_any_company(text);
drop function if exists login_record_failed_attempt(uuid, integer, boolean);
drop function if exists login_record_successful_login(uuid);

alter table employees drop column if exists password;
