-- Lets specific config values (e.g. max_login_attempts, checked *during*
-- the login flow itself, before any session exists) be read safely without
-- authentication. Only returns a single named setting's value — same
-- narrow, non-sensitive scope as get_public_branding().

create or replace function get_setting_value(p_key text)
returns text
language sql
security definer
set search_path = public
as $$
  select setting_value from settings where setting_key = p_key and active = true limit 1;
$$;

grant execute on function get_setting_value(text) to anon, authenticated;
