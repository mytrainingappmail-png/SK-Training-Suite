-- ============================================================================
-- Simplify Live Quiz admin login: username + password only, no Company
-- Code field. This means quiz_admins.username must be unique GLOBALLY
-- (not just per-company) so a bare username lookup can find the right
-- company on its own — mirrors the reference app's original single-
-- tenant login exactly, while keeping the actual auth/session/RLS
-- machinery (separate Supabase Auth pool, internal email pattern)
-- unchanged underneath.
-- ============================================================================

-- The test "quizadmin" account created earlier on the disabled RSPL001
-- demo company would otherwise collide with SKE001's real one under a
-- global unique constraint — remove it (RSPL001's Live Quiz flag is
-- already off, this account was only ever for testing).
delete from quiz_admins where username = 'quizadmin' and company_id <> 'b259bfa8-bf5b-464f-b9a5-008d00efa1e4';

alter table quiz_admins drop constraint if exists quiz_admins_company_id_username_key;
alter table quiz_admins add constraint quiz_admins_username_key unique (username);

-- Looks up which company a given username belongs to, so the login
-- screen never has to ask for it. SECURITY DEFINER — runs before any
-- session exists, same pattern as get_company_for_quiz_login.
create or replace function get_quiz_admin_login_info(p_username text)
returns table (company_code text, live_quiz_enabled boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.company_code, c.live_quiz_enabled
  from quiz_admins qa
  join companies c on c.id = qa.company_id
  where lower(qa.username) = lower(p_username) and qa.status = 'active'
  limit 1;
$$;
