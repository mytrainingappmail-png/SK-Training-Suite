-- Lets an employee declare which SIM/number they actually use for calling
-- (common with dual-SIM phones) — purely a record-keeping label, not a
-- live telephony link (a web app cannot read a phone's real call log;
-- see the "Call Activity" dashboard, which is built entirely from calls
-- the employee logs themselves in the Calling Sheet).
alter table calling_app_admins add column if not exists registered_mobile_no text;

-- Self-service update, callable by either login type (LMS-linked or
-- dedicated) via current_calling_app_admin_id() — the existing
-- calling_app_admins_write_employee RLS policy only allows writes from a
-- real LMS employee session, so a dedicated-login agent could never set
-- their own number without this.
create or replace function update_my_registered_mobile(p_mobile text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_admin_id uuid;
begin
  v_admin_id := current_calling_app_admin_id();
  if v_admin_id is null then
    raise exception 'Not signed in to the Calling App.';
  end if;

  update calling_app_admins
  set registered_mobile_no = nullif(trim(p_mobile), '')
  where id = v_admin_id;
end;
$$;
