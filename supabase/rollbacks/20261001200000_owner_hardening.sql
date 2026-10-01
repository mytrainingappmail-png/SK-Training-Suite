-- Rollback for 20261001200000_owner_hardening.sql
create or replace function current_company_is_platform_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_operator from companies where id = current_employee_company_id()), false)
$$;
drop function if exists current_user_mfa_ok();
-- login_record_failed: re-apply supabase/migrations/20261001120000_login_rpc_hardening.sql's definition to restore the lock for operator companies.
